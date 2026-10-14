/**
 * Plain-language observations computed from stored logs with fixed rules — no guessing.
 * Each insight states the numbers it's based on.
 */
import type { TrackedActivity } from "@/types/activities";

import { addDays, type DateKey, diffDays, startOfMonthKey, startOfWeekKey } from "./dates";
import { activityStreak, type DoneIndex, periodSummary, scheduledCompletion } from "./stats";
import { activityTotals, formatMinutes } from "./totals";

export interface ActivityInsight {
  id: string;
  tone: "positive" | "neutral" | "warning";
  text: string;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;
const times = (n: number, unit = "day") => `${n} ${unit}${n === 1 ? "" : "s"}`;

export function activityInsights(activities: readonly TrackedActivity[], index: DoneIndex, today: DateKey): ActivityInsight[] {
  const live = activities.filter((a) => a.status !== "archived");
  if (!live.length) return [];
  const out: ActivityInsight[] = [];
  const weekStart = startOfWeekKey(today);
  const monthStart = startOfMonthKey(today);
  const daysDone = (a: TrackedActivity, from: DateKey) =>
    [...(index.get(a.id) ?? [])].filter(([d, t]) => d >= from && d <= today && t.sessions > 0).length;
  const sessions = (a: TrackedActivity, from: DateKey) =>
    [...(index.get(a.id) ?? [])].reduce((s, [d, t]) => (d >= from && d <= today ? s + t.sessions : s), 0);

  // This week, per activity (the busiest one).
  const weekly = live.map((a) => ({ a, n: daysDone(a, weekStart) })).sort((x, y) => y.n - x.n)[0];
  if (weekly && weekly.n > 0) {
    out.push({ id: "week-top", tone: "positive", text: `You completed ${weekly.a.name} on ${times(weekly.n)} this week.` });
  }

  // Time invested this week (only from records that have a duration).
  const timed = live.map((a) => ({ a, t: activityTotals(index, a.id, weekStart, today, today) })).filter((x) => x.t.minutes > 0).sort((x, y) => y.t.minutes - x.t.minutes)[0];
  if (timed) {
    out.push({ id: "week-time", tone: "neutral", text: `You spent ${formatMinutes(timed.t.minutes)} on ${timed.a.name} this week (${times(timed.t.sessions, "session")}).` });
  }

  // Amount logged this month, in the activity's own unit (never added across units).
  const counted = live
    .filter((a) => a.unit)
    .map((a) => ({ a, t: activityTotals(index, a.id, monthStart, today, today) }))
    .filter((x) => x.t.quantity > 0)
    .sort((x, y) => y.t.daysDone - x.t.daysDone)[0];
  if (counted) {
    out.push({ id: "month-quantity", tone: "positive", text: `You logged ${counted.t.quantity.toLocaleString()} ${counted.a.unit} for ${counted.a.name} this month.` });
  }

  // Completed scheduled days this week, for the activity with the most.
  const scheduledWeek = live
    .map((a) => ({ a, c: scheduledCompletion(a, index, weekStart, today, today) }))
    .filter((x) => x.c.scheduled > 0 && x.c.completed > 0)
    .sort((x, y) => y.c.completed - x.c.completed)[0];
  if (scheduledWeek && scheduledWeek.c.completed >= 2) {
    out.push({
      id: "week-scheduled",
      tone: "positive",
      text: `${scheduledWeek.a.name} was completed on ${scheduledWeek.c.completed} of ${times(scheduledWeek.c.scheduled, "scheduled day")} this week.`,
    });
  }

  // Most consistent over the last 30 days (needs at least 3 scheduled occurrences).
  const from30 = addDays(today, -29);
  const ranked = live
    .map((a) => ({ a, c: scheduledCompletion(a, index, from30, today, today) }))
    .filter((x) => x.c.rate !== null && x.c.scheduled >= 3)
    .sort((x, y) => (y.c.rate ?? 0) - (x.c.rate ?? 0) || y.c.completed - x.c.completed);
  if (ranked.length >= 2 && (ranked[0].c.rate ?? 0) > 0) {
    out.push({
      id: "most-consistent",
      tone: "positive",
      text: `Your most consistent activity is ${ranked[0].a.name} — ${pct(ranked[0].c.rate ?? 0)} of its scheduled days in the last 30 days.`,
    });
  }

  // This month overall.
  const month = periodSummary(live, index, monthStart, today, today);
  if (month.rate !== null && month.scheduled >= 3) {
    out.push({
      id: "month-rate",
      tone: month.rate >= 0.7 ? "positive" : month.rate < 0.4 ? "warning" : "neutral",
      text: `You completed ${pct(month.rate)} of your scheduled activities this month (${month.completed} of ${month.scheduled}).`,
    });
  }

  // This week vs the same days last week.
  const elapsed = diffDays(weekStart, today);
  const thisWeek = periodSummary(live, index, weekStart, today, today);
  const lastWeek = periodSummary(live, index, addDays(weekStart, -7), addDays(weekStart, elapsed - 7), today);
  if (thisWeek.rate !== null && lastWeek.rate !== null && thisWeek.scheduled >= 2 && lastWeek.scheduled >= 2) {
    const diff = thisWeek.rate - lastWeek.rate;
    if (Math.abs(diff) >= 0.05) {
      out.push({
        id: "week-vs-last",
        tone: diff > 0 ? "positive" : "warning",
        text:
          diff > 0
            ? `You were more consistent this week than last week so far (${pct(thisWeek.rate)} vs ${pct(lastWeek.rate)}).`
            : `You're behind last week's pace (${pct(thisWeek.rate)} vs ${pct(lastWeek.rate)} by this point).`,
      });
    }
  }

  // Sessions this month for the most-practised activity.
  const busiest = live.map((a) => ({ a, n: sessions(a, monthStart) })).sort((x, y) => y.n - x.n)[0];
  if (busiest && busiest.n >= 2) {
    out.push({ id: "month-sessions", tone: "neutral", text: `You've logged ${times(busiest.n, "session")} of ${busiest.a.name} this month.` });
  }

  // A personal best streak in progress.
  for (const a of live) {
    const s = activityStreak(a, index, today);
    if (s.current >= 3 && s.current === s.best) {
      out.push({ id: `best-${a.id}`, tone: "positive", text: `${a.name}: ${times(s.current, s.unit)} in a row — your best streak yet.` });
      break;
    }
  }

  return out.slice(0, 6);
}
