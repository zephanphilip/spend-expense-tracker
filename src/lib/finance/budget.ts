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

/** Where a category stands against its monthly limit after (or without) a new expense. */
export interface CategoryBudgetStatus {
  categoryId: string;
  /** The month the expense belongs to — not necessarily the current month. */
  month: MonthKey;
  /** Everything spent in the category that month, in minor units. */
  spent: number;
  /** null when the category has no limit in the applicable budget. */
  progress: BudgetProgress | null;
  /** Month of the budget document that applied (budgets roll forward); null without one. */
  budgetMonth: MonthKey | null;
}

/**
 * `remaining = categoryLimit - spent`. A limit of 0 counts as a budget (any spend is over),
 * unlike a missing limit.
 */
export function categoryBudgetStatus(
  categoryId: string,
  month: MonthKey,
  budget: Pick<Budget, "month" | "categories"> | null,
  spent: number,
): CategoryBudgetStatus {
  const limit = budget?.categories[categoryId];
  return {
    categoryId,
    month,
    spent,
    progress: typeof limit === "number" ? budgetProgress(limit, spent) : null,
    budgetMonth: budget?.month ?? null,
  };
}

/**
 * Total spent in `categoryId` from the given expenses (already limited to the month), making
 * sure `include` (a just-written expense) is counted exactly once even if the read missed it.
 */
export function sumCategorySpend(
  expenses: readonly { id: string; amount: number; categoryId: string }[],
  categoryId: string,
  include?: { id: string; amount: number; categoryId: string },
): number {
  let total = 0;
  let seen = false;
  for (const e of expenses) {
    if (e.categoryId !== categoryId) continue;
    total += e.amount;
    if (include && e.id === include.id) seen = true;
  }
  if (include && !seen && include.categoryId === categoryId) total += include.amount;
  return total;
}
