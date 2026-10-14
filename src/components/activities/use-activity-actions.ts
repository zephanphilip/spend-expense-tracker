"use client";

import { format } from "date-fns";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { settleQuickly } from "@/lib/async";
import { atTimeOnDay, type DateKey, fromDateKey } from "@/lib/activities/dates";
import { isDone } from "@/lib/activities/stats";
import { haptic } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteActivityLog, logActivity, restoreActivityLog } from "@/lib/services/activity.service";
import { useSession } from "@/providers/auth-provider";
import { useActivityTracker } from "@/providers/activity-provider";
import type { TrackedActivity, ActivityLog } from "@/types/activities";

export function whenLabel(date: DateKey, today: DateKey): string {
  if (date === today) return "today";
  return `on ${format(fromDateKey(date), "EEE d MMM")}`;
}

/** Complete / undo with optimistic local writes (they sync later when offline), toasts and Undo. */
export function useActivityActions() {
  const { user } = useSession();
  const { index, logsOn, today } = useActivityTracker();
  // Guards double taps before the local snapshot reflects the first write.
  const inflight = useRef(new Set<string>());

  const complete = useCallback(
    async (activity: TrackedActivity, date: DateKey, extra: Partial<Pick<ActivityLog, "durationMin" | "quantity" | "note">> = {}) => {
      const key = `${activity.id}|${date}`;
      const alreadyDone = isDone(index, activity.id, date);
      if (!activity.multipleEntries && (alreadyDone || inflight.current.has(key))) return;
      if (date > today) {
        toast.error("You can't complete a future day yet.");
        return;
      }
      inflight.current.add(key);
      const now = new Date();
      const completedAt = date === today ? now : atTimeOnDay(date, now.getHours() * 60 + now.getMinutes());
      try {
        const { id, committed } = logActivity(
          user.uid,
          activity,
          { activityId: activity.id, date, completedAt, durationMin: extra.durationMin ?? null, quantity: extra.quantity ?? null, note: extra.note ?? "" },
          { alreadyDone },
        );
        haptic("success");
        const result = await settleQuickly(committed);
        if (result === "pending") committed.catch((e) => toast.error(`Couldn't sync ${activity.name}`, { description: getErrorMessage(e) }));
        toast.success(`${activity.name} done ${whenLabel(date, today)}`, {
          description: result === "pending" ? "Saved on this device — will sync when you're back online." : undefined,
          action: { label: "Undo", onClick: () => void deleteActivityLog(user.uid, id).catch((e) => toast.error(getErrorMessage(e))) },
        });
      } catch (error) {
        haptic("warning");
        toast.error(`Couldn't save ${activity.name}`, { description: getErrorMessage(error) });
      } finally {
        inflight.current.delete(key);
      }
    },
    [index, today, user.uid],
  );

  /** Removes the day's check-in (or its latest session). */
  const undo = useCallback(
    async (activity: TrackedActivity, date: DateKey) => {
      const logs = [...logsOn(activity.id, date)].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      const target = logs[0];
      if (!target) return;
      try {
        await settleQuickly(deleteActivityLog(user.uid, target.id));
        haptic("tap");
        toast(`${activity.name} unmarked ${whenLabel(date, today)}`, {
          action: { label: "Undo", onClick: () => void restoreActivityLog(user.uid, target).catch((e) => toast.error(getErrorMessage(e))) },
        });
      } catch (error) {
        toast.error("Couldn't undo", { description: getErrorMessage(error) });
      }
    },
    [logsOn, today, user.uid],
  );

  const toggle = useCallback(
    (activity: TrackedActivity, date: DateKey) => {
      if (activity.multipleEntries || !isDone(index, activity.id, date)) return complete(activity, date);
      return undo(activity, date);
    },
    [complete, undo, index],
  );

  return { complete, undo, toggle };
}
