"use client";

import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";

import { useLiveQuery } from "@/hooks/use-live-query";
import { addDays, type DateKey, todayKey } from "@/lib/fitness/dates";
import { type DoneIndex, indexLogs } from "@/lib/fitness/stats";
import { subscribeFitnessActivities, subscribeFitnessLogsBetween } from "@/lib/services/fitness.service";
import type { FitnessActivity, FitnessLog } from "@/types/fitness";

import { useSession } from "./auth-provider";

/** How much history stays live in memory (dashboard, streaks, the default analytics periods). */
export const FITNESS_WINDOW_DAYS = 400;

interface FitnessContextValue {
  status: "loading" | "error" | "success";
  error: Error | null;
  retry: () => void;
  /** All activities, archived included (history needs them). */
  activities: FitnessActivity[];
  /** Not archived, in creation order. */
  live: FitnessActivity[];
  get: (id: string) => FitnessActivity | null;
  /** Logs from `since` to today (newest first). Older history is loaded on demand. */
  logs: FitnessLog[];
  index: DoneIndex;
  /** Records written on this device that haven't reached the server yet. */
  pendingIds: ReadonlySet<string>;
  since: DateKey;
  today: DateKey;
  logsOn: (activityId: string, date: DateKey) => FitnessLog[];
}

const FitnessContext = createContext<FitnessContextValue | null>(null);

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

export function FitnessProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid = user.uid;
  const today = useTodayKey();
  const since = addDays(today, -FITNESS_WINDOW_DAYS);
  const activities = useLiveQuery<FitnessActivity[]>(`fitness-activities:${uid}`, (ok, fail) => subscribeFitnessActivities(uid, ok, fail));
  // No activities yet → no log listener (people who don't use Fitness pay nothing for it).
  const hasActivities = (activities.data?.length ?? 0) > 0;
  const logs = useLiveQuery<{ logs: FitnessLog[]; pendingIds: ReadonlySet<string> }>(
    hasActivities ? `fitness-logs:${uid}:${since}` : null,
    (ok, fail) => subscribeFitnessLogsBetween(uid, { from: since, to: addDays(today, 1) }, (items, pendingIds) => ok({ logs: items, pendingIds }), fail),
  );

  const value = useMemo<FitnessContextValue>(() => {
    const list = activities.data ?? EMPTY;
    const items = logs.data?.logs ?? EMPTY;
    const byId = new Map(list.map((a) => [a.id, a]));
    const byDay = new Map<string, FitnessLog[]>();
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

  return <FitnessContext value={value}>{children}</FitnessContext>;
}

export function useFitness(): FitnessContextValue {
  const context = use(FitnessContext);
  if (!context) throw new Error("useFitness must be used inside <FitnessProvider>");
  return context;
}
