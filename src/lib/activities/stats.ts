/**
 * Completion, streak and consistency calculations. Everything is derived from the stored
 * logs on demand — nothing here is persisted — so historical edits are reflected
 * everywhere the next time these run.
 *
 * Definitions (shared by the dashboard and analytics):
 * - A day counts as done for an activity when at least one log exists for that activity
 *   and day (several sessions on one day still count once).
 * - Fixed schedules (every day / chosen weekdays / every N days) have occurrences on
 *   specific dates. "Times a week" schedules have a weekly target instead, met by doing
 *   the activity on that many different days in a Monday–Sunday week.
 * - Today is "pending" until done: it never lowers a completion rate or breaks a streak,
 *   and it adds to them as soon as it's completed. The current week of a "times a week"
 *   activity is pending the same way until its target is met or the week ends.
 * - Completions on days nothing was scheduled are kept and shown ("extra") but don't
 *   extend or break streaks, so rates never exceed 100%.
 */
import type { TrackedActivity, ActivityLog } from "@/types/activities";

import {
  addDays,
  type DateKey,
  diffDays,
  eachDay,
  maxKey,
  minKey,
  startOfWeekKey,
} from "./dates";
import { currentSchedule, isFlexibleOn, isScheduledOn, ruleOn } from "./schedule";

type Activity = Pick<TrackedActivity, "id" | "startDate" | "endDate" | "schedules">;

export interface DayTotals {
  sessions: number;
  duration: number;
  quantity: number;
}

/** activityId → day → totals. */
export type DoneIndex = Map<string, Map<DateKey, DayTotals>>;

export function indexLogs(logs: readonly Pick<ActivityLog, "activityId" | "date" | "durationMin" | "quantity">[]): DoneIndex {
  const index: DoneIndex = new Map();
  for (const log of logs) {
    let days = index.get(log.activityId);
    if (!days) index.set(log.activityId, (days = new Map()));
    const day = days.get(log.date) ?? { sessions: 0, duration: 0, quantity: 0 };
    day.sessions += 1;
    day.duration += log.durationMin ?? 0;
    day.quantity += log.quantity ?? 0;
    days.set(log.date, day);
  }
  return index;
}

export function isDone(index: DoneIndex, activityId: string, date: DateKey): boolean {
  return (index.get(activityId)?.get(date)?.sessions ?? 0) > 0;
}

export type DayStatus =
  /** Scheduled (or part of a weekly target) and done. */
  | "done"
  /** A fixed occurrence in the past that wasn't done. */
  | "missed"
  /** Due today, not done yet. */
  | "pending"
  /** Nothing due (rest day, or a "times a week" day that wasn't used). */
  | "rest"
  /** Done on a day nothing was due. */
  | "extra"
  /** A future occurrence. */
  | "upcoming"
  /** Before the start date, after the end date, or while paused. */
  | "inactive";

export function dayStatus(activity: Activity, date: DateKey, index: DoneIndex, today: DateKey): DayStatus {
  const done = isDone(index, activity.id, date);
  const rule = ruleOn(activity, date);
  if (!rule || rule.kind === "none") return done ? "extra" : "inactive";
  const scheduled = isScheduledOn(activity, date);
  const flexible = rule.kind === "perWeek";
  if (done) return scheduled || flexible ? "done" : "extra";
  if (date > today) return scheduled ? "upcoming" : "rest";
  if (scheduled) return date === today ? "pending" : "missed";
  return "rest";
}

// ---------------------------------------------------------------- "times a week"

interface WeekTarget {
  /** Target for this week (prorated when the activity only applied part of it). */
  target: number;
  /** Distinct days done within the week (and the counting window). */
  done: number;
  /** Week (or window) is over: an unmet target counts as missed. */
  finished: boolean;
}

