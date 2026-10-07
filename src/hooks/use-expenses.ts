"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToExpenses } from "@/lib/services/expense.service";
import { useSession } from "@/providers/auth-provider";
import type { Expense, ExpenseQuery } from "@/types";

export type ExpensesResult =
  | { status: "loading"; expenses: Expense[]; hasMore: false; error: null }
  | { status: "error"; expenses: Expense[]; hasMore: false; error: Error }
  | { status: "success"; expenses: Expense[]; hasMore: boolean; error: null };

type Snapshot = { key: string } & ExpensesResult;

const LOADING: ExpensesResult = { status: "loading", expenses: [], hasMore: false, error: null };

/**
 * Live, real-time list of the signed-in user's expenses for a query.
 * Changing the query (e.g. raising `limit` for "load more") re-subscribes; previous
 * results stay visible while the larger window loads, avoiding flicker.
 */
export function useExpenses(
  expenseQuery: ExpenseQuery,
): ExpensesResult & { isRefreshing: boolean; retry: () => void } {
  const { user } = useSession();
  const uid = user.uid;
  const { from, to, categoryId, paymentMethod, limit } = expenseQuery;
  const fromMs = from?.getTime();
  const toMs = to?.getTime();
  // Listener errors are terminal in Firestore; bumping `attempt` re-subscribes.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const key = JSON.stringify([uid, fromMs, toMs, categoryId, paymentMethod, limit, attempt]);
  // Results with a different filter (but same user) can be shown while paging.
  const filterKey = JSON.stringify([uid, fromMs, toMs, categoryId, paymentMethod]);

  const [snapshot, setSnapshot] = useState<(Snapshot & { filterKey: string }) | null>(null);

  useEffect(() => {
    const q: ExpenseQuery = {
      from: fromMs === undefined ? undefined : new Date(fromMs),
      to: toMs === undefined ? undefined : new Date(toMs),
      categoryId,
      paymentMethod,
      limit,
    };
    return subscribeToExpenses(
      uid,
      q,
      (expenses, meta) =>
        setSnapshot({
          key,
          filterKey,
          status: "success",
          expenses,
          hasMore: meta.hasMore,
          error: null,
        }),
      (error) =>
        setSnapshot({ key, filterKey, status: "error", expenses: [], hasMore: false, error }),
    );
  }, [uid, fromMs, toMs, categoryId, paymentMethod, limit, key, filterKey]);

  if (snapshot?.key === key) return { ...snapshot, isRefreshing: false, retry };
  if (snapshot?.filterKey === filterKey && snapshot.status === "success") {
    // Same filters, different page size: keep showing what we have.
    return { ...snapshot, isRefreshing: true, retry };
  }
  return { ...LOADING, isRefreshing: false, retry };
}
