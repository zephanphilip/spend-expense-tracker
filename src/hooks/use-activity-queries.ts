"use client";

import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import type { DateKey } from "@/lib/activities/dates";
import { type DoneIndex, indexLogs } from "@/lib/activities/stats";
import { subscribeActivityLogs, subscribeActivityLogsBetween } from "@/lib/services/activity.service";
import { useSession } from "@/providers/auth-provider";
import { useActivityTracker } from "@/providers/activity-provider";
import type { ActivityLog } from "@/types/activities";

export function useActivityHistory(activityId: string, limit: number) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<{ items: ActivityLog[]; hasMore: boolean }>(`fitness-history:${uid}:${activityId}:${limit}`, (ok, fail) =>
    subscribeActivityLogs(uid, activityId, limit, (items, hasMore) => ok({ items, hasMore }), fail),
  );
}

/**
 * Logs for [from, to]. Ranges inside the live window reuse the app-wide listener; older
 * ranges open their own (date-range) query only while they're on screen.
 */
export function useActivityLogsRange(from: DateKey, to: DateKey) {
  const { user } = useSession();
  const tracker = useActivityTracker();
  const inWindow = from >= tracker.since;
  const uid = user.uid;
  const extra = useLiveQuery<ActivityLog[]>(inWindow ? null : `fitness-range:${uid}:${from}:${to}`, (ok, fail) =>
    subscribeActivityLogsBetween(uid, { from, to }, (items) => ok(items), fail),
  );
  return useMemo((): { status: "loading" | "error" | "success"; error: Error | null; retry: () => void; logs: ActivityLog[]; index: DoneIndex } => {
    if (inWindow) {
      const logs = tracker.logs.filter((l) => l.date >= from && l.date <= to);
      return { status: tracker.status, error: tracker.error, retry: tracker.retry, logs, index: indexLogs(logs) };
    }
    const logs = extra.data ?? [];
    return { status: extra.status, error: extra.error, retry: extra.retry, logs, index: indexLogs(logs) };
  }, [inWindow, tracker, extra, from, to]);
}
