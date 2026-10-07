import {
  doc,
  getDocsFromCache,
  getDocsFromServer,
  limit as limitTo,
  type Query,
  type QuerySnapshot,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { type CategoryBudgetStatus, categoryBudgetStatus, sumCategorySpend } from "@/lib/finance/budget";
import { expenseEffects, expenseUpdateEffects, reverseEffects } from "@/lib/finance/ledger";
import { monthKey, monthRange } from "@/lib/months";

import { expenseInputSchema } from "@/lib/validation/expense";
import type { Expense, ExpenseInput, ExpenseQuery } from "@/types";

import { mergeStatsDeltas, expenseStatsDelta, expenseUpdateStatsDeltas } from "@/lib/stats/monthly";

import { type AccountExists, applyBalanceEffects } from "./balances";
import { applyStatsDeltas } from "./stats.service";
import { budgetConverter, expenseConverter } from "./converters";
import { budgetsCol, expenseDoc, expensesCol } from "./paths";

function toFirestoreFields(input: ExpenseInput) {
  const valid = expenseInputSchema.parse(input);
  return {
    type: "EXPENSE" as const,
    amount: valid.amount,
    categoryId: valid.categoryId,
    paymentMethod: valid.paymentMethod,
    note: valid.note,
    occurredAt: Timestamp.fromDate(valid.occurredAt),
    accountId: input.accountId ?? null,
    // Preserve occurrence references (e.g. when an auto-recorded expense is restored by Undo).
    ...(input.recurringId ? { recurringId: input.recurringId, occurrence: input.occurrence ?? null } : {}),
  };
}

export interface ExpenseSnapshotMeta {
  /** True when more documents exist beyond `limit`. */
  hasMore: boolean;
  /** True while results come only from the on-device cache. */
  fromCache: boolean;
}

/**
 * Live query over a user's expenses, newest first.
 * Equality filters use the composite indexes declared in firestore.indexes.json.
 */
export function subscribeToExpenses(
  uid: string,
  { from, to, categoryId, paymentMethod, limit }: ExpenseQuery,
  onData: (expenses: Expense[], meta: ExpenseSnapshotMeta) => void,
  onError: (error: Error) => void,
): () => void {
  const constraints: QueryConstraint[] = [];
  if (categoryId) constraints.push(where("categoryId", "==", categoryId));
  if (paymentMethod) constraints.push(where("paymentMethod", "==", paymentMethod));
  if (from) constraints.push(where("occurredAt", ">=", Timestamp.fromDate(from)));
  if (to) constraints.push(where("occurredAt", "<=", Timestamp.fromDate(to)));
  // Fetch one extra document to know whether another page exists.
  constraints.push(orderBy("occurredAt", "desc"), limitTo(limit + 1));

  const q = query(expensesCol(uid), ...constraints).withConverter(expenseConverter);
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const expenses = snapshot.docs.map((d) => d.data());
      onData(expenses.slice(0, limit), {
        hasMore: expenses.length > limit,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    onError,
  );
}

export interface PendingWrite {
  id: string;
  /** Resolves once the server acknowledges the write (never, while offline). */
  committed: Promise<void>;
}

export interface LedgerOptions {
  /** Returns false for accounts that were deleted (their balance isn't updated). */
  accountExists?: AccountExists;
}

/**
 * Creates an expense. The id is generated client-side so callers can render, undo or
 * navigate immediately; Firestore's local cache shows the expense before it syncs.
 * With an account, the balance is debited in the same batch (works offline).
 */
export function createExpense(uid: string, input: ExpenseInput, options: LedgerOptions = {}): PendingWrite {
  const ref = doc(expensesCol(uid));
  return { id: ref.id, committed: writeExpense(uid, ref.id, input, options) };
}

function writeExpense(uid: string, id: string, input: ExpenseInput, options: LedgerOptions): Promise<void> {
  const fields = toFirestoreFields(input);
  const batch = writeBatch(getDb());
  batch.set(expenseDoc(uid, id), { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  applyBalanceEffects(batch.update.bind(batch), uid, expenseEffects(fields), id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(expenseStatsDelta(statsShape(input), 1)));
  return batch.commit();
}

/** Edits an expense; account balances are adjusted by the difference (old → new). */
export function updateExpense(
  uid: string,
  before: ExpenseRecord,
  input: ExpenseInput,
  options: LedgerOptions = {},
): Promise<void> {
  const fields = toFirestoreFields(input);
  const batch = writeBatch(getDb());
  batch.update(expenseDoc(uid, before.id), { ...fields, updatedAt: serverTimestamp() });
  applyBalanceEffects(batch.update.bind(batch), uid, expenseUpdateEffects(before, fields), before.id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, expenseUpdateStatsDeltas(before, statsShape(input)));
  return batch.commit();
}

/** What's needed to reverse an expense's balance and analytics effects. */
export type ExpenseRecord = Pick<Expense, "id" | "amount" | "accountId" | "categoryId" | "paymentMethod" | "occurredAt">;

function statsShape(input: ExpenseInput) {
  return { ...input, accountId: input.accountId ?? null };
}

/** Deletes an expense and refunds its account (if any) atomically. */
export function deleteExpense(uid: string, expense: ExpenseRecord, options: LedgerOptions = {}): Promise<void> {
  const batch = writeBatch(getDb());
  batch.delete(expenseDoc(uid, expense.id));
  applyBalanceEffects(batch.update.bind(batch), uid, reverseEffects(expenseEffects(expense)), expense.id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(expenseStatsDelta(expense, -1)));
  return batch.commit();
}

/** Re-creates a deleted expense under its original id (used by "Undo"). */
export function restoreExpense(uid: string, expense: Expense, options: LedgerOptions = {}): Promise<void> {
  return writeExpense(uid, expense.id, expense, options);
}

/** Expenses charged to one account/card, newest first (composite index accountId + occurredAt). */
export function subscribeAccountExpenses(
  uid: string,
  accountId: string,
  onData: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(expensesCol(uid), where("accountId", "==", accountId), orderBy("occurredAt", "desc"), limitTo(200)).withConverter(
    expenseConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/** How long to wait for the server before answering from the on-device cache. */
const SERVER_READ_TIMEOUT_MS = 4000;

/**
 * Reads from the server when reachable, else from the local cache (which includes this
 * device's pending writes). `source` tells the caller which one answered.
 */
async function readFresh<T>(q: Query<T>): Promise<{ snap: QuerySnapshot<T>; source: "server" | "cache" }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { snap: await getDocsFromCache(q), source: "cache" };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snap = await Promise.race([
      getDocsFromServer(q),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), SERVER_READ_TIMEOUT_MS);
      }),
    ]);
    return { snap, source: "server" };
  } catch {
    return { snap: await getDocsFromCache(q), source: "cache" };
  } finally {
    clearTimeout(timer);
  }
}

