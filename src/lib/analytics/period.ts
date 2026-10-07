import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isAfter,
  isSameDay,
  min as minDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

import { monthKey, monthsBetween } from "@/lib/months";
import type { MonthKey } from "@/types";

export const ANALYTICS_PERIODS = ["this-month", "last-month", "3m", "6m", "this-year", "12m", "custom"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "3m": "3 months",
  "6m": "6 months",
  "this-year": "This year",
  "12m": "12 months",
  custom: "Custom",
};

export interface Span {
  from: Date;
  to: Date;
}

export interface ResolvedPeriod extends Span {
  /** Identifies the selection, e.g. "this-month", "week:-1", "range:30d". */
  preset: string;
  label: string;
  /** For use inside a sentence: "this month", "last week", "August 2025", "the last 30 days". */
  phrase: string;
  /** True when the period contains today (comparisons then use the same elapsed span). */
  inProgress: boolean;
  /** Last day with data so far: min(to, end of today). */
  elapsedTo: Date;
  /** Days from `from` through `elapsedTo` (for per-day averages). */
  elapsedDays: number;
  months: MonthKey[];
  previous: Span & { label: string };
}

export function isMonthAligned({ from, to }: Span): boolean {
  return isSameDay(from, startOfMonth(from)) && isSameDay(to, endOfMonth(to));
}

/** Month keys whose month lies entirely inside the span. */
export function fullMonthsIn({ from, to }: Span): MonthKey[] {
  const first = isSameDay(from, startOfMonth(from)) ? monthKey(from) : monthKey(addMonths(from, 1));
  const last = isSameDay(to, endOfMonth(to)) ? monthKey(to) : monthKey(subMonths(to, 1));
  return first <= last ? monthsBetween(first, last) : [];
}

