import {
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { EMI_CATEGORY_ID } from "@/lib/constants/categories";
import { getDb } from "@/lib/firebase/client";
import { dueDateFor, splitNextInstallment } from "@/lib/finance/emi";
import { reverseEffects, transferEffects } from "@/lib/finance/ledger";
import { emiInputSchema } from "@/lib/validation/finance";
import type { Emi, EmiInput, EmiPayment, PaymentMethod } from "@/types";

import { expenseStatsDelta, mergeStatsDeltas } from "@/lib/stats/monthly";

import { type AccountExists, applyBalanceEffects } from "./balances";
import { applyStatsDeltas } from "./stats.service";
import { deleteParentThenChildren } from "./batch-delete";
import { emiConverter, emiPaymentConverter, expenseConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { emiDoc, emiPaymentDoc, emiPaymentsCol, emisCol, expensesCol, transferDoc } from "./paths";

type Unsubscribe = () => void;

export function subscribeEmis(
  uid: string,
  onData: (emis: Emi[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(emisCol(uid), orderBy("createdAt", "asc")).withConverter(emiConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

export function subscribeEmiPayments(
  uid: string,
  emiId: string,
  onData: (payments: EmiPayment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(emiPaymentsCol(uid, emiId), orderBy("installment", "desc")).withConverter(
    emiPaymentConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/** Outstanding principal after `paidCount` installments on the reducing balance. */
export function outstandingAfter(input: Pick<EmiInput, "principal" | "annualRateBps" | "monthlyAmount" | "tenureMonths">, paidCount: number): number {
  let outstanding = input.principal;
  for (let i = 0; i < paidCount && outstanding > 0; i++) {
    outstanding -= splitNextInstallment({ ...input, outstanding, paidCount: i }).principalPart;
  }
  return Math.max(outstanding, 0);
}

function termsFields(input: EmiInput) {
  const v = emiInputSchema.parse(input);
  return {
    name: v.name,
    lender: v.lender || null,
    principal: v.principal,
    annualRateBps: v.annualRateBps,
    monthlyAmount: v.monthlyAmount,
    tenureMonths: v.tenureMonths,
    startDate: Timestamp.fromDate(v.startDate),
  };
}

/**
 * Adds a loan. `alreadyPaid` supports loans that started before using the app: those
 * installments are counted as paid (without payment records) and the balance reduced.
 */
export function createEmi(uid: string, input: EmiInput, alreadyPaid = 0): PendingWrite {
  const ref = doc(emisCol(uid));
  const outstanding = outstandingAfter(input, alreadyPaid);
  const committed = setDoc(ref, {
    ...termsFields(input),
    paidCount: alreadyPaid,
    outstanding,
    status: alreadyPaid >= input.tenureMonths || outstanding === 0 ? "closed" : "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, committed };
}

export class EmiTermsLockedError extends Error {
  constructor() {
    super("Loan terms can't change after payments are recorded. You can still rename it.");
    this.name = "EmiTermsLockedError";
  }
}

/** Updates a loan. Financial terms are only editable while no payments are recorded. */
export async function updateEmi(uid: string, id: string, input: EmiInput): Promise<void> {
  const ref = emiDoc(uid, id).withConverter(emiConverter);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Loan not found");
    const current = snap.data();
    const terms = termsFields(input);
    const termsChanged =
      terms.principal !== current.principal ||
      terms.annualRateBps !== current.annualRateBps ||
      terms.monthlyAmount !== current.monthlyAmount ||
      terms.tenureMonths !== current.tenureMonths ||
      terms.startDate.toMillis() !== current.startDate.getTime();
    if (termsChanged && current.paidCount > 0) throw new EmiTermsLockedError();
    tx.update(emiDoc(uid, id), {
      ...terms,
      ...(termsChanged ? { outstanding: terms.principal } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export interface RecordPaymentOptions {
  paidAt: Date;
  /** Also add the installment to expenses (category "EMI") so it counts in spending/budgets. */
  logExpense: boolean;
  paymentMethod: PaymentMethod;
  /**
   * Account the installment is paid from. Recorded as a DEBT_PAYMENT that debits the
   * account; the optional expense is then *not* linked to the account, so the money
   * leaves the account exactly once.
   */
  accountId?: string | null;
}

/** Deterministic id of the DEBT_PAYMENT movement for an installment. */
export const emiTransferId = (emiId: string, installment: number) => `emi_${emiId}_${installment}`;

/**
 * Records the next installment atomically: payment document (id = installment number),
 * loan balance/paid count, and optionally the matching expense. The transaction re-reads
 * the loan so two devices can't record the same installment twice.
 */
export async function recordEmiPayment(
  uid: string,
  emiId: string,
  { paidAt, logExpense, paymentMethod, accountId = null }: RecordPaymentOptions,
): Promise<EmiPayment> {
  const loanRef = emiDoc(uid, emiId).withConverter(emiConverter);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(loanRef);
    if (!snap.exists()) throw new Error("Loan not found");
    const emi = snap.data();
    if (emi.status === "closed" || emi.paidCount >= emi.tenureMonths) {
      throw new Error("This loan is already fully paid.");
    }
    const installment = emi.paidCount + 1;
    const paymentRef = emiPaymentDoc(uid, emiId, installment);
    if ((await tx.get(paymentRef)).exists()) throw new Error("Installment already recorded.");

    const split = splitNextInstallment(emi);
    const dueDate = dueDateFor(emi.startDate, installment);
    const expenseRef = logExpense ? doc(expensesCol(uid)) : null;
    const outstanding = emi.outstanding - split.principalPart;
    const closed = installment >= emi.tenureMonths || outstanding <= 0;

    if (expenseRef) {
      tx.set(expenseRef, {
        amount: split.amount,
        categoryId: EMI_CATEGORY_ID,
        paymentMethod,
        note: `${emi.name} · EMI ${installment}/${emi.tenureMonths}`.slice(0, 280),
        occurredAt: Timestamp.fromDate(paidAt),
        type: "EXPENSE",
        accountId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      applyStatsDeltas(
        tx.set.bind(tx),
        uid,
        mergeStatsDeltas(
          expenseStatsDelta({ amount: split.amount, categoryId: EMI_CATEGORY_ID, paymentMethod, accountId: null, occurredAt: paidAt }, 1),
        ),
      );
    }
    if (accountId) {
      const transferId = emiTransferId(emiId, installment);
      tx.set(transferDoc(uid, transferId), {
        type: "DEBT_PAYMENT",
        amount: split.amount,
        fromAccountId: accountId,
        toAccountId: null,
        emiId,
        emiInstallment: installment,
        note: `${emi.name} · EMI ${installment}/${emi.tenureMonths}`.slice(0, 280),
        occurredAt: Timestamp.fromDate(paidAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      applyBalanceEffects(
        tx.update.bind(tx),
        uid,
        transferEffects({ amount: split.amount, fromAccountId: accountId, toAccountId: null }),
        transferId,
      );
    }
    tx.set(paymentRef, {
      installment,
      amount: split.amount,
      principalPart: split.principalPart,
      interestPart: split.interestPart,
      dueDate: Timestamp.fromDate(dueDate),
      paidAt: Timestamp.fromDate(paidAt),
      expenseId: expenseRef?.id ?? null,
      accountId,
      createdAt: serverTimestamp(),
    });
    tx.update(emiDoc(uid, emiId), {
      paidCount: installment,
      outstanding: Math.max(outstanding, 0),
      status: closed ? "closed" : "active",
      updatedAt: serverTimestamp(),
    });

    return { id: String(installment), installment, ...split, dueDate, paidAt, expenseId: expenseRef?.id ?? null, accountId };
  });
}

/** Reverses the most recent payment (and its logged expense) atomically. */
export async function undoLastEmiPayment(uid: string, emiId: string, options: { accountExists?: AccountExists } = {}): Promise<void> {
  const loanRef = emiDoc(uid, emiId).withConverter(emiConverter);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(loanRef);
    if (!snap.exists()) throw new Error("Loan not found");
    const emi = snap.data();
    const paymentRef = emiPaymentDoc(uid, emiId, emi.paidCount).withConverter(emiPaymentConverter);
    const paymentSnap = emi.paidCount > 0 ? await tx.get(paymentRef) : null;
    if (!paymentSnap?.exists()) {
      throw new Error("The latest installment was marked paid when the loan was added and has no record to undo.");
    }
    const payment = paymentSnap.data();
    // Read the linked expense before any write (transactions require reads first) so its
    // analytics contribution can be reversed exactly.
    const expenseSnap = payment.expenseId
      ? await tx.get(doc(expensesCol(uid), payment.expenseId).withConverter(expenseConverter))
      : null;
    if (payment.expenseId) tx.delete(doc(expensesCol(uid), payment.expenseId));
    if (expenseSnap?.exists()) {
      applyStatsDeltas(tx.set.bind(tx), uid, mergeStatsDeltas(expenseStatsDelta(expenseSnap.data(), -1)));
    }
    if (payment.accountId) {
      const transferId = emiTransferId(emiId, emi.paidCount);
      tx.delete(transferDoc(uid, transferId));
      applyBalanceEffects(
        tx.update.bind(tx),
        uid,
        reverseEffects(transferEffects({ amount: payment.amount, fromAccountId: payment.accountId, toAccountId: null })),
        transferId,
        options,
      );
    }
    tx.delete(emiPaymentDoc(uid, emiId, emi.paidCount));
    tx.update(emiDoc(uid, emiId), {
      paidCount: emi.paidCount - 1,
      outstanding: emi.outstanding + payment.principalPart,
      status: "active",
      updatedAt: serverTimestamp(),
    });
  });
}

/** Deletes a loan and its payment records. Expenses already logged are kept. */
export async function deleteEmi(uid: string, emiId: string): Promise<void> {
  const payments = await getDocs(emiPaymentsCol(uid, emiId));
  await deleteParentThenChildren(emiDoc(uid, emiId), payments.docs.map((p) => p.ref));
}
