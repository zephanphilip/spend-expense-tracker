import { z } from "zod";

import { ACCOUNT_TYPES, INVESTMENT_KINDS, RECURRENCE_UNITS } from "@/lib/constants/accounts";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { MAX_AMOUNT_MINOR, NOTE_MAX_LENGTH } from "@/lib/validation/expense";

import { NAME_MAX_LENGTH } from "./finance";
import { dateString, moneyString, optionalDateString, optionalMoneyString } from "./money";

const name = z.string().trim().min(1, "Enter a name").max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`);
const note = z.string().trim().max(NOTE_MAX_LENGTH, `Keep notes under ${NOTE_MAX_LENGTH} characters`);
const day = z.string().trim().regex(/^\d{0,2}$/, "1–31").refine((v) => v === "" || (Number(v) >= 1 && Number(v) <= 31), "1–31");

// ---------------------------------------------------------------- forms

export const accountFormSchema = z
  .object({
    name,
    type: z.enum(ACCOUNT_TYPES),
    institution: z.string().trim().max(60, "Keep it under 60 characters"),
    /** Bank/cash/wallet: current balance. Card: current outstanding. */
    balance: optionalMoneyString,
    balanceNegative: z.boolean(),
    creditLimit: optionalMoneyString,
    statementDay: day,
    dueDay: day,
    active: z.boolean(),
  })
  .refine((v) => v.type !== "credit_card" || v.creditLimit !== "", { path: ["creditLimit"], message: "Enter the credit limit" });
export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const transferFormSchema = z
  .object({
    fromAccountId: z.string().min(1, "Choose an account"),
    toAccountId: z.string().min(1, "Choose an account"),
    amount: moneyString(),
    occurredOn: dateString(),
    note,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "Pick a different account" });
export type TransferFormValues = z.infer<typeof transferFormSchema>;

export const statementFormSchema = z.object({
  statementBalance: optionalMoneyString,
  minimumDue: optionalMoneyString,
});
export type StatementFormValues = z.infer<typeof statementFormSchema>;

export const investmentFormSchema = z.object({
  name,
  kind: z.enum(INVESTMENT_KINDS),
  institution: z.string().trim().max(60, "Keep it under 60 characters"),
  invested: moneyString("Enter the amount invested"),
  currentValue: optionalMoneyString,
  purchasedOn: dateString(),
  accountId: z.string(),
});
export type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

export const investmentTxFormSchema = z.object({
  kind: z.enum(["BUY", "SELL", "VALUATION"]),
  amount: z.string().trim().min(1, "Enter an amount"),
  occurredOn: dateString(),
  accountId: z.string(),
  note,
});
export type InvestmentTxFormValues = z.infer<typeof investmentTxFormSchema>;

export const recurringPaymentFormSchema = z.object({
  name,
  amount: moneyString(),
  categoryId: z.string().min(1, "Pick a category"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  accountId: z.string(),
  frequency: z.enum(["week", "month", "year", "custom"]),
  customUnit: z.enum(RECURRENCE_UNITS),
  customInterval: z.string().trim().regex(/^\d*$/, "Whole number"),
  startOn: dateString("Choose the next payment date"),
  endOn: optionalDateString,
  active: z.boolean(),
  autoPay: z.boolean(),
}).refine((v) => v.frequency !== "custom" || (Number(v.customInterval) >= 1 && Number(v.customInterval) <= 365), {
  path: ["customInterval"],
  message: "1 to 365",
});
export type RecurringPaymentFormValues = z.infer<typeof recurringPaymentFormSchema>;

// ---------------------------------------------------------------- service inputs

const minor = z.number().int().positive().max(MAX_AMOUNT_MINOR);
const signed = z.number().int().min(-MAX_AMOUNT_MINOR).max(MAX_AMOUNT_MINOR);

export const accountInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().max(60).nullable(),
  openingBalance: signed,
  active: z.boolean(),
  creditLimit: minor.nullable(),
  statementDay: z.number().int().min(1).max(31).nullable(),
  dueDay: z.number().int().min(1).max(31).nullable(),
});

export const transferInputSchema = z.object({
  fromAccountId: z.string().min(1).max(128),
  toAccountId: z.string().min(1).max(128),
  amount: minor,
  note: z.string().max(NOTE_MAX_LENGTH),
  occurredAt: z.date(),
});

export const recurringPaymentInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  amount: minor,
  categoryId: z.string().min(1).max(128),
  paymentMethod: z.enum(PAYMENT_METHODS),
  accountId: z.string().min(1).max(128).nullable(),
  unit: z.enum(RECURRENCE_UNITS),
  interval: z.number().int().min(1).max(365),
  startDate: z.date(),
  endDate: z.date().nullable(),
  active: z.boolean(),
});
