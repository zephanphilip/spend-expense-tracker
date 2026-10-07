import { addMonths, isAfter, startOfDay } from "date-fns";

import type { Account, AccountType } from "@/types";

export const isAssetType = (type: AccountType) => type !== "credit_card";

/** What you owe on a card (≥ 0). */
export function cardOutstanding(account: Pick<Account, "balance">): number {
  return Math.max(-account.balance, 0);
}

export function availableCredit(account: Pick<Account, "balance" | "creditLimit">): number | null {
  return account.creditLimit ? account.creditLimit - cardOutstanding(account) : null;
}

/** outstanding / limit (may exceed 1), or null without a limit. */
export function cardUtilization(account: Pick<Account, "balance" | "creditLimit">): number | null {
  return account.creditLimit ? cardOutstanding(account) / account.creditLimit : null;
}

function dayIn(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

export interface CardCycle {
  lastStatementDate: Date;
  nextStatementDate: Date;
  /** Due date for the latest statement. */
  dueDate: Date;
}

/**
 * Billing cycle from the statement and due days. The due date falls after the statement:
 * in the same month if dueDay > statementDay, otherwise in the following month.
 */
export function cardCycle(statementDay: number, dueDay: number, now: Date = new Date()): CardCycle {
  const today = startOfDay(now);
  let last = dayIn(today.getFullYear(), today.getMonth(), statementDay);
  if (isAfter(last, today)) {
    const prev = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -1);
    last = dayIn(prev.getFullYear(), prev.getMonth(), statementDay);
  }
  const nextBase = addMonths(new Date(last.getFullYear(), last.getMonth(), 1), 1);
  const next = dayIn(nextBase.getFullYear(), nextBase.getMonth(), statementDay);
  const dueBase = dueDay > statementDay ? last : nextBase;
  const due = dayIn(dueBase.getFullYear(), dueBase.getMonth(), dueDay);
  return { lastStatementDate: last, nextStatementDate: next, dueDate: due };
}

/** Typical Indian card rule: 5% of the statement, at least ₹200, never more than the statement. */
export function suggestedMinimumDue(statementBalance: number): number {
  if (statementBalance <= 0) return 0;
  return Math.min(statementBalance, Math.max(Math.round(statementBalance * 0.05), 20000));
}

/** After paying `amount`, how much of the statement and minimum due remain (never < 0). */
export function afterCardPayment(
  account: Pick<Account, "statementBalance" | "minimumDue">,
  amount: number,
): { statementBalance: number | null; minimumDue: number | null } {
  return {
    statementBalance: account.statementBalance === null ? null : Math.max(account.statementBalance - amount, 0),
    minimumDue: account.minimumDue === null ? null : Math.max(account.minimumDue - amount, 0),
  };
}
