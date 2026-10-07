import { isValid } from "date-fns";

import type { PaymentMethod } from "@/types";

export type DateFormat = "ymd" | "dmy" | "mdy";

const DATE_RE = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NAMED_RE = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/;

/**
 * Guesses the numeric date order from sample values: a 4-digit first part means y-m-d;
 * a first part > 12 means d-m-y; a second part > 12 means m-d-y; otherwise d-m-y (India/UK
 * default). The user can override the guess in the mapping step.
 */
export function detectDateFormat(samples: readonly string[]): DateFormat {
  let dmy = false;
  let mdy = false;
  for (const raw of samples) {
    const m = DATE_RE.exec(raw.trim());
    if (!m) continue;
    if (m[1].length === 4) return "ymd";
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  if (mdy && !dmy) return "mdy";
  return "dmy";
}

function buildDate(y: number, mo: number, d: number, h = 12, mi = 0, s = 0, ampm?: string): Date | null {
  if (y < 100) y += 2000;
  let hour = h;
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }
  const date = new Date(y, mo - 1, d, hour, mi, s);
  // Reject roll-over such as 31/02 → 3 March.
  if (!isValid(date) || date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Parses "2026-10-07", "07/10/2026 14:30", "10/7/26 2:30 PM", "7 Oct 2026". Dates without a time default to noon. */
export function parseDateValue(raw: string, format: DateFormat): Date | null {
  const value = raw.trim();
  if (!value) return null;
  const named = NAMED_RE.exec(value);
  if (named) {
    const mo = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    if (mo === 0) return null;
    return buildDate(Number(named[3]), mo, Number(named[1]), named[4] ? Number(named[4]) : 12, Number(named[5] ?? 0), Number(named[6] ?? 0), named[7]);
  }
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [y, mo, d] = m[1].length === 4 || format === "ymd" ? [a, b, c] : format === "dmy" ? [c, b, a] : [c, a, b];
  return buildDate(y, mo, d, m[4] ? Number(m[4]) : 12, Number(m[5] ?? 0), Number(m[6] ?? 0), m[7]);
}

/**
 * Parses amounts like "₹1,234.50", "INR 1234", "(250.00)", "-99", "1 234,5" is not supported
 * (ambiguous). Returns minor units with sign, or null.
 */
export function parseAmountValue(raw: string): { minor: number; negative: boolean } | null {
  let v = raw.trim();
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  v = v.replace(/\b(INR|USD|EUR|GBP|AED|SGD|CAD|AUD|Rs\.?)\b/gi, "").replace(/[₹$€£\s]/g, "");
  if (/(cr|dr)$/i.test(v)) {
    if (/dr$/i.test(v)) negative = true;
    v = v.slice(0, -2);
  }
  if (v.startsWith("-")) {
    negative = !negative;
    v = v.slice(1);
  } else if (v.startsWith("+")) v = v.slice(1);
  v = v.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(v)) return null;
  const [int = "0", frac = ""] = v.split(".");
  const minor = Number(int || "0") * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > 1_000_000_000_000) return null;
  return { minor, negative };
}

const METHOD_SYNONYMS: Record<PaymentMethod, string[]> = {
  upi: ["upi", "gpay", "google pay", "phonepe", "paytm", "bhim", "imps", "neft", "netbanking", "net banking", "bank transfer", "wallet"],
  credit: ["credit", "credit card", "cc", "creditcard", "amex", "visa credit"],
  debit: ["debit", "debit card", "dc", "atm", "card"],
  cash: ["cash"],
};

export function parsePaymentMethod(raw: string): PaymentMethod | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  for (const [method, words] of Object.entries(METHOD_SYNONYMS) as [PaymentMethod, string[]][]) {
    if (words.some((w) => v === w || v.includes(w))) return method;
  }
  return null;
}

export const normalizeText = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
