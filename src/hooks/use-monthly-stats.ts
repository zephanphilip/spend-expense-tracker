"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { monthsBetween } from "@/lib/months";
import { rebuildMonthlyStats, subscribeMonthlyStats } from "@/lib/services/stats.service";
import { emptyStats, type MonthlyStats, STATS_VERSION } from "@/lib/stats/monthly";
import { useSession } from "@/providers/auth-provider";
import type { MonthKey } from "@/types";

import { useLiveQuery } from "./use-live-query";

/**
 * Live monthly aggregates for [fromMonth, toMonth] — one small document per month instead of
 * every transaction. Months that are missing or predate the current aggregate version are
 * rebuilt from source once per session (the rebuild's own write then refreshes the listener).
 */
export function useMonthlyStats(fromMonth: MonthKey, toMonth: MonthKey) {
  const { user } = useSession();
  const uid = user.uid;
  const stats = useLiveQuery<MonthlyStats[]>(`stats:${uid}:${fromMonth}:${toMonth}`, (ok, fail) => subscribeMonthlyStats(uid, fromMonth, toMonth, ok, fail));

  const attempted = useRef(new Set<string>());
  const inFlight = useRef(0);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<Error | null>(null);

  const stale = useMemo(() => {
    if (stats.status !== "success") return [];
    const have = new Map(stats.data.map((s) => [s.month, s]));
    return monthsBetween(fromMonth, toMonth).filter((m) => have.get(m)?.version !== STATS_VERSION);
  }, [stats.status, stats.data, fromMonth, toMonth]);

  useEffect(() => {
    const todo = stale.filter((m) => !attempted.current.has(m));
    if (!todo.length) return;
    todo.forEach((m) => attempted.current.add(m));
    inFlight.current += 1;
    queueMicrotask(() => setRebuilding(true));
    rebuildMonthlyStats(uid, todo)
      .catch((e: Error) => setRebuildError(e))
      .finally(() => {
        inFlight.current -= 1;
        if (inFlight.current === 0) setRebuilding(false);
      });
  }, [stale, uid]);

  const list = useMemo(() => stats.data ?? [], [stats.data]);
  const byMonth = useMemo(() => new Map(list.map((s) => [s.month, s])), [list]);
  return {
    status: stats.error || rebuildError ? ("error" as const) : stats.status === "success" && stale.length === 0 && !rebuilding ? ("success" as const) : ("loading" as const),
    error: stats.error ?? rebuildError,
    retry: stats.retry,
    rebuilding,
    stats: list,
    /** Aggregate for a month (empty if none recorded). */
    get: (month: MonthKey) => byMonth.get(month) ?? emptyStats(month),
  };
}
