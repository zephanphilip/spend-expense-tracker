import { addMonths, endOfMonth, format, isValid, parse, startOfMonth } from "date-fns";

import type { MonthKey } from "@/types";

const MONTH_FORMAT = "yyyy-MM";
export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthKey(date: Date): MonthKey {
  return format(date, MONTH_FORMAT);
}

export function parseMonthKey(key: MonthKey): Date {
  const date = parse(key, MONTH_FORMAT, new Date());
  if (!isValid(date)) throw new Error(`Invalid month key: ${key}`);
  return startOfMonth(date);
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(parseMonthKey(key), delta));
}

export function monthRange(key: MonthKey): { from: Date; to: Date } {
  const start = parseMonthKey(key);
  return { from: start, to: endOfMonth(start) };
}

/** Inclusive list of month keys, oldest first. */
export function monthsBetween(fromKey: MonthKey, toKey: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let key = fromKey; key <= toKey; key = shiftMonth(key, 1)) months.push(key);
  return months;
}

/** Last `count` months ending at `endKey`, oldest first. */
export function recentMonths(endKey: MonthKey, count: number): MonthKey[] {
  return monthsBetween(shiftMonth(endKey, -(count - 1)), endKey);
}

export function formatMonth(key: MonthKey, style: "long" | "short" = "long"): string {
  const date = parseMonthKey(key);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  if (style === "short") return format(date, "MMM");
  return format(date, sameYear ? "MMMM" : "MMMM yyyy");
}

/** Day `day` of the month, clamped to the month's last day (31 → 28 Feb). */
export function dayInMonth(key: MonthKey, day: number): Date {
  const start = parseMonthKey(key);
  const last = endOfMonth(start).getDate();
  return new Date(start.getFullYear(), start.getMonth(), Math.min(day, last));
}
