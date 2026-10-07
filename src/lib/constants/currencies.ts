export const CURRENCIES = {
  INR: { label: "Indian Rupee", locale: "en-IN" },
  USD: { label: "US Dollar", locale: "en-US" },
  EUR: { label: "Euro", locale: "en-IE" },
  GBP: { label: "British Pound", locale: "en-GB" },
  AED: { label: "UAE Dirham", locale: "en-AE" },
  SGD: { label: "Singapore Dollar", locale: "en-SG" },
  CAD: { label: "Canadian Dollar", locale: "en-CA" },
  AUD: { label: "Australian Dollar", locale: "en-AU" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}
