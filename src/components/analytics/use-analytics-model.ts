"use client";

import { format } from "date-fns";
import { useMemo } from "react";

import { useNetWorth } from "@/components/net-worth/use-net-worth";
import { type AnalyticsFilters, hasFilters, type SpendData } from "@/lib/analytics/dataset";
import { buildInsights } from "@/lib/analytics/insights";
import {
  averageIncome,
  breakdown,
  budgetUtilization,
  categoryTrends,
  change,
  dailySeries,
  type DayPoint,
  emiBurden,
  heatmap,
  monthlySeries,
  recurringBurden,
  subscriptionCosts,
  weekdayPattern,
  weeklySeries,
} from "@/lib/analytics/metrics";
import type { ResolvedPeriod } from "@/lib/analytics/period";
import { monthKey, recentMonths } from "@/lib/months";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";

import type { TrendPoint } from "./charts";
import { useAnalytics } from "./use-analytics";

/** Groups daily points into buckets (week/month) keeping order, for trend charts. */
function bucket(days: readonly DayPoint[], keyOf: (d: Date) => string, labelOf: (d: Date) => string, titleOf: (d: Date) => string) {
  const out: { key: string; label: string; title: string; total: number }[] = [];
  for (const d of days) {
    const key = keyOf(d.date);
    const last = out.at(-1);
    if (last?.key === key) last.total += d.total;
    else out.push({ key, label: labelOf(d.date), title: titleOf(d.date), total: d.total });
  }
  return out;
}

export type TrendGranularity = "day" | "week" | "month";

/** Groupings that make sense for a span of `days` days (≤ ~150 bars, ≥ 2 buckets). */
export function granularitiesFor(days: number): TrendGranularity[] {
  const out: TrendGranularity[] = [];
  if (days <= 92) out.push("day");
  if (days >= 14) out.push("week");
  if (days >= 45) out.push("month");
  return out.length ? out : ["day"];
}

export function autoGranularity(days: number): TrendGranularity {
  return days <= 62 ? "day" : days <= 190 ? "week" : "month";
}

export function trendPoints(cur: DayPoint[], prev: DayPoint[], granularity: TrendGranularity = autoGranularity(cur.length)): { points: TrendPoint[]; granularity: TrendGranularity } {
  const group = (days: DayPoint[]) =>
    granularity === "day"
      ? days.map((d) => ({ key: d.key, label: format(d.date, "d"), title: format(d.date, "EEE d MMM"), total: d.total }))
      : granularity === "week"
        ? bucket(days, (d) => format(d, "RRRR-II"), (d) => format(d, "d MMM"), (d) => `Week of ${format(d, "d MMM")}`)
        : bucket(days, (d) => format(d, "yyyy-MM"), (d) => format(d, "MMM"), (d) => format(d, "MMMM yyyy"));
  const c = group(cur);
  const p = group(prev);
  return { granularity, points: c.map((x, i) => ({ key: x.key, label: x.label, title: x.title, current: x.total, previous: p[i]?.total })) };
}

/** Month totals within the period (filters respected), for long periods. */
export function monthTotals(days: readonly DayPoint[]) {
  return bucket(days, (d) => format(d, "yyyy-MM"), (d) => format(d, "MMM"), (d) => format(d, "MMMM yyyy"));
}

/** Headline numbers for the period: averages, extremes and habits. */
export function periodSummary(days: readonly DayPoint[], total: number, count: number) {
  const elapsed = Math.max(days.length, 1);
  let busiest: DayPoint | null = null;
  let noSpendDays = 0;
  for (const d of days) {
    if (d.total === 0) noSpendDays++;
    else if (!busiest || d.total > busiest.total) busiest = d;
  }
  const round = (v: number) => Math.round(v / 100) * 100; // whole currency units
  return {
    perWeek: elapsed >= 7 ? round((total / elapsed) * 7) : null,
    perMonth: elapsed >= 28 ? round((total / elapsed) * (365.25 / 12)) : null,
    perTransaction: count ? round(total / count) : null,
    busiest,
    noSpendDays,
    spendDays: days.length - noSpendDays,
  };
}

