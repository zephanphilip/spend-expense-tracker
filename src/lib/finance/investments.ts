import type { Investment } from "@/types";

type Holding = Pick<Investment, "investedAmount" | "currentValue" | "realizedGain">;

export function applyBuy<T extends Holding>(inv: T, amount: number): T {
  return { ...inv, investedAmount: inv.investedAmount + amount, currentValue: inv.currentValue + amount };
}

export interface SellResult<T> {
  next: T;
  /** Portion of the invested amount attributed to what was sold. */
  costBasis: number;
  realized: number;
  closed: boolean;
}

/**
 * Sells `amount` at current value. Cost basis is removed proportionally
 * (selling 25% of the value removes 25% of what you invested).
 */
export function applySell<T extends Holding>(inv: T, amount: number): SellResult<T> {
  if (amount <= 0) throw new Error("Sell amount must be positive");
  if (amount > inv.currentValue) throw new Error("Can't sell more than the current value");
  const closed = amount === inv.currentValue;
  const costBasis = closed
    ? inv.investedAmount
    : Math.min(Math.round((inv.investedAmount * amount) / inv.currentValue), inv.investedAmount);
  const realized = amount - costBasis;
  return {
    next: {
      ...inv,
      investedAmount: inv.investedAmount - costBasis,
      currentValue: inv.currentValue - amount,
      realizedGain: inv.realizedGain + realized,
    },
    costBasis,
    realized,
    closed,
  };
}

export function applyValuation<T extends Holding>(inv: T, value: number): T {
  if (value < 0) throw new Error("Value can't be negative");
  return { ...inv, currentValue: value };
}

export interface Returns {
  /** Unrealised: current value − invested. */
  absolute: number;
  /** absolute / invested, or null when nothing is invested. */
  ratio: number | null;
}

export function investmentReturns(inv: Pick<Investment, "investedAmount" | "currentValue">): Returns {
  const absolute = inv.currentValue - inv.investedAmount;
  return { absolute, ratio: inv.investedAmount > 0 ? absolute / inv.investedAmount : null };
}

export function portfolioTotals(investments: readonly Investment[]) {
  const active = investments.filter((i) => i.status === "active");
  const invested = active.reduce((s, i) => s + i.investedAmount, 0);
  const current = active.reduce((s, i) => s + i.currentValue, 0);
  const realized = investments.reduce((s, i) => s + i.realizedGain, 0);
  return { invested, current, realized, ...investmentReturns({ investedAmount: invested, currentValue: current }) };
}
