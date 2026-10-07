import { addMonths, isBefore, startOfDay } from "date-fns";

import { monthKey } from "@/lib/months";
import type { Emi, MonthKey } from "@/types";

const monthlyRate = (annualRateBps: number) => annualRateBps / 10_000 / 12;

/** Standard reducing-balance EMI, rounded to the nearest minor unit. */
export function computeEmi(principal: number, annualRateBps: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = monthlyRate(annualRateBps);
  if (r === 0) return Math.ceil(principal / tenureMonths);
  const growth = (1 + r) ** tenureMonths;
  return Math.round((principal * r * growth) / (growth - 1));
}

export interface InstallmentSplit {
  amount: number;
  principalPart: number;
  interestPart: number;
}

/**
 * Splits the next installment into interest and principal on the reducing balance.
 * The final installment clears whatever is outstanding so rounding never leaves dust.
 */
export function splitNextInstallment(emi: Pick<Emi, "outstanding" | "annualRateBps" | "monthlyAmount" | "paidCount" | "tenureMonths">): InstallmentSplit {
  const interestPart = Math.max(0, Math.round(emi.outstanding * monthlyRate(emi.annualRateBps)));
  const isLast = emi.paidCount + 1 >= emi.tenureMonths;
  const principalPart = isLast
    ? emi.outstanding
    : Math.min(Math.max(emi.monthlyAmount - interestPart, 0), emi.outstanding);
  return { amount: principalPart + interestPart, principalPart, interestPart };
}

export function dueDateFor(startDate: Date, installment: number): Date {
  return addMonths(startDate, installment - 1);
}

export interface EmiOverview {
  nextDueDate: Date | null;
  endDate: Date;
  remainingTenure: number;
  /** 0..1 by installments paid. */
  progress: number;
  principalRepaid: number;
  /** Estimated total interest over the loan (monthly × tenure − principal). */
  totalInterest: number;
  totalPayable: number;
  isOverdue: boolean;
  isClosed: boolean;
}

export function emiOverview(emi: Emi, now: Date = new Date()): EmiOverview {
  const isClosed = emi.status === "closed" || emi.paidCount >= emi.tenureMonths || emi.outstanding <= 0;
  const nextDueDate = isClosed ? null : dueDateFor(emi.startDate, emi.paidCount + 1);
  const totalPayable = emi.monthlyAmount * emi.tenureMonths;
  return {
    nextDueDate,
    endDate: dueDateFor(emi.startDate, emi.tenureMonths),
    remainingTenure: Math.max(emi.tenureMonths - emi.paidCount, 0),
    progress: emi.tenureMonths > 0 ? Math.min(emi.paidCount / emi.tenureMonths, 1) : 0,
    principalRepaid: emi.principal - emi.outstanding,
    totalInterest: Math.max(totalPayable - emi.principal, 0),
    totalPayable,
    isOverdue: nextDueDate !== null && isBefore(nextDueDate, startOfDay(now)),
    isClosed,
  };
}

export interface MonthObligation {
  emi: Emi;
  installment: number;
  dueDate: Date;
  amount: number;
  paid: boolean;
}

/** The installment of `emi` that falls due in `month`, if any. */
export function obligationForMonth(emi: Emi, month: MonthKey): MonthObligation | null {
  const startKey = monthKey(emi.startDate);
  if (month < startKey) return null;
  const [y1, m1] = startKey.split("-").map(Number);
  const [y2, m2] = month.split("-").map(Number);
  const installment = (y2 - y1) * 12 + (m2 - m1) + 1;
  if (installment > emi.tenureMonths) return null;
  return {
    emi,
    installment,
    dueDate: dueDateFor(emi.startDate, installment),
    amount: emi.monthlyAmount,
    paid: installment <= emi.paidCount,
  };
}

export function obligationsForMonth(emis: readonly Emi[], month: MonthKey) {
  const items = emis
    .map((emi) => obligationForMonth(emi, month))
    .filter((o): o is MonthObligation => o !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const total = items.reduce((s, o) => s + o.amount, 0);
  const paid = items.filter((o) => o.paid).reduce((s, o) => s + o.amount, 0);
  return { items, total, paid, pending: total - paid };
}