export function useAnalyticsModel(period: ResolvedPeriod, filters: AnalyticsFilters) {
  const { currency } = useSession();
  const data = useAnalytics(period, filters);
  const finance = useFinance();
  const accounts = useAccounts();
  const { getCategory } = useCategories();
  const nw = useNetWorth();

  const model = useMemo(() => {
    const current: SpendData = data.current;
    const previous: SpendData = data.previous;
    const curSpan = { from: period.from, to: period.elapsedTo };
    const days = dailySeries(current, curSpan);
    const prevDays = dailySeries(previous, period.previous);
    const summary = periodSummary(days, current.total, current.count);
    const months = monthTotals(days);
    const filtered = hasFilters(filters);

    const statsMonths = period.months.filter((m) => m <= data.endMonth);
    const byMonth = new Map(data.stats.map((s) => [s.month, s]));
    const income = statsMonths.reduce((s, m) => s + (byMonth.get(m)?.incomeTotal ?? 0), 0);
    const months12 = monthlySeries(recentMonths(data.endMonth, 12), data.stats);
    const avgIncome = averageIncome(months12.slice(-6));
    const savings = income - current.total;

    // Baseline for "unusual" category spend: average of the 3 months before the period.
    const baselineMonths = recentMonths(monthKey(new Date(period.from.getFullYear(), period.from.getMonth() - 1, 1)), 3);
    const perMonth: Record<string, number> = {};
    let haveBaseline = 0;
    for (const m of baselineMonths) {
      const s = byMonth.get(m);
      if (!s || s.expenseCount === 0) continue;
      haveBaseline++;
      for (const [k, v] of Object.entries(s.byCategory)) perMonth[k] = (perMonth[k] ?? 0) + v;
    }
    for (const k of Object.keys(perMonth)) perMonth[k] = perMonth[k] / Math.max(haveBaseline, 1);

    const trendMonths = statsMonths.length >= 3 ? statsMonths : recentMonths(data.endMonth, 6);
    const budgets = budgetUtilization(statsMonths, data.stats, finance.budgets.data ?? []);
    const recurring = recurringBurden(finance.recurringPayments.data ?? [], avgIncome);
    const emi = emiBurden(finance.emis.data ?? [], monthKey(new Date()), avgIncome);
    const cards = accounts.all.filter((a) => a.type === "credit_card" && a.active);
    const weekdays = weekdayPattern(days);
    const spending = change(current.total, previous.total);

    const insights = buildInsights({
      currency,
      periodLabel: period.phrase,
      previousLabel: period.previous.label,
      spending,
      current,
      categoryBaseline: { months: haveBaseline, perMonth },
      periodMonths: Math.max(statsMonths.length, 1),
      categoryName: (id) => getCategory(id).name,
      budgets,
      months: months12.filter((m) => m.month < monthKey(new Date())),
      recurring,
      emi,
      cards,
      weekdays,
    });

    return {
      filtered,
      current,
      previous,
      spending,
      // Averages are shown in whole currency units.
      avgPerDay: Math.round(current.total / period.elapsedDays / 100) * 100,
      prevAvgPerDay: Math.round(previous.total / Math.max(prevDays.length, 1) / 100) * 100,
      days,
      prevDays,
      summary,
      months,
      weekly: weeklySeries(days),
      weekdays,
      heat: heatmap(days),
      categories: breakdown(current.byCategory, previous.byCategory, 6),
      methods: breakdown(current.byPaymentMethod, previous.byPaymentMethod, 6),
      accountsBreakdown: breakdown(current.byAccount, previous.byAccount, 6),
      income,
      savings,
      savingsRate: income > 0 ? savings / income : null,
      months12,
      avgIncome,
      categoryTrend: categoryTrends(trendMonths, data.stats.filter((s) => trendMonths.includes(s.month)), 5),
      budgets,
      recurring,
      emi,
      subscriptions: subscriptionCosts(finance.recurringPayments.data ?? []),
      cards,
      insights,
    };
  }, [data, period, filters, finance.budgets.data, finance.recurringPayments.data, finance.emis.data, accounts.all, getCategory, currency]);

  return { ...data, model, netWorth: nw };
}
