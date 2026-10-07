import { differenceInCalendarDays } from "date-fns";

import { dayInMonth } from "@/lib/months";
import type { Income, MonthKey, RecurringIncome } from "@/types";

/** Deterministic id so a recurring income can only be recorded once per month. */
export function recurringIncomeId(recurringId: string, month: MonthKey): string {
  return `${recurringId}_${month}`;
}

export interface ExpectedIncome {
  template: RecurringIncome;
  month: MonthKey;
  expectedAt: Date;
}

/** Active recurring incomes for `month` that haven't been recorded yet. */
export function pendingRecurring(
  templates: readonly RecurringIncome[],
  incomes: readonly Income[],
  month: MonthKey,
): ExpectedIncome[] {
  const recorded = new Set(
    incomes.filter((i) => i.recurringId && i.forMonth === month).map((i) => i.recurringId),
  );
  return templates
    .filter((t) => t.active && t.startMonth <= month && !recorded.has(t.id))
    .map((template) => ({ template, month, expectedAt: dayInMonth(month, template.dayOfMonth) }))
    .sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime());
}

export interface SalaryMonth {
  month: MonthKey;
  total: number;
  records: Income[];
  expectedAt: Date | null;
  receivedAt: Date;
  /** Positive = days late, negative = early, null if no expected date. */
  daysLate: number | null;
}

export interface SalaryStats {
  months: SalaryMonth[];
  latest: SalaryMonth | null;
  average: number;
  /** Change vs the previous month's salary, as a ratio (0.1 = +10%). */
  changeFromPrevious: number | null;
  /** Change from the earliest to the latest recorded month. */
  growthOverall: number | null;
}

/** Aggregates salary incomes by the month they're for, newest first. */
export function salaryStats(incomes: readonly Income[]): SalaryStats {
  const byMonth = new Map<MonthKey, Income[]>();
  for (const income of incomes) {
    if (income.source !== "salary") continue;
    const list = byMonth.get(income.forMonth) ?? [];
    list.push(income);
    byMonth.set(income.forMonth, list);
  }
  const months: SalaryMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, records]) => {
      const sorted = [...records].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      const first = sorted[0];
      const expectedAt = sorted.find((r) => r.expectedAt)?.expectedAt ?? null;
      return {
        month,
        records: sorted,
        total: sorted.reduce((s, r) => s + r.amount, 0),
        expectedAt,
        receivedAt: first.receivedAt,
        daysLate: expectedAt ? differenceInCalendarDays(first.receivedAt, expectedAt) : null,
      };
    });

  const ratio = (to: number, from: number) => (from > 0 ? (to - from) / from : null);
  const latest = months[0] ?? null;
  return {
    months,
    latest,
    average: months.length ? Math.round(months.reduce((s, m) => s + m.total, 0) / months.length) : 0,
    changeFromPrevious: months.length > 1 ? ratio(months[0].total, months[1].total) : null,
    growthOverall: months.length > 1 ? ratio(months[0].total, months[months.length - 1].total) : null,
  };
}
