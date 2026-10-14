import { WEEKDAYS } from "@/lib/constants/activities";
import type { TrackedActivity, ScheduleInput, ScheduleRule } from "@/types/activities";

import { type DateKey, diffDays, weekdayOf } from "./dates";

type Schedulable = Pick<TrackedActivity, "startDate" | "endDate" | "schedules">;

/** The schedule version in effect on `date`, or null outside the activity's start/end. */
export function ruleOn(activity: Schedulable, date: DateKey): ScheduleRule | null {
  if (date < activity.startDate) return null;
  if (activity.endDate && date > activity.endDate) return null;
  let found: ScheduleRule | null = null;
  for (const rule of activity.schedules) {
    if (rule.from <= date) found = rule;
    else break;
  }
  return found;
}

/**
 * Whether a fixed occurrence falls on `date` (daily, chosen weekdays, every N days).
 * "Times a week" activities have no fixed days, so they're never "scheduled" on a date —
 * see `isFlexibleOn` — and "none" (paused/archived) has nothing due.
 */
export function isScheduledOn(activity: Schedulable, date: DateKey): boolean {
  const rule = ruleOn(activity, date);
  if (!rule) return false;
  switch (rule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return rule.days.includes(weekdayOf(date));
    case "interval": {
      const every = Math.max(1, rule.every ?? 1);
      return diffDays(rule.from, date) % every === 0;
    }
    default:
      return false;
  }
}

/** A "times a week" schedule applies on this date (any day of the week counts). */
export function isFlexibleOn(activity: Schedulable, date: DateKey): boolean {
  return ruleOn(activity, date)?.kind === "perWeek";
}

/** The schedule the user currently sees and edits (the latest non-"none" version). */
export function currentSchedule(activity: Pick<TrackedActivity, "schedules">): ScheduleInput {
  for (let i = activity.schedules.length - 1; i >= 0; i--) {
    const { kind, days, perWeek, every } = activity.schedules[i];
    if (kind !== "none") return { kind, days, perWeek, every };
  }
  return { kind: "daily", days: [], perWeek: null, every: null };
}

export function sameSchedule(a: ScheduleInput, b: ScheduleInput): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "weekdays") return [...a.days].sort().join() === [...b.days].sort().join();
  if (a.kind === "perWeek") return a.perWeek === b.perWeek;
  if (a.kind === "interval") return a.every === b.every;
  return true;
}

/** Keeps only the fields that matter for the schedule's kind. */
export function normalizeSchedule(input: ScheduleInput): ScheduleInput {
  switch (input.kind) {
    case "weekdays":
      return { kind: "weekdays", days: [...new Set(input.days)].filter((d) => d >= 0 && d <= 6).sort(), perWeek: null, every: null };
    case "perWeek":
      return { kind: "perWeek", days: [], perWeek: Math.min(7, Math.max(1, Math.round(input.perWeek ?? 3))), every: null };
    case "interval":
      return { kind: "interval", days: [], perWeek: null, every: Math.min(365, Math.max(2, Math.round(input.every ?? 2))) };
    default:
      return { kind: input.kind, days: [], perWeek: null, every: null };
  }
}

/**
 * Applies a schedule change effective from `effective` (usually today) without touching
 * earlier versions. Versions starting on/after `effective` are replaced; consecutive
 * identical versions are merged. Never returns an empty list.
 */
export function withScheduleFrom(
  schedules: readonly ScheduleRule[],
  next: ScheduleInput,
  effective: DateKey,
  startDate: DateKey,
): ScheduleRule[] {
  const from = effective < startDate ? startDate : effective;
  const kept = schedules.filter((r) => r.from < from);
  const last = kept.at(-1);
  if (last && sameSchedule(last, next)) return kept;
  return [...kept, { from, ...normalizeSchedule(next) }];
}

/** Re-anchors the history when the start date changes. */
export function withStartDate(schedules: readonly ScheduleRule[], startDate: DateKey): ScheduleRule[] {
  // Drop versions that would begin before the new start except the one in effect on it.
  const inEffect = [...schedules].reverse().find((r) => r.from <= startDate) ?? schedules[0];
  const later = schedules.filter((r) => r.from > startDate && r !== inEffect);
  return [{ ...inEffect, from: startDate }, ...later];
}

const dayList = (days: number[]) => {
  const ordered = WEEKDAYS.filter((w) => days.includes(w.value));
  if (ordered.length === 7) return "Every day";
  if (ordered.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
  if (ordered.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return ordered.map((w) => w.label.slice(0, 3)).join(", ");
};

export function describeSchedule(rule: ScheduleInput): string {
  switch (rule.kind) {
    case "daily":
      return "Every day";
    case "weekdays":
      return rule.days.length ? dayList(rule.days) : "No days chosen";
    case "perWeek":
      return `${rule.perWeek ?? 1}× a week`;
    case "interval":
      return `Every ${rule.every ?? 2} days`;
    default:
      return "Paused";
  }
}
