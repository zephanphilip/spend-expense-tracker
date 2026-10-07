import { addDays, format, getDay, isAfter, startOfDay, startOfWeek } from "date-fns";

import { dayKey } from "@/lib/dates";
import { effectiveBudget, budgetProgress, type BudgetProgress } from "@/lib/finance/budget";
import { obligationsForMonth } from "@/lib/finance/emi";
import { monthlyEquivalent } from "@/lib/finance/recurrence";
import type { Counter, MonthlyStats } from "@/lib/stats/monthly";
import type { Budget, Emi, MonthKey, RecurringPayment } from "@/types";

import type { SpendData } from "./dataset";
import { eachDay, type Span } from "./period";

export interface Change {
  current: number;
  previous: number;
  delta: number;
  /** delta / previous, or null when previous is 0. */
  ratio: number | null;
}

export function change(current: number, previous: number): Change {
  return { current, previous, delta: current - previous, ratio: previous !== 0 ? (current - previous) / Math.abs(previous) : null };
}

export interface BreakdownRow {
  key: string;
  total: number;
  share: number;
  previous: number;
  change: Change;
}

/**
 * Ranked breakdown of a counter with previous-period comparison. Rows beyond `top` fold into
 * a single "__other__" row so charts never need more than top + 1 colours.
 */
export function breakdown(current: Counter, previous: Counter = {}, top = 6): BreakdownRow[] {
  const total = Object.values(current).reduce((s, v) => s + v, 0);
  const rows = Object.entries(current)
    .filter(([, v]) => v !== 0)
    .map(([key, v]) => ({ key, total: v, share: total ? v / total : 0, previous: previous[key] ?? 0, change: change(v, previous[key] ?? 0) }))
    .sort((a, b) => b.total - a.total);
  if (rows.length <= top + 1) return rows;
  const head = rows.slice(0, top);
  const tail = rows.slice(top);
  const otherTotal = tail.reduce((s, r) => s + r.total, 0);
  const otherPrev = tail.reduce((s, r) => s + r.previous, 0);
  return [...head, { key: "__other__", total: otherTotal, share: total ? otherTotal / total : 0, previous: otherPrev, change: change(otherTotal, otherPrev) }];
}

export interface DayPoint {
  date: Date;
  key: string;
  total: number;
}

export function dailySeries(spend: SpendData, span: Span): DayPoint[] {
  return eachDay(span).map((date) => ({ date, key: dayKey(date), total: spend.daily[dayKey(date)] ?? 0 }));
}

export interface WeekPoint {
  weekStart: Date;
  total: number;
  days: number;
}

/** Monday-start weeks; partial first/last weeks report how many days they cover. */
export function weeklySeries(days: readonly DayPoint[]): WeekPoint[] {
  const map = new Map<string, WeekPoint>();
  for (const d of days) {
    const ws = startOfWeek(d.date, { weekStartsOn: 1 });
    const key = dayKey(ws);
    const w = map.get(key) ?? { weekStart: ws, total: 0, days: 0 };
    w.total += d.total;
    w.days += 1;
    map.set(key, w);
  }
  return [...map.values()];
}

export interface WeekdayStat {
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  label: string;
  total: number;
  days: number;
  average: number;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Average spend per weekday, over the days that actually occurred in the span. */
export function weekdayPattern(days: readonly DayPoint[]): WeekdayStat[] {
  const stats = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, total: 0, days: 0, average: 0 }));
  for (const d of days) {
    const wd = (getDay(d.date) + 6) % 7;
    stats[wd].total += d.total;
    stats[wd].days += 1;
  }
  for (const s of stats) s.average = s.days ? Math.round(s.total / s.days) : 0;
  return stats;
}

export interface HeatCell {
  date: Date;
  key: string;
  total: number;
  /** 0 = no spend, 1–4 = relative intensity among non-zero days. */
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
}

/** Calendar heatmap: columns are Mon-start weeks, rows are weekdays; 4 levels by rank. */
export function heatmap(days: readonly DayPoint[]): HeatCell[][] {
  if (days.length === 0) return [];
  // Rank-based levels: the smallest spending day is always 1 and the largest always 4,
  // however few distinct values there are (ties share the lowest rank).
  const nonZero = days.map((d) => d.total).filter((v) => v > 0).sort((a, b) => a - b);
  const level = (v: number): HeatCell["level"] => {
    if (v <= 0) return 0;
    if (nonZero.length === 1) return 4;
    const rank = nonZero.indexOf(v);
    return (1 + Math.floor((3 * rank) / (nonZero.length - 1))) as HeatCell["level"];
  };
  const byKey = new Map(days.map((d) => [d.key, d]));
  const start = startOfWeek(days[0].date, { weekStartsOn: 1 });
  const last = days[days.length - 1].date;
  const weeks: HeatCell[][] = [];
  for (let ws = start; !isAfter(ws, last); ws = addDays(ws, 7)) {
    const week: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = startOfDay(addDays(ws, i));
      const key = dayKey(date);
      const d = byKey.get(key);
      week.push({ date, key, total: d?.total ?? 0, level: d ? level(d.total) : 0, inRange: Boolean(d) });
    }
    weeks.push(week);
  }
  return weeks;
}

