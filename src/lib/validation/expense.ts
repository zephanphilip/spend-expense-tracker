import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { fromDateTimeLocalValue } from "@/lib/dates";
import { parseAmountToMinor } from "@/lib/money";
import type { ExpenseInput } from "@/types";

export const NOTE_MAX_LENGTH = 280;
export const MAX_AMOUNT_MINOR = 1_000_000_000_000;

/** Form-level schema: values are exactly what the inputs hold (strings). */
export const expenseFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .refine((v) => {
      const minor = parseAmountToMinor(v);
      return minor !== null && minor > 0;
    }, "Enter an amount greater than zero"),
  categoryId: z.string().min(1, "Pick a category"),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Pick a payment method" }),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH, `Keep notes under ${NOTE_MAX_LENGTH} characters`),
  occurredAt: z
    .string()
    .refine((v) => fromDateTimeLocalValue(v) !== null, "Choose a valid date and time"),
  /** "" = not linked to an account. */
  accountId: z.string(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

/** Service-level schema: guards every write regardless of which UI produced it. */
export const expenseInputSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT_MINOR),
  categoryId: z.string().min(1).max(128),
  paymentMethod: z.enum(PAYMENT_METHODS),
  note: z.string().max(NOTE_MAX_LENGTH),
  occurredAt: z.date(),
  accountId: z.string().min(1).max(128).nullable().optional(),
  recurringId: z.string().min(1).max(128).nullable().optional(),
  occurrence: z.number().int().min(0).nullable().optional(),
}) satisfies z.ZodType<ExpenseInput>;

/** Converts validated form values into the domain input. */
export function toExpenseInput(values: ExpenseFormValues): ExpenseInput {
  const amount = parseAmountToMinor(values.amount);
  const occurredAt = fromDateTimeLocalValue(values.occurredAt);
  if (amount === null || occurredAt === null) {
    throw new Error("Invalid expense form values");
  }
  return {
    amount,
    categoryId: values.categoryId,
    paymentMethod: values.paymentMethod,
    note: values.note.trim(),
    occurredAt,
    accountId: values.accountId || null,
  };
}
