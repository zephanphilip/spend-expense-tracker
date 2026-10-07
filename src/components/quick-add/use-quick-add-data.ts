"use client";

import { useEffect, useMemo, useRef } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import { effectiveBudget } from "@/lib/finance/budget";
import { monthKey } from "@/lib/months";
import { subscribeAccounts } from "@/lib/services/account.service";
import { subscribeBudgets } from "@/lib/services/budget.service";
import { subscribeMonthlyStats } from "@/lib/services/stats.service";
import type { MonthlyStats } from "@/lib/stats/monthly";
import { useSession } from "@/providers/auth-provider";
import type { Account, Budget } from "@/types";

/**
 * Only what Quick Add needs, nothing from the dashboard: accounts (to charge the usual
 * account for a payment method), budgets and this month's per-category totals (for "₹x left"
 * hints). Three small listeners, all served from the offline cache first.
 *
 * The hints come from the monthly aggregate; the number shown after saving is recomputed
 * from the expenses themselves (calculateCategoryBudgetStatus).
 */
export function useQuickAddData() {
  const { user } = useSession();
  const uid = user.uid;
  const month = monthKey(new Date());
  const accounts = useLiveQuery<Account[]>(`qa-accounts:${uid}`, (ok, fail) => subscribeAccounts(uid, ok, fail));
  const budgets = useLiveQuery<Budget[]>(`qa-budgets:${uid}`, (ok, fail) => subscribeBudgets(uid, ok, fail));
  const stats = useLiveQuery<MonthlyStats[]>(`qa-stats:${uid}:${month}`, (ok, fail) =>
    subscribeMonthlyStats(uid, month, month, ok, fail),
  );

  // Saving may start before the accounts listener answers (cold start, slow network): let
  // the save wait briefly for it instead of silently skipping the account.
  const accountsRef = useRef<{ list: Account[]; ready: boolean }>({ list: [], ready: false });
  useEffect(() => {
    accountsRef.current = { list: accounts.data ?? [], ready: accounts.status !== "loading" };
  }, [accounts.data, accounts.status]);

  const remainingByCategory = useMemo(() => {
    const out = new Map<string, number>();
    const budget = budgets.data ? effectiveBudget(budgets.data, month)?.budget : null;
    if (!budget) return out;
    const spent = stats.data?.[0]?.byCategory ?? {};
    for (const [id, limit] of Object.entries(budget.categories)) out.set(id, limit - (spent[id] ?? 0));
    return out;
  }, [budgets.data, stats.data, month]);

  return {
    remainingByCategory,
    /** Resolves with the accounts once loaded (or after `timeoutMs`, with whatever is known). */
    async accountsForSave(timeoutMs = 2000): Promise<Account[]> {
      const started = Date.now();
      while (!accountsRef.current.ready && Date.now() - started < timeoutMs) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return accountsRef.current.list;
    },
  };
}
