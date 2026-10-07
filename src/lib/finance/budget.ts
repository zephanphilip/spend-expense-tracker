import type { Budget, MonthKey } from "@/types";

export type BudgetState = "ok" | "warning" | "over";

export interface BudgetProgress {
  limit: number;
  spent: number;
  /** Negative when over budget. */
  remaining: number;
  /** spent / limit (may exceed 1). */
  ratio: number;
  /** Whole-number percentage used. */
  percent: number;
  state: BudgetState;
}

export const BUDGET_WARNING_RATIO = 0.8;

export function budgetProgress(limit: number, spent: number): BudgetProgress {
  const ratio = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
  return {
    limit,
    spent,
    remaining: limit - spent,
    ratio,
    percent: Number.isFinite(ratio) ? Math.round(ratio * 100) : 100,
    state: ratio > 1 ? "over" : ratio >= BUDGET_WARNING_RATIO ? "warning" : "ok",
  };
}

export interface EffectiveBudget {
  budget: Budget;
  /** True when carried over from an earlier month (no budget saved for this month). */
  inherited: boolean;
}

/**
 * Budgets roll forward: a month without its own document uses the most recent earlier one.
 * `budgets` may be in any order.
 */
export function effectiveBudget(budgets: readonly Budget[], month: MonthKey): EffectiveBudget | null {
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.month <= month && (!best || b.month > best.month)) best = b;
  }
  return best ? { budget: best, inherited: best.month !== month } : null;
}

export function hasAnyLimit(budget: Pick<Budget, "overall" | "categories"> | null | undefined): boolean {
  return Boolean(budget && (budget.overall || Object.keys(budget.categories).length > 0));
}
