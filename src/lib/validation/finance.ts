import { z } from "zod";

import { CATEGORY_COLOR_KEYS } from "@/lib/constants/colors";
import { CATEGORY_ICON_KEYS } from "@/lib/constants/icons";
import { INCOME_SOURCES } from "@/lib/constants/income";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { MAX_AMOUNT_MINOR, NOTE_MAX_LENGTH } from "@/lib/validation/expense";

import {
  dateString,
  moneyString,
  monthString,
  optionalDateString,
  optionalMoneyString,
} from "./money";

export const NAME_MAX_LENGTH = 40;
const name = (label: string) =>
  z.string().trim().min(1, `Enter a ${label}`).max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`);
const note = z.string().trim().max(NOTE_MAX_LENGTH, `Keep notes under ${NOTE_MAX_LENGTH} characters`);

// ---------------------------------------------------------------- forms

export const incomeFormSchema = z.object({
  amount: moneyString(),
  source: z.enum(INCOME_SOURCES),
  receivedOn: dateString(),
  forMonth: monthString,
  expectedOn: optionalDateString,
  note,
  repeatMonthly: z.boolean(),
  /** "" = not linked to an account. */
  accountId: z.string(),
});
export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

export const recurringIncomeFormSchema = z.object({
  name: name("name"),
  source: z.enum(INCOME_SOURCES),
  amount: moneyString(),
  dayOfMonth: z.coerce.number<string>().int().min(1, "1–31").max(31, "1–31"),
  active: z.boolean(),
  accountId: z.string(),
  autoRecord: z.boolean(),
});
export type RecurringIncomeFormValues = z.input<typeof recurringIncomeFormSchema>;

export const budgetFormSchema = z.object({
  overall: optionalMoneyString,
  categories: z.record(z.string(), optionalMoneyString),
});
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const emiFormSchema = z
  .object({
    name: name("name"),
    lender: z.string().trim().max(60, "Keep it under 60 characters"),
    principal: moneyString("Enter the loan amount"),
    rate: z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a rate like 10.5")
      .refine((v) => Number(v) <= 100, "Rate must be 100% or less"),
    tenureMonths: z
      .string()
      .trim()
      .regex(/^\d+$/, "Whole months only")
      .refine((v) => Number(v) >= 1 && Number(v) <= 480, "1 to 480 months"),
    monthlyAmount: optionalMoneyString,
    startOn: dateString("Choose the first due date"),
    alreadyPaid: z.string().trim().regex(/^\d*$/, "Whole number"),
  })
  .refine((v) => Number(v.alreadyPaid || 0) < Number(v.tenureMonths), {
    path: ["alreadyPaid"],
    message: "Must be less than the tenure",
  })
  .refine(
    (v) => {
      // N installments can only already be paid if the Nth due date isn't in the future.
      const paid = Number(v.alreadyPaid || 0);
      if (!paid || !/^\d{4}-\d{2}-\d{2}$/.test(v.startOn)) return true;
      const [y, m, d] = v.startOn.split("-").map(Number);
      const nth = new Date(y, m - 1 + paid - 1, d);
      return nth <= new Date();
    },
    { path: ["startOn"], message: "For a loan already being repaid, use the date of the very first EMI" },
  );
export type EmiFormValues = z.infer<typeof emiFormSchema>;

export const emiPaymentFormSchema = z.object({
  paidOn: dateString(),
  logExpense: z.boolean(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  accountId: z.string(),
});
export type EmiPaymentFormValues = z.infer<typeof emiPaymentFormSchema>;

export const goalFormSchema = z.object({
  name: name("name"),
  icon: z.enum(CATEGORY_ICON_KEYS),
  color: z.enum(CATEGORY_COLOR_KEYS),
  targetAmount: moneyString("Enter a target amount"),
  targetOn: optionalDateString,
  initialSaved: optionalMoneyString,
});
export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const contributionFormSchema = z.object({
  direction: z.enum(["add", "withdraw"]),
  amount: moneyString(),
  contributedOn: dateString(),
  note,
});
export type ContributionFormValues = z.infer<typeof contributionFormSchema>;

// ---------------------------------------------------------------- service inputs

const minor = z.number().int().positive().max(MAX_AMOUNT_MINOR);

export const incomeInputSchema = z.object({
  amount: minor,
  source: z.enum(INCOME_SOURCES),
  note: z.string().max(NOTE_MAX_LENGTH),
  receivedAt: z.date(),
  forMonth: monthString,
  expectedAt: z.date().nullable(),
  recurringId: z.string().min(1).max(128).nullable(),
});

export const recurringIncomeInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  source: z.enum(INCOME_SOURCES),
  amount: minor,
  dayOfMonth: z.number().int().min(1).max(31),
  startMonth: monthString,
  active: z.boolean(),
});

export const budgetInputSchema = z.object({
  overall: minor.nullable(),
  categories: z.record(z.string().min(1).max(128), minor).refine((c) => Object.keys(c).length <= 100),
});

export const emiInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  lender: z.string().max(60).nullable(),
  principal: minor,
  annualRateBps: z.number().int().min(0).max(10_000),
  monthlyAmount: minor,
  tenureMonths: z.number().int().min(1).max(480),
  startDate: z.date(),
});

export const goalInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  icon: z.enum(CATEGORY_ICON_KEYS),
  color: z.enum(CATEGORY_COLOR_KEYS),
  targetAmount: minor,
  targetDate: z.date().nullable(),
});
