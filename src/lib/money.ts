import { CURRENCIES, type CurrencyCode } from "@/lib/constants/currencies";

/** Max digits before the decimal point; keeps amounts well under the rules' 10^12 cap. */
export const MAX_INTEGER_DIGITS = 9;

const fractionDigitsCache = new Map<CurrencyCode, number>();

export function fractionDigits(currency: CurrencyCode): number {
  let digits = fractionDigitsCache.get(currency);
  if (digits === undefined) {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    fractionDigitsCache.set(currency, digits);
  }
  return digits;
}

/**
 * Normalises raw keyboard input into a valid partial amount string while typing:
 * digits plus one decimal separator, limited fraction/integer length, no leading zeros.
 * Accepts "," as a decimal separator for locales whose keypads emit it.
 */
export function sanitizeAmountInput(raw: string, digits = 2): string {
  let value = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value =
      value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }
  const [rawInt = "", frac] = value.split(".");
  let int = rawInt.replace(/^0+(?=\d)/, "").slice(0, MAX_INTEGER_DIGITS);
  if (frac === undefined || digits === 0) return int;
  if (int === "") int = "0";
  return `${int}.${frac.slice(0, digits)}`;
}

/** Parses a user-entered amount into integer minor units without floating-point math. */
export function parseAmountToMinor(input: string, digits = 2): number | null {
  const value = input.trim().replace(/[\s,]/g, "");
  const pattern = digits > 0 ? new RegExp(`^(\\d*)(?:\\.(\\d{0,${digits}}))?$`) : /^(\d+)$/;
  const match = pattern.exec(value);
  if (!match) return null;
  const [, int = "", frac = ""] = match;
  if (int === "" && frac === "") return null;
  if (int.replace(/^0+/, "").length > MAX_INTEGER_DIGITS) return null;
  const minor = Number(int || "0") * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Converts minor units back into an editable input string: 1250 → "12.50", 1200 → "12". */
export function minorToInputString(minor: number, digits = 2): string {
  if (digits === 0) return String(minor);
  const base = 10 ** digits;
  const int = Math.trunc(minor / base);
  const frac = minor % base;
  return frac === 0 ? String(int) : `${int}.${String(frac).padStart(digits, "0")}`;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: CurrencyCode, minimumFractionDigits: number, compact: boolean) {
  const key = `${currency}:${minimumFractionDigits}:${compact}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCIES[currency].locale, {
      style: "currency",
      currency,
      minimumFractionDigits: compact ? 0 : minimumFractionDigits,
      maximumFractionDigits: compact ? 1 : fractionDigits(currency),
      notation: compact ? "compact" : "standard",
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export interface FormatMoneyOptions {
  /** "₹1.2L" style for tight spaces like chart labels. */
  compact?: boolean;
}

/** Formats minor units. Whole amounts drop the ".00" to keep lists calm. */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  { compact = false }: FormatMoneyOptions = {},
): string {
  const digits = fractionDigits(currency);
  const base = 10 ** digits;
  const showFraction = minor % base !== 0;
  return getFormatter(currency, showFraction ? digits : 0, compact).format(minor / base);
}

export function currencySymbol(currency: CurrencyCode): string {
  const part = new Intl.NumberFormat(CURRENCIES[currency].locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}