export interface CategoryBudgetResult extends CategoryBudgetStatus {
  /** "cache" when offline: other devices' changes may be missing. */
  source: "server" | "cache";
}

/**
 * Budget position of a category for the month of `occurredAt` (past and future months
 * included), computed from the stored expenses and budget documents rather than any
 * client-side aggregate. Pass the expense that was just written as `include` so it is
 * counted even if it hasn't reached the server yet.
 */
export async function calculateCategoryBudgetStatus(
  uid: string,
  { categoryId, occurredAt }: { categoryId: string; occurredAt: Date },
  include?: { id: string; amount: number; categoryId: string },
): Promise<CategoryBudgetResult> {
  const month = monthKey(occurredAt);
  const { from, to } = monthRange(month);
  const expensesQuery = query(
    expensesCol(uid),
    where("categoryId", "==", categoryId),
    where("occurredAt", ">=", Timestamp.fromDate(from)),
    where("occurredAt", "<=", Timestamp.fromDate(to)),
  ).withConverter(expenseConverter);
  // Budgets roll forward: the latest document at or before this month applies.
  const budgetQuery = query(budgetsCol(uid), where("month", "<=", month), orderBy("month", "desc"), limitTo(1)).withConverter(
    budgetConverter,
  );
  const [expenses, budgets] = await Promise.all([readFresh(expensesQuery), readFresh(budgetQuery)]);
  const spent = sumCategorySpend(
    expenses.snap.docs.map((d) => d.data()),
    categoryId,
    include,
  );
  const budget = budgets.snap.docs[0]?.data() ?? null;
  return {
    ...categoryBudgetStatus(categoryId, month, budget, spent),
    source: expenses.source === "server" && budgets.source === "server" ? "server" : "cache",
  };
}
