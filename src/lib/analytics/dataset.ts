import { isAfter, isBefore } from "date-fns";

import { dayKey } from "@/lib/dates";
import { NO_ACCOUNT, type Counter, type MonthlyStats } from "@/lib/stats/monthly";
import type { Expense, PaymentMethod } from "@/types";

import { fullMonthsIn, isMonthAligned, type Span } from "./period";

export interface AnalyticsFilters {
  categoryIds: string[];
  accountIds: string[];
  paymentMethods: PaymentMethod[];
}

export const NO_FILTERS: AnalyticsFilters = { categoryIds: [], accountIds: [], paymentMethods: [] };

export const hasFilters = (f: AnalyticsFilters) => f.categoryIds.length + f.accountIds.length + f.paymentMethods.length > 0;

/** Spending in a span, in the same shape whether built from aggregates or raw expenses. */
export interface SpendData {
  total: number;
  count: number;
  byCategory: Counter;
  byPaymentMethod: Counter;
  byAccount: Counter;
  /** "yyyy-MM-dd" → total. */
  daily: Counter;
}

export const emptySpend = (): SpendData => ({ total: 0, count: 0, byCategory: {}, byPaymentMethod: {}, byAccount: {}, daily: {} });

const add = (c: Counter, k: string, v: number) => {
  c[k] = (c[k] ?? 0) + v;
};

export function matchesFilters(e: Pick<Expense, "categoryId" | "accountId" | "paymentMethod">, f: AnalyticsFilters): boolean {
  return (
    (f.categoryIds.length === 0 || f.categoryIds.includes(e.categoryId)) &&
    (f.accountIds.length === 0 || f.accountIds.includes(e.accountId ?? NO_ACCOUNT)) &&
    (f.paymentMethods.length === 0 || f.paymentMethods.includes(e.paymentMethod))
  );
}

/** From raw expenses (filtered views, partial months). Only EXPENSE documents count. */
export function spendFromExpenses(expenses: readonly Expense[], span: Span, filters: AnalyticsFilters = { categoryIds: [], accountIds: [], paymentMethods: [] }): SpendData {
  const out = emptySpend();
  for (const e of expenses) {
    if (isBefore(e.occurredAt, span.from) || isAfter(e.occurredAt, span.to)) continue;
    if (!matchesFilters(e, filters)) continue;
    out.total += e.amount;
    out.count += 1;
    add(out.byCategory, e.categoryId, e.amount);
    add(out.byPaymentMethod, e.paymentMethod, e.amount);
    add(out.byAccount, e.accountId ?? NO_ACCOUNT, e.amount);
    add(out.daily, dayKey(e.occurredAt), e.amount);
  }
  return out;
}

/** From monthly aggregates; only valid for month-aligned spans without filters. */
export function spendFromStats(stats: readonly MonthlyStats[], span: Span): SpendData {
  const months = new Set(fullMonthsIn(span));
  const out = emptySpend();
  for (const s of stats) {
    if (!months.has(s.month)) continue;
    out.total += s.expenseTotal;
    out.count += s.expenseCount;
    for (const [k, v] of Object.entries(s.byCategory)) add(out.byCategory, k, v);
    for (const [k, v] of Object.entries(s.byPaymentMethod)) add(out.byPaymentMethod, k, v);
    for (const [k, v] of Object.entries(s.byAccount)) add(out.byAccount, k, v);
    for (const [d, v] of Object.entries(s.byDay)) add(out.daily, `${s.month}-${d}`, v);
  }
  return out;
}

/** Aggregates are exact for whole months with no filters; anything else needs raw rows. */
export function canUseAggregates(span: Span, filters: AnalyticsFilters): boolean {
  return !hasFilters(filters) && isMonthAligned(span);
}
