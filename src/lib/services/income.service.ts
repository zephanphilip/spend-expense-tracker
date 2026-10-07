import {
  deleteDoc,
  doc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { recurringIncomeId } from "@/lib/finance/income";
import { incomeEffects, incomeUpdateEffects, reverseEffects } from "@/lib/finance/ledger";
import { incomeInputSchema, recurringIncomeInputSchema } from "@/lib/validation/finance";
import type { Income, IncomeInput, IncomeSource, MonthKey, RecurringIncome, RecurringIncomeInput } from "@/types";

import { incomeStatsDelta, incomeUpdateStatsDeltas, mergeStatsDeltas } from "@/lib/stats/monthly";

import { applyBalanceEffects } from "./balances";
import { applyStatsDeltas } from "./stats.service";
import { incomeConverter, recurringIncomeConverter } from "./converters";
import type { LedgerOptions, PendingWrite } from "./expense.service";
import { incomeDoc, incomesCol, recurringIncomeDoc, recurringIncomesCol } from "./paths";

function incomeFields(input: IncomeInput) {
  const v = incomeInputSchema.parse(input);
  return {
    amount: v.amount,
    source: v.source,
    note: v.note,
    receivedAt: Timestamp.fromDate(v.receivedAt),
    forMonth: v.forMonth,
    expectedAt: v.expectedAt ? Timestamp.fromDate(v.expectedAt) : null,
    recurringId: v.recurringId,
    type: "INCOME" as const,
    accountId: input.accountId ?? null,
  };
}

function recurringFields(input: RecurringIncomeInput) {
  return { ...recurringIncomeInputSchema.parse(input), accountId: input.accountId ?? null, autoRecord: input.autoRecord ?? false };
}

type Unsubscribe = () => void;

/** Incomes attributed to months in [fromMonth, toMonth] (by `forMonth`). */
export function subscribeIncomesForMonths(
  uid: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
  onData: (incomes: Income[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    incomesCol(uid),
    where("forMonth", ">=", fromMonth),
    where("forMonth", "<=", toMonth),
    orderBy("forMonth", "desc"),
    limitTo(2000),
  ).withConverter(incomeConverter);
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => d.data()).sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()),
      ),
    onError,
  );
}

/** Newest-first income history, optionally limited to one source (composite index). */
export function subscribeIncomeHistory(
  uid: string,
  { source, limit }: { source?: IncomeSource; limit: number },
  onData: (incomes: Income[], hasMore: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [];
  if (source) constraints.push(where("source", "==", source));
  constraints.push(orderBy("receivedAt", "desc"), limitTo(limit + 1));
  const q = query(incomesCol(uid), ...constraints).withConverter(incomeConverter);
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => d.data());
      onData(all.slice(0, limit), all.length > limit);
    },
    onError,
  );
}

/**
 * Records an income. With `repeat`, also creates a monthly template in the same batch and
 * gives this income the template's deterministic per-month id.
 */
