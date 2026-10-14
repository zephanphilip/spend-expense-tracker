"use client";

import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import { addDays, type DateKey, todayKey } from "@/lib/activities/dates";
import { type DoneIndex, indexLogs } from "@/lib/activities/stats";
import { subscribeActivities, subscribeActivityLogsBetween } from "@/lib/services/activity.service";
import type { TrackedActivity, ActivityLog } from "@/types/activities";

import { useSession } from "./auth-provider";

/** How much history stays live in memory (dashboard, streaks, the default analytics periods). */
export const ACTIVITY_WINDOW_DAYS = 400;

interface ActivityContextValue {
  status: "loading" | "error" | "success";
  error: Error | null;
  retry: () => void;
  /** All activities, archived included (history needs them). */
  activities: TrackedActivity[];
  /** Not archived, in creation order. */
  live: TrackedActivity[];
  get: (id: string) => TrackedActivity | null;
  /** Logs from `since` to today (newest first). Older history is loaded on demand. */
  logs: ActivityLog[];
  index: DoneIndex;
  /** Records written on this device that haven't reached the server yet. */
  pendingIds: ReadonlySet<string>;
  since: DateKey;
  today: DateKey;
  logsOn: (activityId: string, date: DateKey) => ActivityLog[];
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

/** Today's date key, rolling over at midnight and when the app comes back to the foreground. */
export function useTodayKey(): DateKey {
  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return today;
}

const EMPTY: never[] = [];
const NO_PENDING: ReadonlySet<string> = new Set();

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid = user.uid;
  const today = useTodayKey();
  const since = addDays(today, -ACTIVITY_WINDOW_DAYS);
  const activities = useLiveQuery<TrackedActivity[]>(`fitness-activities:${uid}`, (ok, fail) => subscribeActivities(uid, ok, fail));
  // No activities yet → no log listener (people who don't track activities pay nothing for it).
  const hasActivities = (activities.data?.length ?? 0) > 0;
  const logs = useLiveQuery<{ logs: ActivityLog[]; pendingIds: ReadonlySet<string> }>(
    hasActivities ? `fitness-logs:${uid}:${since}` : null,
    (ok, fail) => subscribeActivityLogsBetween(uid, { from: since, to: addDays(today, 1) }, (items, pendingIds) => ok({ logs: items, pendingIds }), fail),
  );

  const value = useMemo<ActivityContextValue>(() => {
    const list = activities.data ?? EMPTY;
    const items = logs.data?.logs ?? EMPTY;
    const byId = new Map(list.map((a) => [a.id, a]));
    const byDay = new Map<string, ActivityLog[]>();
    for (const log of items) {
      const key = `${log.activityId}|${log.date}`;
      byDay.set(key, [...(byDay.get(key) ?? []), log]);
    }
    const error = activities.error ?? logs.error;
    const status = error ? "error" : activities.status === "success" && (!hasActivities || logs.status === "success") ? "success" : "loading";
    return {
      status,
      error,
      retry: () => {
        if (activities.error) activities.retry();
        if (logs.error) logs.retry();
      },
      activities: list,
      live: list.filter((a) => a.status !== "archived"),
      get: (id) => byId.get(id) ?? null,
      logs: items,
      index: indexLogs(items),
      pendingIds: logs.data?.pendingIds ?? NO_PENDING,
      since,
      today,
      logsOn: (activityId, date) => byDay.get(`${activityId}|${date}`) ?? EMPTY,
    };
  }, [activities, logs, hasActivities, since, today]);

  return <ActivityContext value={value}>{children}</ActivityContext>;
}

export function useActivityTracker(): ActivityContextValue {
  const context = use(ActivityContext);
  if (!context) throw new Error("useActivityTracker must be used inside <ActivityProvider>");
  return context;
}
