import { endOfDay, isAfter } from "date-fns";

import { monthKey, monthsBetween, shiftMonth } from "@/lib/months";
import type { Income, MonthKey, RecurringIncome, RecurringPayment } from "@/types";

import { pendingRecurring } from "./income";
import { occurrencesUntil } from "./recurrence";

/** Hard cap per run so a long-unopened app can't generate a runaway batch in one go. */
export const MAX_AUTOMATION_STEPS = 24;

export interface PlannedPayment {
  payment: RecurringPayment;
  cycle: number;
  date: Date;
}

/**
 * Occurrences of auto-pay schedules that are due (on or before today), in order.
 * Each is identified by (paymentId, cycle) — the same key the expense id is derived from —
 * so executing a plan twice can never create a duplicate.
 */
export function planRecurringPayments(payments: readonly RecurringPayment[], now: Date = new Date(), max = MAX_AUTOMATION_STEPS): PlannedPayment[] {
  const today = endOfDay(now);
  const plan: PlannedPayment[] = [];
  for (const payment of payments) {
    if (!payment.active || !payment.autoPay) continue;
    for (const { date, cycle } of occurrencesUntil(payment, today, max)) {
      if (isAfter(date, today)) break;
      plan.push({ payment, cycle, date });
    }
  }
  return plan.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, max);
}

export interface PlannedIncome {
  template: RecurringIncome;
  month: MonthKey;
  date: Date;
}

/**
 * Auto-record incomes expected on or before today, looking back `lookbackMonths` (so an
 * app opened after a few weeks still catches up). Deterministic ids make this idempotent.
 */
export function planRecurringIncomes(
  templates: readonly RecurringIncome[],
  incomes: readonly Income[],
  now: Date = new Date(),
  lookbackMonths = 2,
): PlannedIncome[] {
  const auto = templates.filter((t) => t.active && t.autoRecord);
  const current = monthKey(now);
  const months = monthsBetween(shiftMonth(current, -lookbackMonths), current);
  const today = endOfDay(now);
  return months
    .flatMap((month) =>
      pendingRecurring(auto, incomes, month)
        .filter((e) => !isAfter(e.expectedAt, today))
        .map((e) => ({ template: e.template, month, date: e.expectedAt })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