export function createIncome(
  uid: string,
  input: IncomeInput,
  repeat?: { name: string; dayOfMonth: number },
  options: LedgerOptions = {},
): PendingWrite {
  const batch = writeBatch(getDb());
  let ref = doc(incomesCol(uid));
  let recurringId = input.recurringId;
  if (repeat) {
    const template = doc(recurringIncomesCol(uid));
    recurringId = template.id;
    batch.set(template, {
      ...recurringFields({
        name: repeat.name,
        source: input.source,
        amount: input.amount,
        dayOfMonth: repeat.dayOfMonth,
        startMonth: input.forMonth,
        active: true,
        accountId: input.accountId ?? null,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    ref = incomeDoc(uid, recurringIncomeId(template.id, input.forMonth));
  }
  const fields = incomeFields({ ...input, recurringId });
  batch.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  applyBalanceEffects(batch.update.bind(batch), uid, incomeEffects(fields), ref.id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(incomeStatsDelta(fields, 1)));
  return { id: ref.id, committed: batch.commit() };
}

/** Edits an income; the linked account is adjusted by the difference. */
export function updateIncome(
  uid: string,
  before: Pick<Income, "id" | "amount" | "accountId" | "source" | "forMonth">,
  input: IncomeInput,
  options: LedgerOptions = {},
): Promise<void> {
  const fields = incomeFields(input);
  const batch = writeBatch(getDb());
  batch.update(incomeDoc(uid, before.id), { ...fields, updatedAt: serverTimestamp() });
  applyBalanceEffects(batch.update.bind(batch), uid, incomeUpdateEffects(before, fields), before.id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, incomeUpdateStatsDeltas(before, fields));
  return batch.commit();
}

export function deleteIncome(
  uid: string,
  income: Pick<Income, "id" | "amount" | "accountId" | "source" | "forMonth">,
  options: LedgerOptions = {},
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.delete(incomeDoc(uid, income.id));
  applyBalanceEffects(batch.update.bind(batch), uid, reverseEffects(incomeEffects(income)), income.id, options);
  applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(incomeStatsDelta(income, -1)));
  return batch.commit();
}

export class AlreadyRecordedError extends Error {
  constructor() {
    super("This income is already recorded for that month.");
    this.name = "AlreadyRecordedError";
  }
}

/**
 * Marks a recurring income as received for `month`. A transaction on the deterministic id
 * guarantees it can't be recorded twice, even from two devices at once.
 */
export async function recordRecurringIncome(
  uid: string,
  template: RecurringIncome,
  month: MonthKey,
  { amount, receivedAt, expectedAt }: { amount: number; receivedAt: Date; expectedAt: Date },
  options: LedgerOptions = {},
): Promise<string> {
  const ref = incomeDoc(uid, recurringIncomeId(template.id, month));
  await runTransaction(getDb(), async (tx) => {
    if ((await tx.get(ref)).exists()) throw new AlreadyRecordedError();
    const fields = incomeFields({
      amount,
      source: template.source,
      note: template.name,
      receivedAt,
      forMonth: month,
      expectedAt: template.source === "salary" ? expectedAt : null,
      recurringId: template.id,
      accountId: template.accountId,
    });
    tx.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    applyBalanceEffects(tx.update.bind(tx), uid, incomeEffects(fields), ref.id, options);
    applyStatsDeltas(tx.set.bind(tx), uid, mergeStatsDeltas(incomeStatsDelta(fields, 1)));
  });
  return ref.id;
}

export function subscribeRecurringIncomes(
  uid: string,
  onData: (items: RecurringIncome[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(recurringIncomesCol(uid), orderBy("createdAt", "asc")).withConverter(
    recurringIncomeConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

export function createRecurringIncome(uid: string, input: RecurringIncomeInput): PendingWrite {
  const ref = doc(recurringIncomesCol(uid));
  const committed = setDoc(ref, {
    ...recurringFields(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, committed };
}

export function updateRecurringIncome(uid: string, id: string, input: RecurringIncomeInput): Promise<void> {
  return updateDoc(recurringIncomeDoc(uid, id), { ...recurringFields(input), updatedAt: serverTimestamp() });
}

/** Removes the template only; incomes already recorded from it stay in history. */
export function deleteRecurringIncome(uid: string, id: string): Promise<void> {
  return deleteDoc(recurringIncomeDoc(uid, id));
}

/** Incomes received into one account, newest first (composite index accountId + receivedAt). */
export function subscribeAccountIncomes(
  uid: string,
  accountId: string,
  onData: (incomes: Income[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(incomesCol(uid), where("accountId", "==", accountId), orderBy("receivedAt", "desc"), limitTo(200)).withConverter(
    incomeConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/** One-time read of incomes for months [from, to] (automation catch-up). */
export async function fetchIncomesForMonths(uid: string, fromMonth: MonthKey, toMonth: MonthKey): Promise<Income[]> {
  const snap = await getDocs(
    query(incomesCol(uid), where("forMonth", ">=", fromMonth), where("forMonth", "<=", toMonth)).withConverter(incomeConverter),
  );
  return snap.docs.map((d) => d.data());
}
