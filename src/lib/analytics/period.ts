import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  min as minDate,
  startOfDay,
  startOfMonth,
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
  preset: AnalyticsPeriod;
  label: string;
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

/**
 * Resolves a preset (or custom range) and the comparison period. Month-aligned presets
 * compare with the same number of months before; in-progress periods compare against the
 * same elapsed span (e.g. 1–7 Oct vs 1–7 Sep) so early-month numbers aren't unfairly low.
 */
export function resolvePeriod(preset: AnalyticsPeriod, custom: Partial<Span> = {}, now: Date = new Date()): ResolvedPeriod {
  let from: Date;
  let to: Date;
  let shiftMonths: number | null = null;
  switch (preset) {
    case "this-month":
      from = startOfMonth(now);
      to = endOfMonth(now);
      shiftMonths = 1;
      break;
    case "last-month":
      from = startOfMonth(subMonths(now, 1));
      to = endOfMonth(subMonths(now, 1));
      shiftMonths = 1;
      break;
    case "3m":
    case "6m":
    case "12m": {
      const n = preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
      from = startOfMonth(subMonths(now, n - 1));
      to = endOfMonth(now);
      shiftMonths = n;
      break;
    }
    case "this-year":
      from = startOfYear(now);
      to = endOfMonth(new Date(now.getFullYear(), 11, 1));
      shiftMonths = 12;
      break;
    case "custom": {
      from = startOfDay(custom.from ?? startOfMonth(now));
      to = endOfDay(custom.to ?? now);
      if (isAfter(from, to)) [from, to] = [startOfDay(to), endOfDay(from)];
      break;
    }
  }

  const today = endOfDay(now);
  const inProgress = !isAfter(from, today) && isAfter(to, today);
  const elapsedTo = minDate([to, today]);
  const elapsedDays = Math.max(differenceInCalendarDays(elapsedTo, from) + 1, 1);

  let previous: Span;
  if (shiftMonths !== null) {
    const pFrom = startOfMonth(subMonths(from, shiftMonths));
    const pTo = inProgress ? endOfDay(subMonths(elapsedTo, shiftMonths)) : endOfMonth(subMonths(to, shiftMonths));
    previous = { from: pFrom, to: pTo };
  } else {
    const length = differenceInCalendarDays(elapsedTo, from) + 1;
    const pTo = endOfDay(subDays(from, 1));
    previous = { from: startOfDay(subDays(pTo, length - 1)), to: pTo };
  }

  return {
    preset,
    label: preset === "custom" ? spanLabel({ from, to }) : ANALYTICS_PERIOD_LABELS[preset],
    from,
    to,
    inProgress,
    elapsedTo,
    elapsedDays,
    months: monthsBetween(monthKey(from), monthKey(to)),
    previous: {
      ...previous,
      label: inProgress && shiftMonths !== null ? `same point ${shiftMonths === 1 ? "last month" : "previous period"}` : spanLabel(previous),
    },
  };
}

/** Each day in [from, to] (inclusive), at local midnight. */
export function eachDay({ from, to }: Span): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(from); !isAfter(d, to); d = addDays(d, 1)) days.push(d);
  return days;
}
