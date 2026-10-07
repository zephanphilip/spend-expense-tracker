"use client";

import { useEffect, useMemo, useRef } from "react";

import { useUpcoming } from "@/components/upcoming/use-upcoming";
import { budgetProgress, effectiveBudget } from "@/lib/finance/budget";
import { buildReminders, DEFAULT_REMINDER_PREFS, type ReminderPrefs } from "@/lib/finance/reminders";
import { formatMoney } from "@/lib/money";
import { monthKey } from "@/lib/months";
import { rebuildMonthlyStats, subscribeMonthlyStats } from "@/lib/services/stats.service";
import { type MonthlyStats, STATS_VERSION } from "@/lib/stats/monthly";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import { useFinance } from "@/providers/finance-provider";

import { useLiveQuery } from "./use-live-query";
import { useLocalPreference } from "./use-local-preference";

export const REMINDER_PREFS_KEY = "ledger:reminder-prefs";

export function useReminderPrefs() {
  return useLocalPreference<ReminderPrefs>(REMINDER_PREFS_KEY, DEFAULT_REMINDER_PREFS);
}

/** Current reminders: due items within the lead time + budget warnings for this month. */
export function useReminders() {
  const { user, currency } = useSession();
  const [prefs] = useReminderPrefs();
  const upcoming = useUpcoming(Math.max(prefs.leadDays, 0) + 1);
  const { budgets } = useFinance();
  const { getCategory } = useCategories();
  const month = monthKey(new Date());
  // Budget warnings read this month's single aggregate document (not every expense).
  const stats = useLiveQuery<MonthlyStats[]>(`reminder-stats:${user.uid}:${month}`, (ok, fail) => subscribeMonthlyStats(user.uid, month, month, ok, fail));
  const rebuilt = useRef(false);
  const current = stats.data?.[0];
  useEffect(() => {
    if (stats.status === "success" && current?.version !== STATS_VERSION && !rebuilt.current) {
      rebuilt.current = true;
      void rebuildMonthlyStats(user.uid, [month]).catch(() => undefined);
    }
  }, [stats.status, current?.version, user.uid, month]);

  const reminders = useMemo(() => {
    const b = budgets.data ? effectiveBudget(budgets.data, month)?.budget : null;
    const spent = current?.version === STATS_VERSION ? current : null;
    return buildReminders({
      upcoming: upcoming.items,
      budget:
        b && spent
          ? {
              month,
              overall: b.overall ? budgetProgress(b.overall, spent.expenseTotal) : null,
              categories: Object.entries(b.categories).map(([id, limit]) => ({ name: getCategory(id).name, progress: budgetProgress(limit, spent.byCategory[id] ?? 0) })),
            }
          : null,
      prefs,
      format: (m) => formatMoney(m, currency),
    });
  }, [upcoming.items, budgets.data, current, month, prefs, getCategory, currency]);

  return { reminders, ready: upcoming.status === "success" };
}
