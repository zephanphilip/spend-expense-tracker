/**
 * Time, quantity and completion totals — each kept as its own measure (never blended into a
 * score). Only what records actually contain is counted: a check-in without a duration adds
 * no time, one without a quantity adds no amount. Derived from the stored logs on demand.
 */
import type { TrackedActivity } from "@/types/activities";

import type { DateKey } from "./dates";
import type { DoneIndex } from "./stats";

/** 45 → "45m", 120 → "2h", 510 → "8h 30m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export interface ActivityTotals {
  /** Records (check-ins or sessions). */
  sessions: number;
  /** Distinct days with at least one record. */
  daysDone: number;
  /** Sum of recorded durations, in minutes (0 when none were recorded). */
  minutes: number;
  /** Sum of recorded quantities, in the activity's unit (0 when none were recorded). */
  quantity: number;
}

/** Totals for one activity over [from, to] (days after `today` never count). */
export function activityTotals(index: DoneIndex, activityId: string, from: DateKey, to: DateKey, today: DateKey): ActivityTotals {
  const out: ActivityTotals = { sessions: 0, daysDone: 0, minutes: 0, quantity: 0 };
  for (const [date, day] of index.get(activityId) ?? []) {
    if (date < from || date > to || date > today || day.sessions <= 0) continue;
    out.sessions += day.sessions;
    out.daysDone += 1;
    out.minutes += day.duration;
    out.quantity += day.quantity;
  }
  return out;
}

/** Activity-days completed across activities: an activity done on a day counts once. */
export function completions(activities: readonly Pick<TrackedActivity, "id">[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): number {
  return activities.reduce((sum, a) => sum + activityTotals(index, a.id, from, to, today).daysDone, 0);
}

/** Recorded minutes across activities. */
export function minutesInvested(activities: readonly Pick<TrackedActivity, "id">[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): number {
  return activities.reduce((sum, a) => sum + activityTotals(index, a.id, from, to, today).minutes, 0);
}

export interface CategoryTime {
  /** null = activities without a category. */
  category: string | null;
  minutes: number;
  sessions: number;
  daysDone: number;
}

/** Time and completions per category, most time first (categories with no records left out). */
export function totalsByCategory(
  activities: readonly Pick<TrackedActivity, "id" | "category">[],
  index: DoneIndex,
  from: DateKey,
  to: DateKey,
  today: DateKey,
): CategoryTime[] {
  const map = new Map<string | null, CategoryTime>();
  for (const a of activities) {
    const t = activityTotals(index, a.id, from, to, today);
    if (!t.sessions) continue;
    const key = a.category ?? null;
    const row = map.get(key) ?? { category: key, minutes: 0, sessions: 0, daysDone: 0 };
    row.minutes += t.minutes;
    row.sessions += t.sessions;
    row.daysDone += t.daysDone;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || b.daysDone - a.daysDone);
}

/** Distinct categories in use, in first-seen order. */
export function categoriesOf(activities: readonly Pick<TrackedActivity, "category">[]): string[] {
  return [...new Set(activities.map((a) => a.category).filter((c): c is string => Boolean(c)))];
}