/**
 * Weekly progress for a "times a week" activity, counting only days inside [from, to].
 * A week the activity covered only partly (it started mid-week, or the window clips it)
 * gets a proportionally smaller target, never more than the days available. Pass the
 * range end unclipped by today: the current week keeps its full target while it's pending.
 */
function weekTarget(activity: Activity, index: DoneIndex, weekStart: DateKey, from: DateKey, to: DateKey, today: DateKey): WeekTarget | null {
  const weekEnd = addDays(weekStart, 6);
  let flexibleDays = 0;
  let windowDays = 0;
  let target = 0;
  let done = 0;
  for (const d of eachDay(weekStart, weekEnd)) {
    const rule = ruleOn(activity, d);
    if (rule?.kind !== "perWeek") continue;
    flexibleDays += 1;
    target = rule.perWeek ?? 1;
    if (d < from || d > to) continue;
    windowDays += 1;
    if (d <= today && isDone(index, activity.id, d)) done += 1;
  }
  if (!windowDays) return null;
  const share = Math.min(windowDays, flexibleDays) / 7;
  const prorated = Math.min(target, windowDays, Math.max(1, Math.ceil(target * share - 1e-9)));
  return { target: prorated, done, finished: minKey(weekEnd, to) < today };
}

function flexibleWeeks(from: DateKey, to: DateKey): DateKey[] {
  const weeks: DateKey[] = [];
  for (let w = startOfWeekKey(from); w <= to; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

// ---------------------------------------------------------------- completion rates

export interface Completion {
  scheduled: number;
  completed: number;
  /** 0..1, or null when nothing was due. */
  rate: number | null;
}

const rateOf = (completed: number, scheduled: number): Completion => ({
  scheduled,
  completed,
  rate: scheduled > 0 ? completed / scheduled : null,
});

/** Completed scheduled occurrences ÷ scheduled occurrences in [from, to] (future excluded). */
export function scheduledCompletion(activity: Activity, index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): Completion {
  const start = maxKey(from, activity.startDate);
  const end = minKey(minKey(to, today), activity.endDate ?? to);
  let scheduled = 0;
  let completed = 0;
  if (start > end) return rateOf(0, 0);
  let anyFlexible = false;
  for (const d of eachDay(start, end)) {
    if (isScheduledOn(activity, d)) {
      const done = isDone(index, activity.id, d);
      if (done) {
        scheduled += 1;
        completed += 1;
      } else if (d !== today) scheduled += 1;
    } else if (!anyFlexible && isFlexibleOn(activity, d)) anyFlexible = true;
  }
  if (anyFlexible) {
    const rangeEnd = minKey(to, activity.endDate ?? to);
    for (const w of flexibleWeeks(start, end)) {
      const week = weekTarget(activity, index, w, start, rangeEnd, today);
      if (!week) continue;
      if (week.finished || week.done >= week.target) {
        scheduled += week.target;
        completed += Math.min(week.done, week.target);
      } else {
        scheduled += week.done;
        completed += week.done;
      }
    }
  }
  return rateOf(completed, scheduled);
}

// ---------------------------------------------------------------- streaks

export interface Streak {
  current: number;
  best: number;
  /** Fixed schedules count occurrences (days); "times a week" counts weeks. */
  unit: "day" | "week";
}

/**
 * Streaks over scheduled occurrences: a Mon/Wed/Fri activity isn't broken by Tuesday.
 * `since` limits how far back history is available (older logs aren't loaded).
 */
export function activityStreak(activity: Activity, index: DoneIndex, today: DateKey, since?: DateKey): Streak {
  const unit = currentSchedule(activity).kind === "perWeek" ? "week" : "day";
  const start = maxKey(activity.startDate, since ?? activity.startDate);
  const end = minKey(today, activity.endDate ?? today);
  let run = 0;
  let best = 0;
  if (start > end) return { current: 0, best: 0, unit };
  if (unit === "day") {
    for (const d of eachDay(start, end)) {
      if (!isScheduledOn(activity, d)) continue;
      if (isDone(index, activity.id, d)) best = Math.max(best, ++run);
      else if (d !== today) run = 0;
    }
  } else {
    const rangeEnd = activity.endDate ?? addDays(today, 6);
    for (const w of flexibleWeeks(start, end)) {
      const week = weekTarget(activity, index, w, start, rangeEnd, today);
      if (!week) continue;
      if (week.done >= week.target) best = Math.max(best, ++run);
      else if (week.finished) run = 0;
    }
  }
  return { current: run, best, unit };
}

/** Days with at least one completion of any activity. */
export function activeDays(index: DoneIndex): Set<DateKey> {
  const days = new Set<DateKey>();
  for (const byDay of index.values()) for (const [d, t] of byDay) if (t.sessions > 0) days.add(d);
  return days;
}

/**
 * Overall streak: consecutive days with at least one activity done. Today doesn't break
 * it before it's over (the streak runs to yesterday until something is logged today).
 */
export function overallStreak(days: ReadonlySet<DateKey>, today: DateKey): { current: number; best: number } {
  let current = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    current += 1;
    d = addDays(d, -1);
  }
  const sorted = [...days].filter((k) => k <= today).sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && diffDays(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

// ---------------------------------------------------------------- a day's plan

export interface PlanItem<A extends Activity = Activity> {
  activity: A;
  /** "scheduled": fixed occurrence; "flexible": counts towards a weekly target; "extra": done on a rest day. */
  kind: "scheduled" | "flexible" | "extra";
  done: boolean;
  sessions: number;
  /** "Times a week" progress for the date's week (including that date). */
  week?: { done: number; target: number };
}

/**
 * What's due on `date`. "Times a week" activities appear until the week's target is met
 * (and on the days they were done), so they don't nag once you're on track.
 */
export function dayPlan<A extends Activity>(activities: readonly A[], index: DoneIndex, date: DateKey, today: DateKey): PlanItem<A>[] {
  const items: PlanItem<A>[] = [];
  for (const activity of activities) {
    const done = isDone(index, activity.id, date);
    const sessions = index.get(activity.id)?.get(date)?.sessions ?? 0;
    if (isScheduledOn(activity, date)) {
      items.push({ activity, kind: "scheduled", done, sessions });
    } else if (isFlexibleOn(activity, date)) {
      const weekStart = startOfWeekKey(date);
      const week = weekTarget(activity, index, weekStart, weekStart, addDays(weekStart, 6), today);
      const target = week?.target ?? 1;
      const doneThisWeek = week?.done ?? 0;
      const doneOthers = doneThisWeek - (done ? 1 : 0);
      if (done || doneOthers < target) items.push({ activity, kind: "flexible", done, sessions, week: { done: doneThisWeek, target } });
    } else if (done) {
      items.push({ activity, kind: "extra", done, sessions });
    }
  }
  return items;
}

export function planProgress(items: readonly PlanItem[]): { total: number; completed: number; rate: number | null } {
  const due = items.filter((i) => i.kind !== "extra");
  const completed = due.filter((i) => i.done).length;
  return { total: due.length, completed, rate: due.length ? completed / due.length : null };
}

// ---------------------------------------------------------------- summaries

export interface PeriodSummary extends Completion {
  /** Days in the period with at least one completion. */
  activeDays: number;
  /** Days in the period up to today. */
  elapsedDays: number;
  sessions: number;
  duration: number;
  quantity: number;
}

/** Totals for a set of activities over [from, to]. */
export function periodSummary(activities: readonly Activity[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): PeriodSummary {
  let scheduled = 0;
  let completed = 0;
  let sessions = 0;
  let duration = 0;
  let quantity = 0;
  const active = new Set<DateKey>();
  for (const a of activities) {
    const c = scheduledCompletion(a, index, from, to, today);
    scheduled += c.scheduled;
    completed += c.completed;
    for (const [d, t] of index.get(a.id) ?? []) {
      if (d < from || d > to || d > today) continue;
      sessions += t.sessions;
      duration += t.duration;
      quantity += t.quantity;
      active.add(d);
    }
  }
  const lastDay = minKey(to, today);
  return {
    ...rateOf(completed, scheduled),
    activeDays: active.size,
    elapsedDays: lastDay >= from ? diffDays(from, lastDay) + 1 : 0,
    sessions,
    duration,
    quantity,
  };
}

export interface DailyPoint {
  date: DateKey;
  scheduled: number;
  completed: number;
  rate: number | null;
}

/** Per-day completion across activities (fixed occurrences, plus weekly-target days done). */
export function dailyCompletion(activities: readonly Activity[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): DailyPoint[] {
  return eachDay(from, minKey(to, today)).map((date) => {
    let scheduled = 0;
    let completed = 0;
    for (const a of activities) {
      const done = isDone(index, a.id, date);
      if (isScheduledOn(a, date)) {
        if (done) {
          scheduled += 1;
          completed += 1;
        } else if (date !== today) scheduled += 1;
      } else if (done && isFlexibleOn(a, date)) {
        scheduled += 1;
        completed += 1;
      }
    }
    return { date, scheduled, completed, rate: scheduled ? completed / scheduled : null };
  });
}

/** Monday-start weeks overlapping [from, to] with their completion rate. */
export function weeklyCompletion(activities: readonly Activity[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey): (Completion & { week: DateKey })[] {
  const out: (Completion & { week: DateKey })[] = [];
  for (let w = startOfWeekKey(from); w <= minKey(to, today); w = addDays(w, 7)) {
    const s = periodSummary(activities, index, maxKey(w, from), minKey(addDays(w, 6), to), today);
    out.push({ week: w, scheduled: s.scheduled, completed: s.completed, rate: s.rate });
  }
  return out;
}

// ---------------------------------------------------------------- heatmap

export interface ActivityHeatCell {
  date: DateKey;
  /** 0 (nothing) … 4 (everything due was done). */
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
  future: boolean;
  scheduled: number;
  completed: number;
  /** Single-activity view only. */
  status?: DayStatus;
}

function levelOf(completed: number, scheduled: number): ActivityHeatCell["level"] {
  if (completed <= 0) return 0;
  const ratio = scheduled > 0 ? completed / scheduled : 1;
  if (ratio >= 1) return 4;
  if (ratio >= 0.67) return 3;
  if (ratio >= 0.34) return 2;
  return 1;
}

/** Monday-start week columns covering [from, to]. Pass one activity for its own calendar. */
export function heatmap(activities: readonly Activity[], index: DoneIndex, from: DateKey, to: DateKey, today: DateKey, single?: Activity): ActivityHeatCell[][] {
  const weeks: ActivityHeatCell[][] = [];
  for (let w = startOfWeekKey(from); w <= to; w = addDays(w, 7)) {
    weeks.push(
      eachDay(w, addDays(w, 6)).map((date) => {
        const inRange = date >= from && date <= to;
        const future = date > today;
        if (single) {
          const status = dayStatus(single, date, index, today);
          const done = status === "done" || status === "extra";
          return { date, inRange, future, status, scheduled: done || status === "missed" || status === "pending" ? 1 : 0, completed: done ? 1 : 0, level: done ? (status === "extra" ? 3 : 4) : 0 };
        }
        let scheduled = 0;
        let completed = 0;
        for (const a of activities) {
          const done = isDone(index, a.id, date);
          if (isScheduledOn(a, date)) {
            scheduled += 1;
            if (done) completed += 1;
          } else if (done) {
            completed += 1;
            if (isFlexibleOn(a, date)) scheduled += 1;
          }
        }
        return { date, inRange, future, scheduled, completed, level: future ? 0 : levelOf(completed, scheduled) };
      }),
    );
  }
  return weeks;
}
