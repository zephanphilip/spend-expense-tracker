"use client";

import { useMemo } from "react";

import { useMonthlyStats } from "@/hooks/use-monthly-stats";
import { effectiveBudget } from "@/lib/finance/budget";
import { monthSummary, type MonthSummary } from "@/lib/finance/summary";
import { recentMonths } from "@/lib/months";
import { useFinance } from "@/providers/finance-provider";
import type { MonthKey } from "@/types";

/**
 * Summaries for the `count` months ending at `endMonth` (oldest first), from the monthly
 * aggregates — one document per month instead of every expense and income.
 */
export function useMonthSummaries(endMonth: MonthKey, count: number) {
  const months = recentMonths(endMonth, count);
  const stats = useMonthlyStats(months[0], endMonth);
  const { budgets, emis } = useFinance();

  const ready = stats.status === "success" && budgets.status === "success" && emis.status === "success";
  const error = stats.error ?? budgets.error ?? emis.error ?? null;
  const monthsKey = months.join(",");

  const summaries = useMemo<MonthSummary[] | null>(() => {
    if (!ready) return null;
    return monthsKey.split(",").map((month) => {
      const s = stats.get(month);
      return monthSummary({
        month,
        incomes: [{ amount: s.incomeTotal, forMonth: month }],
        spent: s.expenseTotal,
        budget: effectiveBudget(budgets.data ?? [], month)?.budget ?? null,
        emis: emis.data ?? [],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `get` derives from stats.stats
  }, [ready, monthsKey, stats.stats, budgets.data, emis.data]);

  return {
    status: error ? ("error" as const) : summaries ? ("success" as const) : ("loading" as const),
    error,
    retry: () => {
      stats.retry();
      budgets.retry();
      emis.retry();
    },
    summaries,
    /** Income by source for a month (from the aggregate). */
    incomeBySource: (month: MonthKey) => stats.get(month).incomeBySource,
  };
}
