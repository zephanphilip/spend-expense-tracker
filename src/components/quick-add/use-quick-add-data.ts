"use client";

import { useEffect, useMemo, useRef } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import { effectiveBudget } from "@/lib/finance/budget";
import { monthKey } from "@/lib/months";
import { subscribeAccounts } from "@/lib/services/account.service";
import { subscribeBudgets } from "@/lib/services/budget.service";
import { subscribeMonthExpenses } from "@/lib/services/expense.service";
import { useSession } from "@/providers/auth-provider";
import type { Account, Budget, Expense } from "@/types";

/**
 * Only what Quick Add needs, nothing from the dashboard: accounts (to charge the usual
 * account for a payment method), budgets and this month's expenses (for the "₹x left"
 * hints). Three small listeners, all served from the offline cache first and kept live.
 *
 * The hints are computed from the expenses themselves, not the monthlyStats aggregate: an
 * aggregate document can be partial until it's rebuilt (e.g. the first write of a month
 * creates it from increments alone), which made the hints wrong.
 */
export function useQuickAddData() {
  const { user } = useSession();
  const uid = user.uid;
  // Quick Add records expenses at the moment of saving, so this month is the one they land in.
  const month = monthKey(new Date());
  const accounts = useLiveQuery<Account[]>(`qa-accounts:${uid}`, (ok, fail) => subscribeAccounts(uid, ok, fail));
  const budgets = useLiveQuery<Budget[]>(`qa-budgets:${uid}`, (ok, fail) => subscribeBudgets(uid, ok, fail));
  const expenses = useLiveQuery<Expense[]>(`qa-expenses:${uid}:${month}`, (ok, fail) => subscribeMonthExpenses(uid, month, ok, fail));

  // Saving may start before the accounts listener answers (cold start, slow network): let
  // the save wait briefly for it instead of silently skipping the account.
  const accountsRef = useRef<{ list: Account[]; ready: boolean }>({ list: [], ready: false });
  useEffect(() => {
    accountsRef.current = { list: accounts.data ?? [], ready: accounts.status !== "loading" };
  }, [accounts.data, accounts.status]);

  const budget = useMemo(() => (budgets.data ? (effectiveBudget(budgets.data, month)?.budget ?? null) : null), [budgets.data, month]);
  // Hints wait for both listeners: a half-loaded state would show the full limit as "left".
  const ready = budgets.status === "success" && expenses.status === "success";

  return {
    budget: {
      ready,
      month,
      /** The budget that applies this month (budgets roll forward), or null. */
      budget,
      expenses: expenses.data ?? EMPTY,
    },
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

const EMPTY: Expense[] = [];
