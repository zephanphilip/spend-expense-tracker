import { format } from "date-fns";

import { monthKey } from "@/lib/months";
import type { Expense, Income, MonthKey } from "@/types";

/**
 * Derived per-month aggregates (`users/{uid}/monthlyStats/{yyyy-MM}`) so long-range
 * analytics read ~12 small documents instead of every transaction.
 *
 * They are maintained with increments in the same batch as each expense/income write and
 * can always be rebuilt from source data (a document without the current `version` is
 * rebuilt before use). Only EXPENSE and INCOME feed them — transfers, card payments and
 * investments never count as spending or income.
 */
export const STATS_VERSION = 1;
/** byAccount key for expenses not linked to an account. */
export const NO_ACCOUNT = "_none";

export type Counter = Record<string, number>;

export interface MonthlyStats {
  month: MonthKey;
  version: number | null;
  expenseTotal: number;
  expenseCount: number;
  incomeTotal: number;
  incomeCount: number;
  byCategory: Counter;
  byPaymentMethod: Counter;
  byAccount: Counter;
  /** "01".."31" → total spent that day. */
  byDay: Counter;
  incomeBySource: Counter;
}

export type StatsDelta = Omit<MonthlyStats, "version">;

export function emptyStats(month: MonthKey, version: number | null = STATS_VERSION): MonthlyStats {
  return {
    month,
    version,
    expenseTotal: 0,
    expenseCount: 0,
    incomeTotal: 0,
    incomeCount: 0,
    byCategory: {},
    byPaymentMethod: {},
    byAccount: {},
    byDay: {},
    incomeBySource: {},
  };
}

function emptyDelta(month: MonthKey): StatsDelta {
  const { version: _v, ...rest } = emptyStats(month);
  void _v;
  return rest;
}

type ExpenseLike = Pick<Expense, "amount" | "categoryId" | "paymentMethod" | "accountId" | "occurredAt">;
type IncomeLike = Pick<Income, "amount" | "source" | "forMonth">;

export const dayOfMonthKey = (date: Date) => format(date, "dd");

/** Delta for adding (sign = 1) or removing (sign = −1) one expense. */
export function expenseStatsDelta(e: ExpenseLike, sign: 1 | -1): StatsDelta {
  const d = emptyDelta(monthKey(e.occurredAt));
  const v = sign * e.amount;
  d.expenseTotal = v;
  d.expenseCount = sign;
  d.byCategory[e.categoryId] = v;
  d.byPaymentMethod[e.paymentMethod] = v;
  d.byAccount[e.accountId ?? NO_ACCOUNT] = v;
  d.byDay[dayOfMonthKey(e.occurredAt)] = v;
  return d;
}

/** Income is attributed to its `forMonth` (salary for September paid in October counts for September). */
export function incomeStatsDelta(i: IncomeLike, sign: 1 | -1): StatsDelta {
  const d = emptyDelta(i.forMonth);
  d.incomeTotal = sign * i.amount;
  d.incomeCount = sign;
  d.incomeBySource[i.source] = sign * i.amount;
  return d;
}

const COUNTERS = ["byCategory", "byPaymentMethod", "byAccount", "byDay", "incomeBySource"] as const;
const SCALARS = ["expenseTotal", "expenseCount", "incomeTotal", "incomeCount"] as const;

function addCounter(into: Counter, from: Counter) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

/** Combines deltas into one per month and drops zero entries (e.g. an edit that changes nothing). */
export function mergeStatsDeltas(...deltas: StatsDelta[]): StatsDelta[] {
  const byMonth = new Map<MonthKey, StatsDelta>();
  for (const d of deltas) {
    const acc = byMonth.get(d.month) ?? emptyDelta(d.month);
    for (const s of SCALARS) acc[s] += d[s];
    for (const c of COUNTERS) addCounter(acc[c], d[c]);
    byMonth.set(d.month, acc);
  }
  const out: StatsDelta[] = [];
  for (const d of byMonth.values()) {
    for (const c of COUNTERS) for (const [k, v] of Object.entries(d[c])) if (v === 0) delete d[c][k];
    const empty = SCALARS.every((s) => d[s] === 0) && COUNTERS.every((c) => Object.keys(d[c]).length === 0);
    if (!empty) out.push(d);
  }
  return out;
}

export function expenseUpdateStatsDeltas(before: ExpenseLike, after: ExpenseLike): StatsDelta[] {
  return mergeStatsDeltas(expenseStatsDelta(before, -1), expenseStatsDelta(after, 1));
}

export function incomeUpdateStatsDeltas(before: IncomeLike, after: IncomeLike): StatsDelta[] {
  return mergeStatsDeltas(incomeStatsDelta(before, -1), incomeStatsDelta(after, 1));
}

/** Pure application of a delta (used to verify increments against a full rebuild). */
export function applyStatsDelta(stats: MonthlyStats, delta: StatsDelta): MonthlyStats {
  const next: MonthlyStats = { ...stats, byCategory: { ...stats.byCategory }, byPaymentMethod: { ...stats.byPaymentMethod }, byAccount: { ...stats.byAccount }, byDay: { ...stats.byDay }, incomeBySource: { ...stats.incomeBySource } };
  for (const s of SCALARS) next[s] += delta[s];
  for (const c of COUNTERS) {
    addCounter(next[c], delta[c]);
    for (const [k, v] of Object.entries(next[c])) if (v === 0) delete next[c][k];
  }
  return next;
}

/** Full rebuild of one month from source documents. */
export function computeMonthlyStats(month: MonthKey, expenses: readonly ExpenseLike[], incomes: readonly IncomeLike[]): MonthlyStats {
  let stats = emptyStats(month);
  for (const e of expenses) if (monthKey(e.occurredAt) === month) stats = applyStatsDelta(stats, expenseStatsDelta(e, 1));
  for (const i of incomes) if (i.forMonth === month) stats = applyStatsDelta(stats, incomeStatsDelta(i, 1));
  return stats;
}

/** Sums several months (e.g. a quarter) into one aggregate. */
export function sumStats(list: readonly MonthlyStats[], label = "sum"): MonthlyStats {
  return list.reduce((acc, s) => {
    const { version: _v, ...delta } = s;
    void _v;
    return applyStatsDelta(acc, { ...delta, month: label });
  }, emptyStats(label));
}
