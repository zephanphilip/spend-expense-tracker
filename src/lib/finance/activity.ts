import type { Expense, Income, InvestmentTransaction, Transfer, TransactionType } from "@/types";

export interface ActivityItem {
  id: string;
  type: TransactionType;
  date: Date;
  /** Signed effect on this account's balance. */
  delta: number;
  /** Balance right after this item (derived backwards from the current balance). */
  balanceAfter: number;
  source:
    | { kind: "expense"; expense: Expense }
    | { kind: "income"; income: Income }
    | { kind: "transfer"; transfer: Transfer; direction: "in" | "out" }
    | { kind: "investment"; tx: InvestmentTransaction };
}

/**
 * One account's ledger: expenses, incomes, transfers/debt payments and investment cash
 * flows merged newest-first, with a running balance computed back from `currentBalance`.
 */
export function accountActivity(
  accountId: string,
  currentBalance: number,
  data: {
    expenses: readonly Expense[];
    incomes: readonly Income[];
    transfers: readonly Transfer[];
    investmentTxs: readonly InvestmentTransaction[];
  },
): ActivityItem[] {
  type Draft = Omit<ActivityItem, "balanceAfter">;
  const items: Draft[] = [];
  for (const e of data.expenses) {
    if (e.accountId === accountId) items.push({ id: `e-${e.id}`, type: "EXPENSE", date: e.occurredAt, delta: -e.amount, source: { kind: "expense", expense: e } });
  }
  for (const i of data.incomes) {
    if (i.accountId === accountId) items.push({ id: `i-${i.id}`, type: "INCOME", date: i.receivedAt, delta: i.amount, source: { kind: "income", income: i } });
  }
  for (const t of data.transfers) {
    if (t.fromAccountId === accountId) {
      items.push({ id: `t-${t.id}-out`, type: t.type, date: t.occurredAt, delta: -t.amount, source: { kind: "transfer", transfer: t, direction: "out" } });
    }
    if (t.toAccountId === accountId) {
      items.push({ id: `t-${t.id}-in`, type: t.type, date: t.occurredAt, delta: t.amount, source: { kind: "transfer", transfer: t, direction: "in" } });
    }
  }
  for (const tx of data.investmentTxs) {
    if (tx.accountId !== accountId || tx.kind === "VALUATION") continue;
    items.push({ id: `v-${tx.id}`, type: "INVESTMENT", date: tx.occurredAt, delta: tx.kind === "BUY" ? -tx.amount : tx.amount, source: { kind: "investment", tx } });
  }
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  let running = currentBalance;
  return items.map((item) => {
    const withBalance = { ...item, balanceAfter: running };
    running -= item.delta;
    return withBalance;
  });
}

/** Money in/out for a list of activity (transfers between own accounts are separated out). */
export function activityTotals(items: readonly ActivityItem[]) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const i of items) {
    if (i.delta > 0) moneyIn += i.delta;
    else moneyOut -= i.delta;
  }
  return { moneyIn, moneyOut };
}
