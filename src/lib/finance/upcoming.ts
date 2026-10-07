import { addDays, isAfter, startOfDay } from "date-fns";

import { monthKey } from "@/lib/months";
import type { Account, Emi, Income, RecurringIncome, RecurringPayment } from "@/types";

import { cardCycle } from "./accounts";
import { emiOverview } from "./emi";
import { pendingRecurring } from "./income";
import { isOverdue, occurrencesUntil } from "./recurrence";

export type UpcomingItem =
  | { kind: "recurring"; id: string; date: Date; amount: number; overdue: boolean; payment: RecurringPayment; cycle: number }
  | { kind: "emi"; id: string; date: Date; amount: number; overdue: boolean; emi: Emi }
  | { kind: "card"; id: string; date: Date; amount: number; overdue: boolean; card: Account; minimumDue: number | null }
  | { kind: "income"; id: string; date: Date; amount: number; overdue: boolean; template: RecurringIncome; month: string };

export interface UpcomingInput {
  now?: Date;
  days?: number;
  recurringPayments: readonly RecurringPayment[];
  emis: readonly Emi[];
  accounts: readonly Account[];
  recurringIncomes: readonly RecurringIncome[];
  /** Incomes for the months the window spans (to skip already-recorded recurring income). */
  incomes: readonly Income[];
}

/** Everything due in the next `days` days (plus anything overdue), soonest first. */
export function buildUpcoming({
  now = new Date(),
  days = 30,
  recurringPayments,
  emis,
  accounts,
  recurringIncomes,
  incomes,
}: UpcomingInput): UpcomingItem[] {
  const until = addDays(startOfDay(now), days);
  const within = (date: Date) => !isAfter(startOfDay(date), until);
  const items: UpcomingItem[] = [];

  for (const payment of recurringPayments) {
    for (const { date, cycle } of occurrencesUntil(payment, until)) {
      items.push({ kind: "recurring", id: `rp-${payment.id}-${cycle}`, date, amount: payment.amount, overdue: isOverdue(date, now), payment, cycle });
    }
  }

  for (const emi of emis) {
    const o = emiOverview(emi, now);
    if (o.nextDueDate && within(o.nextDueDate)) {
      items.push({ kind: "emi", id: `emi-${emi.id}`, date: o.nextDueDate, amount: emi.monthlyAmount, overdue: o.isOverdue, emi });
    }
  }

  for (const card of accounts) {
    if (card.type !== "credit_card" || !card.active || !card.statementDay || !card.dueDay) continue;
    if (!card.statementBalance || card.statementBalance <= 0) continue;
    const { dueDate } = cardCycle(card.statementDay, card.dueDay, now);
    if (within(dueDate)) {
      items.push({ kind: "card", id: `card-${card.id}`, date: dueDate, amount: card.statementBalance, overdue: isOverdue(dueDate, now), card, minimumDue: card.minimumDue });
    }
  }

  const months = [...new Set([monthKey(now), monthKey(until)])];
  for (const month of months) {
    for (const expected of pendingRecurring(recurringIncomes, incomes, month)) {
      if (!within(expected.expectedAt)) continue;
      items.push({
        kind: "income",
        id: `inc-${expected.template.id}-${month}`,
        date: expected.expectedAt,
        amount: expected.template.amount,
        overdue: isOverdue(expected.expectedAt, now),
        template: expected.template,
        month,
      });
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Outgoing total (excludes expected income). */
export function upcomingOutflow(items: readonly UpcomingItem[]): number {
  return items.filter((i) => i.kind !== "income").reduce((s, i) => s + i.amount, 0);
}
