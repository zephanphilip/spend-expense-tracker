"use client";

import { format } from "date-fns";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { settleQuickly } from "@/lib/async";
import { atTimeOnDay, type DateKey, fromDateKey } from "@/lib/fitness/dates";
import { isDone } from "@/lib/fitness/stats";
import { haptic } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteFitnessLog, logFitness, restoreFitnessLog } from "@/lib/services/fitness.service";
import { useSession } from "@/providers/auth-provider";
import { useFitness } from "@/providers/fitness-provider";
import type { FitnessActivity, FitnessLog } from "@/types/fitness";

export function whenLabel(date: DateKey, today: DateKey): string {
  if (date === today) return "today";
  return `on ${format(fromDateKey(date), "EEE d MMM")}`;
}

/** Complete / undo with optimistic local writes (they sync later when offline), toasts and Undo. */
export function useFitnessActions() {
  const { user } = useSession();
  const { index, logsOn, today } = useFitness();
  // Guards double taps before the local snapshot reflects the first write.
  const inflight = useRef(new Set<string>());

  const complete = useCallback(
    async (activity: FitnessActivity, date: DateKey, extra: Partial<Pick<FitnessLog, "durationMin" | "quantity" | "note">> = {}) => {
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
        const { id, committed } = logFitness(
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
          action: { label: "Undo", onClick: () => void deleteFitnessLog(user.uid, id).catch((e) => toast.error(getErrorMessage(e))) },
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
    async (activity: FitnessActivity, date: DateKey) => {
      const logs = [...logsOn(activity.id, date)].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      const target = logs[0];
      if (!target) return;
      try {
        await settleQuickly(deleteFitnessLog(user.uid, target.id));
        haptic("tap");
        toast(`${activity.name} unmarked ${whenLabel(date, today)}`, {
          action: { label: "Undo", onClick: () => void restoreFitnessLog(user.uid, target).catch((e) => toast.error(getErrorMessage(e))) },
        });
      } catch (error) {
        toast.error("Couldn't undo", { description: getErrorMessage(error) });
      }
    },
    [logsOn, today, user.uid],
  );

  const toggle = useCallback(
    (activity: FitnessActivity, date: DateKey) => {
      if (activity.multipleEntries || !isDone(index, activity.id, date)) return complete(activity, date);
      return undo(activity, date);
    },
    [complete, undo, index],
  );

  return { complete, undo, toggle };
}
