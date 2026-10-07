import type { Expense, Income, InvestmentTxKind, Transfer } from "@/types";

/**
 * Balance effects: the single source of truth for how each transaction type moves money.
 * Services apply these as Firestore increments; Security Rules verify the same deltas.
 *
 * Sign convention: positive delta adds money to an account. A credit card's balance is
 * negative while you owe, so spending on it (−) increases the debt and paying it (+)
 * reduces the debt.
 */
export interface BalanceEffect {
  accountId: string;
  delta: number;
}

export function expenseEffects(e: Pick<Expense, "amount" | "accountId">): BalanceEffect[] {
  return e.accountId ? [{ accountId: e.accountId, delta: -e.amount }] : [];
}

export function incomeEffects(i: Pick<Income, "amount" | "accountId">): BalanceEffect[] {
  return i.accountId ? [{ accountId: i.accountId, delta: i.amount }] : [];
}

/** TRANSFER and DEBT_PAYMENT: source loses, destination account (if any) gains. EMIs live outside accounts. */
export function transferEffects(t: Pick<Transfer, "amount" | "fromAccountId" | "toAccountId">): BalanceEffect[] {
  const effects: BalanceEffect[] = [{ accountId: t.fromAccountId, delta: -t.amount }];
  if (t.toAccountId) effects.push({ accountId: t.toAccountId, delta: t.amount });
  return effects;
}

export function investmentTxEffects(tx: { kind: InvestmentTxKind; amount: number; accountId: string | null }): BalanceEffect[] {
  if (!tx.accountId || tx.kind === "VALUATION") return [];
  return [{ accountId: tx.accountId, delta: tx.kind === "BUY" ? -tx.amount : tx.amount }];
}

export function reverseEffects(effects: BalanceEffect[]): BalanceEffect[] {
  return effects.map((e) => ({ accountId: e.accountId, delta: -e.delta }));
}

/** Combines deltas per account and drops no-ops (e.g. editing an expense on the same account). */
export function mergeEffects(...lists: BalanceEffect[][]): BalanceEffect[] {
  const map = new Map<string, number>();
  for (const e of lists.flat()) map.set(e.accountId, (map.get(e.accountId) ?? 0) + e.delta);
  return [...map.entries()].filter(([, delta]) => delta !== 0).map(([accountId, delta]) => ({ accountId, delta }));
}

/** Effects of editing an expense: undo the old one, apply the new one. */
export function expenseUpdateEffects(
  before: Pick<Expense, "amount" | "accountId">,
  after: Pick<Expense, "amount" | "accountId">,
): BalanceEffect[] {
  return mergeEffects(reverseEffects(expenseEffects(before)), expenseEffects(after));
}

export function incomeUpdateEffects(
  before: Pick<Income, "amount" | "accountId">,
  after: Pick<Income, "amount" | "accountId">,
): BalanceEffect[] {
  return mergeEffects(reverseEffects(incomeEffects(before)), incomeEffects(after));
}

/** Pure application of effects to a balance map (used for previews and tests). */
export function applyEffects(balances: Record<string, number>, effects: BalanceEffect[]): Record<string, number> {
  const next = { ...balances };
  for (const e of effects) next[e.accountId] = (next[e.accountId] ?? 0) + e.delta;
  return next;
}