function spanLabel({ from, to }: Span): string {
  if (isMonthAligned({ from, to }) && monthKey(from) === monthKey(to)) return format(from, "MMMM yyyy");
  return `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
}

/** How the comparison period is found: N months back, N days back, or the equal span before. */
type Shift = { months: number } | { days: number } | null;

function finish(
  key: string,
  label: string,
  phrase: string,
  from: Date,
  to: Date,
  shift: Shift,
  now: Date,
  previousName?: string,
): ResolvedPeriod {
  const today = endOfDay(now);
  const inProgress = !isAfter(from, today) && isAfter(to, today);
  const elapsedTo = minDate([to, today]);
  const elapsedDays = Math.max(differenceInCalendarDays(elapsedTo, from) + 1, 1);

  let previous: Span;
  if (shift && "months" in shift) {
    const pFrom = startOfMonth(subMonths(from, shift.months));
    const pTo = inProgress ? endOfDay(subMonths(elapsedTo, shift.months)) : endOfMonth(subMonths(to, shift.months));
    previous = { from: pFrom, to: pTo };
  } else if (shift && "days" in shift) {
    // e.g. Mon–Wed of this week vs Mon–Wed of last week.
    previous = { from: startOfDay(subDays(from, shift.days)), to: endOfDay(subDays(inProgress ? elapsedTo : to, shift.days)) };
  } else {
    const length = differenceInCalendarDays(elapsedTo, from) + 1;
    const pTo = endOfDay(subDays(from, 1));
    previous = { from: startOfDay(subDays(pTo, length - 1)), to: pTo };
  }

  return {
    preset: key,
    label,
    phrase,
    from,
    to,
    inProgress,
    elapsedTo,
    elapsedDays,
    months: monthsBetween(monthKey(from), monthKey(to)),
    previous: {
      ...previous,
      label: inProgress && shift ? `same point ${previousName ?? "previous period"}` : previousName && !inProgress ? previousName : spanLabel(previous),
    },
  };
}

/**
 * Resolves a preset (or custom range) and the comparison period. Month-aligned presets
 * compare with the same number of months before; in-progress periods compare against the
 * same elapsed span (e.g. 1–7 Oct vs 1–7 Sep) so early-month numbers aren't unfairly low.
 */
export function resolvePeriod(preset: AnalyticsPeriod, custom: Partial<Span> = {}, now: Date = new Date()): ResolvedPeriod {
  const label = ANALYTICS_PERIOD_LABELS[preset];
  switch (preset) {
    case "this-month":
      return finish(preset, label, "this month", startOfMonth(now), endOfMonth(now), { months: 1 }, now, "last month");
    case "last-month": {
      const m = subMonths(now, 1);
      return finish(preset, label, "last month", startOfMonth(m), endOfMonth(m), { months: 1 }, now);
    }
    case "3m":
    case "6m":
    case "12m": {
      const n = preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
      return finish(preset, label, `the last ${n} months`, startOfMonth(subMonths(now, n - 1)), endOfMonth(now), { months: n }, now);
    }
    case "this-year":
      return finish(preset, label, "this year", startOfYear(now), endOfYear(now), { months: 12 }, now);
    case "custom": {
      let from = startOfDay(custom.from ?? startOfMonth(now));
      let to = endOfDay(custom.to ?? now);
      if (isAfter(from, to)) [from, to] = [startOfDay(to), endOfDay(from)];
      return finish(preset, spanLabel({ from, to }), spanLabel({ from, to }), from, to, null, now);
    }
  }
}

// ── Selections: calendar periods you can step through, rolling ranges, custom ────────────

export const CALENDAR_UNITS = ["week", "month", "year"] as const;
export type CalendarUnit = (typeof CALENDAR_UNITS)[number];

export const ROLLING_RANGES = ["7d", "30d", "90d", "3m", "6m", "12m"] as const;
export type RollingRange = (typeof ROLLING_RANGES)[number];

export const ROLLING_RANGE_LABELS: Record<RollingRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
};

export type PeriodSelection =
  /** offset 0 = the current week/month/year, -1 = the one before, … (never in the future). */
  | { kind: CalendarUnit; offset: number }
  | { kind: "range"; range: RollingRange }
  | { kind: "custom"; from?: Date; to?: Date };

export const PERIOD_KINDS = ["week", "month", "year", "range", "custom"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];
export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = { week: "Week", month: "Month", year: "Year", range: "Range", custom: "Custom" };

/** Weeks run Monday–Sunday. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

function weekLabel(from: Date, to: Date, now: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const showYear = to.getFullYear() !== now.getFullYear();
  const end = format(to, showYear ? "d MMM yyyy" : "d MMM");
  if (from.getMonth() === to.getMonth()) return `${format(from, "d")}–${end}`;
  return `${format(from, sameYear ? "d MMM" : "d MMM yyyy")} – ${end}`;
}

/** Short name for a calendar period: "This week", "Last month", "March 2025", "2024", "3–9 Feb". */
export function calendarLabel(unit: CalendarUnit, offset: number, now: Date = new Date()): string {
  if (offset === 0) return `This ${unit}`;
  if (offset === -1) return `Last ${unit}`;
  if (unit === "week") {
    const d = addWeeks(now, offset);
    return weekLabel(startOfWeek(d, WEEK_OPTIONS), endOfWeek(d, WEEK_OPTIONS), now);
  }
  if (unit === "month") {
    const d = addMonths(now, offset);
    return format(d, d.getFullYear() === now.getFullYear() ? "MMMM" : "MMMM yyyy");
  }
  return String(addYears(now, offset).getFullYear());
}

export function resolveSelection(selection: PeriodSelection, now: Date = new Date()): ResolvedPeriod {
  switch (selection.kind) {
    case "week": {
      const offset = Math.min(selection.offset, 0);
      const d = addWeeks(now, offset);
      const from = startOfWeek(d, WEEK_OPTIONS);
      const to = endOfWeek(d, WEEK_OPTIONS);
      const label = calendarLabel("week", offset, now);
      const phrase = offset === 0 ? "this week" : offset === -1 ? "last week" : `the week of ${weekLabel(from, to, now)}`;
      return finish(`week:${offset}`, offset > -2 ? `${label} · ${weekLabel(from, to, now)}` : label, phrase, from, to, { days: 7 }, now, offset === 0 ? "last week" : "the week before");
    }
    case "month": {
      const offset = Math.min(selection.offset, 0);
      const d = addMonths(now, offset);
      const label = offset === 0 || offset === -1 ? `${calendarLabel("month", offset, now)} · ${format(d, "MMMM yyyy")}` : format(d, "MMMM yyyy");
      const phrase = offset === 0 ? "this month" : offset === -1 ? "last month" : format(d, "MMMM yyyy");
      return finish(`month:${offset}`, label, phrase, startOfMonth(d), endOfMonth(d), { months: 1 }, now, offset === 0 ? "last month" : undefined);
    }
    case "year": {
      const offset = Math.min(selection.offset, 0);
      const d = addYears(now, offset);
      const phrase = offset === 0 ? "this year" : offset === -1 ? "last year" : String(d.getFullYear());
      return finish(`year:${offset}`, String(d.getFullYear()), phrase, startOfYear(d), endOfYear(d), { months: 12 }, now, offset === 0 ? "last year" : undefined);
    }
    case "range": {
      const label = ROLLING_RANGE_LABELS[selection.range];
      const days = selection.range === "7d" ? 7 : selection.range === "30d" ? 30 : selection.range === "90d" ? 90 : null;
      if (days !== null) {
        return finish(`range:${selection.range}`, label, `the last ${days} days`, startOfDay(subDays(now, days - 1)), endOfDay(now), null, now, `previous ${days} days`);
      }
      const n = selection.range === "3m" ? 3 : selection.range === "6m" ? 6 : 12;
      return finish(`range:${selection.range}`, label, `the last ${n} months`, startOfMonth(subMonths(now, n - 1)), endOfMonth(now), { months: n }, now, `previous ${n} months`);
    }
    case "custom":
      return resolvePeriod("custom", { from: selection.from, to: selection.to }, now);
  }
}

/** Each day in [from, to] (inclusive), at local midnight. */
export function eachDay({ from, to }: Span): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(from); !isAfter(d, to); d = addDays(d, 1)) days.push(d);
  return days;
}
