import {
  endOfDay,
  endOfMonth,
  format,
  isThisYear,
  isToday,
  isValid,
  isYesterday,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

export const PERIOD_PRESETS = [
  "this-month",
  "last-month",
  "last-30",
  "last-90",
  "this-year",
  "all",
  "custom",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-30": "Last 30 days",
  "last-90": "Last 90 days",
  "this-year": "This year",
  all: "All time",
  custom: "Custom range",
};

export interface DateRange {
  from?: Date;
  to?: Date;
}

export function getPeriodRange(
  preset: PeriodPreset,
  custom: DateRange = {},
  now: Date = new Date(),
): DateRange {
  switch (preset) {
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last-month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "last-30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last-90":
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case "this-year":
      return { from: startOfYear(now), to: endOfDay(now) };
    case "custom":
      return {
        from: custom.from ? startOfDay(custom.from) : undefined,
        to: custom.to ? endOfDay(custom.to) : undefined,
      };
    case "all":
      return {};
  }
}

const DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm";
const DATE_ONLY = "yyyy-MM-dd";

/** Value for <input type="datetime-local">, in the device's local time zone. */
export function toDateTimeLocalValue(date: Date): string {
  return format(date, DATETIME_LOCAL);
}

export function fromDateTimeLocalValue(value: string): Date | null {
  const date = parse(value, DATETIME_LOCAL, new Date());
  return isValid(date) ? date : null;
}

export function toDateInputValue(date: Date): string {
  return format(date, DATE_ONLY);
}

export function fromDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, DATE_ONLY, new Date());
  return isValid(date) ? date : undefined;
}

/** "Today", "Yesterday", "Mon, 3 Mar", "3 Mar 2024". */
export function formatDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "EEE, d MMM");
  return format(date, "d MMM yyyy");
}

export function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

export function formatDateTimeLabel(date: Date): string {
  return `${formatDayLabel(date)} · ${formatTime(date)}`;
}

export function dayKey(date: Date): string {
  return format(date, DATE_ONLY);
}