export interface MonthPoint {
  month: MonthKey;
  label: string;
  expenses: number;
  income: number;
  savings: number;
  /** savings / income, or null without income. */
  savingsRate: number | null;
}

export function monthlySeries(months: readonly MonthKey[], stats: readonly MonthlyStats[]): MonthPoint[] {
  const byMonth = new Map(stats.map((s) => [s.month, s]));
  return months.map((month) => {
    const s = byMonth.get(month);
    const expenses = s?.expenseTotal ?? 0;
    const income = s?.incomeTotal ?? 0;
    return {
      month,
      label: format(new Date(`${month}-01T00:00:00`), "MMM"),
      expenses,
      income,
      savings: income - expenses,
      savingsRate: income > 0 ? (income - expenses) / income : null,
    };
  });
}

/** Per-month totals for the top categories across the months (others folded). */
export function categoryTrends(months: readonly MonthKey[], stats: readonly MonthlyStats[], top = 5) {
  const totals: Counter = {};
  for (const s of stats) for (const [k, v] of Object.entries(s.byCategory)) totals[k] = (totals[k] ?? 0) + v;
  const keys = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([k]) => k);
  const byMonth = new Map(stats.map((s) => [s.month, s]));
  const rows = months.map((month) => {
    const s = byMonth.get(month);
    const row: Record<string, number | string> = { month, label: format(new Date(`${month}-01T00:00:00`), "MMM") };
    let other = 0;
    for (const [k, v] of Object.entries(s?.byCategory ?? {})) {
      if (keys.includes(k)) row[k] = v;
      else other += v;
    }
    for (const k of keys) row[k] ??= 0;
    row.__other__ = other;
    return row;
  });
  return { keys, rows, hasOther: rows.some((r) => (r.__other__ as number) > 0) };
}

export interface BudgetMonth {
  month: MonthKey;
  overall: BudgetProgress | null;
  overCategories: { categoryId: string; progress: BudgetProgress }[];
}

/** Budget utilisation per month in the period, from aggregates. */
export function budgetUtilization(months: readonly MonthKey[], stats: readonly MonthlyStats[], budgets: readonly Budget[]): BudgetMonth[] {
  const byMonth = new Map(stats.map((s) => [s.month, s]));
  return months.map((month) => {
    const b = effectiveBudget(budgets, month)?.budget;
    const s = byMonth.get(month);
    const spent = s?.expenseTotal ?? 0;
    const overCategories = Object.entries(b?.categories ?? {})
      .map(([categoryId, limit]) => ({ categoryId, progress: budgetProgress(limit, s?.byCategory[categoryId] ?? 0) }))
      .filter((c) => c.progress.state === "over")
      .sort((a, b2) => b2.progress.ratio - a.progress.ratio);
    return { month, overall: b?.overall ? budgetProgress(b.overall, spent) : null, overCategories };
  });
}

export interface Burden {
  monthly: number;
  /** monthly / average monthly income, or null without income. */
  ofIncome: number | null;
}

export const averageIncome = (series: readonly MonthPoint[]) => {
  const withIncome = series.filter((m) => m.income > 0);
  return withIncome.length ? Math.round(withIncome.reduce((s, m) => s + m.income, 0) / withIncome.length) : 0;
};

/** EMI obligations for a month relative to income. */
export function emiBurden(emis: readonly Emi[], month: MonthKey, income: number): Burden {
  const monthly = obligationsForMonth(emis, month).total;
  return { monthly, ofIncome: income > 0 ? monthly / income : null };
}

export interface SubscriptionCost {
  payment: RecurringPayment;
  monthly: number;
  annual: number;
}

/** Active recurring payments with monthly and annualised cost, most expensive first. */
export function subscriptionCosts(payments: readonly RecurringPayment[]): { items: SubscriptionCost[]; monthly: number; annual: number } {
  const items = payments
    .filter((p) => p.active)
    .map((payment) => {
      const monthly = monthlyEquivalent(payment);
      return { payment, monthly, annual: monthly * 12 };
    })
    .sort((a, b) => b.annual - a.annual);
  const monthly = items.reduce((s, i) => s + i.monthly, 0);
  return { items, monthly, annual: monthly * 12 };
}

export function recurringBurden(payments: readonly RecurringPayment[], income: number): Burden {
  const { monthly } = subscriptionCosts(payments);
  return { monthly, ofIncome: income > 0 ? monthly / income : null };
}
