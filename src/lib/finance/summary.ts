import { sumAmounts } from "@/lib/analytics";
import type { Budget, Emi, Income, MonthKey } from "@/types";

import { budgetProgress, type BudgetProgress } from "./budget";
import { obligationsForMonth } from "./emi";

export interface MonthSummary {
  month: MonthKey;
  income: number;
  expenses: number;
  /** income − expenses (negative when overspent). */
  savings: number;
  /** savings / income, or null without income. */
  savingsRate: number | null;
  emi: ReturnType<typeof obligationsForMonth>;
  budget: BudgetProgress | null;
}

/**
 * `incomes` are matched by `forMonth`; `spent` is the month's total EXPENSE amount (from the
 * monthly aggregate). EMI payments logged as expenses are included in it, so `emi` is
 * informational.
 */
export function monthSummary({
  month,
  incomes,
  spent,
  budget,
  emis,
}: {
  month: MonthKey;
  incomes: readonly Pick<Income, "amount" | "forMonth">[];
  spent: number;
  budget: Budget | null;
  emis: readonly Emi[];
}): MonthSummary {
  const income = sumAmounts(incomes.filter((i) => i.forMonth === month));
  const savings = income - spent;
  return {
    month,
    income,
    expenses: spent,
    savings,
    savingsRate: income > 0 ? savings / income : null,
    emi: obligationsForMonth(emis, month),
    budget: budget?.overall ? budgetProgress(budget.overall, spent) : null,
  };
}
