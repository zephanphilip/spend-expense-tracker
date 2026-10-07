import { deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { expenseEffects } from "@/lib/finance/ledger";
import { occurrenceDate, recurringExpenseId } from "@/lib/finance/recurrence";
import { recurringPaymentInputSchema } from "@/lib/validation/accounts";
import type { RecurringPayment, RecurringPaymentInput } from "@/types";

import { expenseStatsDelta, mergeStatsDeltas } from "@/lib/stats/monthly";

import { type AccountExists, applyBalanceEffects } from "./balances";
import { applyStatsDeltas } from "./stats.service";
import { recurringPaymentConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { expenseDoc, recurringPaymentDoc, recurringPaymentsCol } from "./paths";

export function subscribeRecurringPayments(
  uid: string,
  onData: (items: RecurringPayment[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(recurringPaymentsCol(uid), orderBy("createdAt", "asc")).withConverter(recurringPaymentConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

function scheduleFields(input: RecurringPaymentInput) {
  const v = recurringPaymentInputSchema.parse(input);
  return {
    name: v.name,
    amount: v.amount,
    categoryId: v.categoryId,
    paymentMethod: v.paymentMethod,
    accountId: v.accountId,
    unit: v.unit,
    interval: v.interval,
    startDate: Timestamp.fromDate(v.startDate),
    endDate: v.endDate ? Timestamp.fromDate(v.endDate) : null,
    active: v.active,
    autoPay: input.autoPay ?? false,
  };
}

export function createRecurringPayment(uid: string, input: RecurringPaymentInput): PendingWrite {
  const ref = doc(recurringPaymentsCol(uid));
  const committed = setDoc(ref, {
    ...scheduleFields(input),
    cycle: 0,
    nextDate: Timestamp.fromDate(input.startDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, committed };
}

/**
 * Updates a schedule. Changing the start date or frequency restarts the cycle count from
 * the new start date (the next payment is the new start date).
 */
export function updateRecurringPayment(uid: string, before: RecurringPayment, input: RecurringPaymentInput): Promise<void> {
  const f = scheduleFields(input);
  const rescheduled =
    input.startDate.getTime() !== before.startDate.getTime() || input.unit !== before.unit || input.interval !== before.interval;
  const cycle = rescheduled ? 0 : before.cycle;
  return updateDoc(recurringPaymentDoc(uid, before.id), {
    ...f,
    cycle,
    nextDate: Timestamp.fromDate(occurrenceDate(input.startDate, input.unit, input.interval, cycle)),
    updatedAt: serverTimestamp(),
  });
}

export function deleteRecurringPayment(uid: string, id: string): Promise<void> {
  return deleteDoc(recurringPaymentDoc(uid, id));
}

export class AlreadyPaidError extends Error {
  constructor() {
    super("This payment was already recorded.");
    this.name = "AlreadyPaidError";
  }
}

/**
 * Pays the next occurrence: creates the expense (deterministic id per cycle, so it can't be
 * paid twice), debits the account if set, and advances the schedule — atomically.
 */
export async function payRecurring(
  uid: string,
  paymentId: string,
  {
    paidAt,
    amount,
    expectedCycle,
  }: {
    paidAt: Date;
    amount?: number;
    /** Automation passes the occurrence it planned; if another device got there first, nothing is written. */
    expectedCycle?: number;
  },
  options: { accountExists?: AccountExists } = {},
): Promise<{ expenseId: string; amount: number }> {
  const ref = recurringPaymentDoc(uid, paymentId).withConverter(recurringPaymentConverter);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Recurring payment not found");
    const rp = snap.data();
    if (expectedCycle !== undefined && rp.cycle !== expectedCycle) throw new AlreadyPaidError();
    const expenseId = recurringExpenseId(rp.id, rp.cycle);
    if ((await tx.get(expenseDoc(uid, expenseId))).exists()) throw new AlreadyPaidError();
    const value = amount ?? rp.amount;
    tx.set(expenseDoc(uid, expenseId), {
      type: "EXPENSE",
      amount: value,
      categoryId: rp.categoryId,
      paymentMethod: rp.paymentMethod,
      note: rp.name,
      occurredAt: Timestamp.fromDate(paidAt),
      accountId: rp.accountId,
      // Occurrence reference: which schedule and which occurrence this expense settles.
      recurringId: rp.id,
      occurrence: rp.cycle,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    applyBalanceEffects(tx.update.bind(tx), uid, expenseEffects({ amount: value, accountId: rp.accountId }), expenseId, options);
    applyStatsDeltas(
      tx.set.bind(tx),
      uid,
      mergeStatsDeltas(
        expenseStatsDelta({ amount: value, categoryId: rp.categoryId, paymentMethod: rp.paymentMethod, accountId: rp.accountId, occurredAt: paidAt }, 1),
      ),
    );
    tx.update(recurringPaymentDoc(uid, rp.id), {
      cycle: rp.cycle + 1,
      nextDate: Timestamp.fromDate(occurrenceDate(rp.startDate, rp.unit, rp.interval, rp.cycle + 1)),
      updatedAt: serverTimestamp(),
    });
    return { expenseId, amount: value };
  });
}

/** Skips the next occurrence without recording an expense. */
export async function skipRecurring(uid: string, paymentId: string): Promise<void> {
  const ref = recurringPaymentDoc(uid, paymentId).withConverter(recurringPaymentConverter);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Recurring payment not found");
    const rp = snap.data();
    tx.update(recurringPaymentDoc(uid, rp.id), {
      cycle: rp.cycle + 1,
      nextDate: Timestamp.fromDate(occurrenceDate(rp.startDate, rp.unit, rp.interval, rp.cycle + 1)),
      updatedAt: serverTimestamp(),
    });
  });
}
