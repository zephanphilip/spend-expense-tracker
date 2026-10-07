import { endOfDay, isSameDay, isSameMonth, startOfDay, subDays } from "date-fns";

import { dayKey } from "@/lib/dates";
import type { Expense } from "@/types";

export function sumAmounts(expenses: readonly Pick<Expense, "amount">[]): number {
  return expenses.reduce((total, e) => total + e.amount, 0);
}

export interface CategoryTotal {
  categoryId: string;
  total: number;
  count: number;
  /** 0..1 share of the overall total. */
  share: number;
}

export function totalsByCategory(expenses: readonly Expense[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const entry = map.get(e.categoryId) ?? { total: 0, count: 0 };
    entry.total += e.amount;
    entry.count += 1;
    map.set(e.categoryId, entry);
  }
  const grand = sumAmounts(expenses);
  return [...map.entries()]
    .map(([categoryId, { total, count }]) => ({
      categoryId,
      total,
      count,
      share: grand > 0 ? total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface DailyTotal {
  date: Date;
  total: number;
  count: number;
}

/** Totals for each of the `days` days ending on `end` (inclusive), oldest first. */
export function dailyTotals(
  expenses: readonly Expense[],
  days: number,
  end: Date = new Date(),
): DailyTotal[] {
  const buckets = new Map<string, DailyTotal>();
  const result: DailyTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(subDays(end, i));
    const bucket = { date, total: 0, count: 0 };
    buckets.set(dayKey(date), bucket);
    result.push(bucket);
  }
  for (const e of expenses) {
    const bucket = buckets.get(dayKey(e.occurredAt));
    if (bucket) {
      bucket.total += e.amount;
      bucket.count += 1;
    }
  }
  return result;
}

export interface DayGroup {
  key: string;
  date: Date;
  total: number;
  items: Expense[];
}

/** Groups expenses (assumed sorted newest first) into consecutive day buckets. */
export function groupByDay(expenses: readonly Expense[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of expenses) {
    const key = dayKey(e.occurredAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, date: startOfDay(e.occurredAt), total: 0, items: [] };
      groups.push(group);
    }
    group.items.push(e);
    group.total += e.amount;
  }
  return groups;
}

export interface DashboardSummary {
  today: number;
  todayCount: number;
  month: number;
  monthCount: number;
  /** Month total divided by the days elapsed so far this month. */
  dailyAverage: number;
  byCategory: CategoryTotal[];
  last7Days: DailyTotal[];
}

export function summarizeDashboard(
  expenses: readonly Expense[],
  now: Date = new Date(),
): DashboardSummary {
  const monthExpenses = expenses.filter((e) => isSameMonth(e.occurredAt, now));
  const todayExpenses = expenses.filter((e) => isSameDay(e.occurredAt, now));
  const month = sumAmounts(monthExpenses);
  // Only count spend up to today in the average so future-dated entries don't skew it.
  const monthToDate = sumAmounts(monthExpenses.filter((e) => e.occurredAt <= endOfDay(now)));
  return {
    today: sumAmounts(todayExpenses),
    todayCount: todayExpenses.length,
    month,
    monthCount: monthExpenses.length,
    dailyAverage: Math.round(monthToDate / now.getDate()),
    byCategory: totalsByCategory(monthExpenses),
    last7Days: dailyTotals(expenses, 7, now),
  };
}
