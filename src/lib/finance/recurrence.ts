import { addDays, addMonths, addWeeks, addYears, isAfter, isBefore, startOfDay } from "date-fns";

import type { RecurrenceUnit, RecurringPayment } from "@/types";

/**
 * Date of the n-th occurrence (0-based), always computed from the start date so
 * month-end schedules don't drift (31 Jan → 28 Feb → 31 Mar).
 */
export function occurrenceDate(start: Date, unit: RecurrenceUnit, interval: number, n: number): Date {
  const steps = n * interval;
  switch (unit) {
    case "day":
      return addDays(start, steps);
    case "week":
      return addWeeks(start, steps);
    case "month":
      return addMonths(start, steps);
    case "year":
      return addYears(start, steps);
  }
}

type Schedule = Pick<RecurringPayment, "startDate" | "unit" | "interval" | "cycle" | "endDate" | "active">;

/** Next unpaid occurrence, or null when the schedule has ended or is paused. */
export function nextOccurrence(rp: Schedule): Date | null {
  if (!rp.active) return null;
  const next = occurrenceDate(rp.startDate, rp.unit, rp.interval, rp.cycle);
  if (rp.endDate && isAfter(startOfDay(next), startOfDay(rp.endDate))) return null;
  return next;
}

/** Unpaid occurrences up to `until` (inclusive), starting from the next one; capped at `max`. */
export function occurrencesUntil(rp: Schedule, until: Date, max = 6): { date: Date; cycle: number }[] {
  const out: { date: Date; cycle: number }[] = [];
  if (!rp.active) return out;
  for (let cycle = rp.cycle; out.length < max; cycle++) {
    const date = occurrenceDate(rp.startDate, rp.unit, rp.interval, cycle);
    if (isAfter(startOfDay(date), startOfDay(until))) break;
    if (rp.endDate && isAfter(startOfDay(date), startOfDay(rp.endDate))) break;
    out.push({ date, cycle });
  }
  return out;
}

export function isOverdue(date: Date, now: Date = new Date()): boolean {
  return isBefore(startOfDay(date), startOfDay(now));
}

const UNIT_ADVERB: Record<RecurrenceUnit, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };

export function frequencyLabel(unit: RecurrenceUnit, interval: number): string {
  if (interval === 1) return UNIT_ADVERB[unit];
  return `Every ${interval} ${unit}s`;
}

/** Approximate monthly cost, for summaries. */
export function monthlyEquivalent(rp: Pick<RecurringPayment, "amount" | "unit" | "interval">): number {
  const perUnitPerMonth: Record<RecurrenceUnit, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
  return Math.round((rp.amount * perUnitPerMonth[rp.unit]) / rp.interval);
}

/** Deterministic expense id per occurrence so paying twice is impossible. */
export function recurringExpenseId(recurringId: string, cycle: number): string {
  return `rp_${recurringId}_${cycle}`;
}
