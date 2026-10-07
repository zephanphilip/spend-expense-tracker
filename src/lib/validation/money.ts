import { z } from "zod";

import { parseAmountToMinor } from "@/lib/money";

/** Required amount string from a money input; must be > 0. */
export const moneyString = (required = "Enter an amount") =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine((v) => (parseAmountToMinor(v) ?? 0) > 0, "Enter an amount greater than zero");

/** Optional amount string: blank means "not set". */
export const optionalMoneyString = z
  .string()
  .trim()
  .refine((v) => v === "" || parseAmountToMinor(v) !== null, "Enter a valid amount");

/** Parses a validated money string, returning null for blank/zero. */
export function toMinorOrNull(value: string): number | null {
  const minor = value.trim() ? parseAmountToMinor(value) : null;
  return minor && minor > 0 ? minor : null;
}

export function toMinor(value: string): number {
  const minor = parseAmountToMinor(value);
  if (minor === null) throw new Error(`Invalid amount: ${value}`);
  return minor;
}

export const dateString = (message = "Choose a date") =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const optionalDateString = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);

export const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month");
