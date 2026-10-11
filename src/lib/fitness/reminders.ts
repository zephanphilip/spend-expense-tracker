import type { FitnessActivity } from "@/types/fitness";

import { type DateKey, parseTimeOfDay, toDateKey } from "./dates";
import { dayPlan, type DoneIndex } from "./stats";

export interface DueReminder {
  activity: FitnessActivity;
  /** Reminder time, minutes after midnight. */
  minutes: number;
}

/** Activities whose reminder time has passed today and that are due but not done yet. */
export function dueReminders(activities: readonly FitnessActivity[], index: DoneIndex, now: Date): DueReminder[] {
  const today = toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return remindable(activities, index, today)
    .filter((r) => r.minutes <= nowMinutes)
    .sort((a, b) => a.minutes - b.minutes);
}

/** Milliseconds until the next reminder later today (null when none are left). */
export function nextReminderDelay(activities: readonly FitnessActivity[], index: DoneIndex, now: Date): number | null {
  const today = toDateKey(now);
  const nowMs = now.getHours() * 3_600_000 + now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds();
  const upcoming = remindable(activities, index, today)
    .map((r) => r.minutes * 60_000 - nowMs)
    .filter((ms) => ms > 0);
  return upcoming.length ? Math.min(...upcoming) : null;
}

function remindable(activities: readonly FitnessActivity[], index: DoneIndex, today: DateKey): DueReminder[] {
  const eligible = activities.filter((a) => a.status === "active" && a.reminderEnabled && parseTimeOfDay(a.reminderTime) !== null);
  return dayPlan(eligible, index, today, today)
    .filter((item) => item.kind !== "extra" && !item.done)
    .map((item) => ({ activity: item.activity, minutes: parseTimeOfDay(item.activity.reminderTime) as number }));
}

/** Notification copy: "Jogging · 7:00 AM — have you done it today?" */
export function reminderText(activity: Pick<FitnessActivity, "name">): { title: string; body: string } {
  return { title: activity.name, body: `Have you done ${activity.name.toLowerCase()} today? Tap to check it off.` };
}

/** "07:00" → "7:00 AM" in the user's locale. */
export function formatTimeOfDay(value: string | null): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) return "";
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
