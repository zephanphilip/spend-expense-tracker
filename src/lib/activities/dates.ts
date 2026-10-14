/**
 * Activity dates are plain local calendar days ("YYYY-MM-DD"), not instants: a jog logged
 * at 11:55 PM in Mumbai belongs to that day even if the phone later travels to London.
 * The key is taken from the device's local time when the record is made, and all
 * schedule/streak arithmetic runs on the keys themselves (via UTC), so daylight-saving
 * shifts and time zones can never make a day vanish or repeat.
 */
export type DateKey = string;

const PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string") return false;
  const m = PATTERN.exec(value);
  if (!m) return false;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return t.getUTCDate() === Number(m[3]);
}

/** The local calendar day of an instant. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** Local midnight of a day (for date-fns formatting and pickers). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const utc = (key: DateKey) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): DateKey => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtc(utc(key) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday (same as Date#getDay). */
export function weekdayOf(key: DateKey): number {
  return new Date(utc(key)).getUTCDay();
}

/** Weeks start on Monday. */
export function startOfWeekKey(key: DateKey): DateKey {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

export function startOfMonthKey(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonthKey(key: DateKey): DateKey {
  const [y, m] = key.split("-").map(Number);
  return fromUtc(Date.UTC(y, m, 0));
}

export function addMonthsKey(key: DateKey, months: number): DateKey {
  const [y, m] = key.split("-").map(Number);
  return fromUtc(Date.UTC(y, m - 1 + months, 1));
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b;
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b;
}

/** Every day from `from` to `to` inclusive (empty when from > to). */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "HH:MM" (24h) → minutes after midnight, or null. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** An instant on a local day at a given time (used for "completed at" defaults). */
export function atTimeOnDay(key: DateKey, minutes: number): Date {
  const d = fromDateKey(key);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}
