"use client";

import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import type { DateKey } from "@/lib/fitness/dates";
import { type DoneIndex, indexLogs } from "@/lib/fitness/stats";
import { subscribeActivityLogs, subscribeFitnessLogsBetween } from "@/lib/services/fitness.service";
import { useSession } from "@/providers/auth-provider";
import { useFitness } from "@/providers/fitness-provider";
import type { FitnessLog } from "@/types/fitness";

export function useActivityHistory(activityId: string, limit: number) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<{ items: FitnessLog[]; hasMore: boolean }>(`fitness-history:${uid}:${activityId}:${limit}`, (ok, fail) =>
    subscribeActivityLogs(uid, activityId, limit, (items, hasMore) => ok({ items, hasMore }), fail),
  );
}

/**
 * Logs for [from, to]. Ranges inside the live window reuse the app-wide listener; older
 * ranges open their own (date-range) query only while they're on screen.
 */
export function useFitnessLogsRange(from: DateKey, to: DateKey) {
  const { user } = useSession();
  const fitness = useFitness();
  const inWindow = from >= fitness.since;
  const uid = user.uid;
  const extra = useLiveQuery<FitnessLog[]>(inWindow ? null : `fitness-range:${uid}:${from}:${to}`, (ok, fail) =>
    subscribeFitnessLogsBetween(uid, { from, to }, (items) => ok(items), fail),
  );
  return useMemo((): { status: "loading" | "error" | "success"; error: Error | null; retry: () => void; logs: FitnessLog[]; index: DoneIndex } => {
    if (inWindow) {
      const logs = fitness.logs.filter((l) => l.date >= from && l.date <= to);
      return { status: fitness.status, error: fitness.error, retry: fitness.retry, logs, index: indexLogs(logs) };
    }
    const logs = extra.data ?? [];
    return { status: extra.status, error: extra.error, retry: extra.retry, logs, index: indexLogs(logs) };
  }, [inWindow, fitness, extra, from, to]);
}
