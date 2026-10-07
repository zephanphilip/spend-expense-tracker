"use client";

import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import { useMonthlyStats } from "@/hooks/use-monthly-stats";
import { type AnalyticsFilters, canUseAggregates, spendFromExpenses, spendFromStats } from "@/lib/analytics/dataset";
import type { ResolvedPeriod } from "@/lib/analytics/period";
import { monthKey, shiftMonth } from "@/lib/months";
import { subscribeToExpenses } from "@/lib/services/expense.service";
import { useSession } from "@/providers/auth-provider";
import type { Expense } from "@/types";

/** Cap for raw-row windows (filtered/custom views); flagged in the UI if reached. */
export const RAW_LIMIT = 5000;

const minKey = (...keys: string[]) => keys.reduce((a, b) => (a < b ? a : b));

/**
 * Loads exactly what the selected period needs:
 *  - monthly aggregates for the trend window (≤ ~24 small docs; see useMonthlyStats);
 *  - raw expenses only for spans aggregates can't answer exactly (filters, custom ranges,
 *    or the partial previous month when the current one is in progress).
 */
export function useAnalytics(period: ResolvedPeriod, filters: AnalyticsFilters) {
  const { user } = useSession();
  const uid = user.uid;
  const currentMonth = monthKey(new Date());
  const endMonth = minKey(monthKey(period.to), currentMonth);
  const startMonth = minKey(monthKey(period.previous.from), shiftMonth(monthKey(period.from), -3), shiftMonth(endMonth, -11));

  const statsQuery = useMonthlyStats(startMonth, endMonth);
  const { rebuilding } = statsQuery;

  const curSpan = { from: period.from, to: period.to };
  const prevSpan = { from: period.previous.from, to: period.previous.to };
  const curAgg = canUseAggregates(curSpan, filters);
  const prevAgg = canUseAggregates(prevSpan, filters);
  const rawFrom = !prevAgg ? prevSpan.from : !curAgg ? curSpan.from : null;
  const rawTo = !curAgg ? curSpan.to : !prevAgg ? prevSpan.to : null;
  const rawKey = rawFrom && rawTo ? `raw:${uid}:${rawFrom.getTime()}:${rawTo.getTime()}` : null;
  const raw = useLiveQuery<{ items: Expense[]; hasMore: boolean }>(rawKey, (ok, fail) =>
    subscribeToExpenses(uid, { from: rawFrom!, to: rawTo!, limit: RAW_LIMIT }, (items, meta) => ok({ items, hasMore: meta.hasMore }), fail),
  );

  const statsList = statsQuery.stats;
  const rawItems = useMemo(() => raw.data?.items ?? [], [raw.data]);
  const filterKey = JSON.stringify(filters);
  const ready = statsQuery.status === "success" && (rawKey === null || raw.status === "success");

  const { current, previous } = useMemo(() => {
    const f = JSON.parse(filterKey) as AnalyticsFilters;
    return {
      current: curAgg ? spendFromStats(statsList, curSpan) : spendFromExpenses(rawItems, curSpan, f),
      previous: prevAgg ? spendFromStats(statsList, prevSpan) : spendFromExpenses(rawItems, prevSpan, f),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spans derive from `period`
  }, [statsList, rawItems, curAgg, prevAgg, filterKey, period]);

  return {
    status: statsQuery.error || raw.error ? ("error" as const) : ready ? ("success" as const) : ("loading" as const),
    error: statsQuery.error ?? raw.error,
    retry: () => {
      statsQuery.retry();
      raw.retry();
    },
    rebuilding,
    current,
    previous,
    stats: statsList,
    usedAggregates: curAgg,
    truncated: Boolean(raw.data?.hasMore),
    endMonth,
  };
}
