import {
  type DocumentReference,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type SetOptions,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { monthRange } from "@/lib/months";
import { computeMonthlyStats, type MonthlyStats, STATS_VERSION, type StatsDelta } from "@/lib/stats/monthly";
import type { MonthKey } from "@/types";

import { expenseConverter, incomeConverter } from "./converters";
import { expensesCol, incomesCol, monthlyStatsCol, monthlyStatsDoc } from "./paths";

type SetFn = (ref: DocumentReference, data: Record<string, unknown>, options: SetOptions) => unknown;

function counterIncrements(counter: Record<string, number>) {
  return Object.fromEntries(Object.entries(counter).map(([k, v]) => [k, increment(v)]));
}

/**
 * Applies stats deltas inside the same batch/transaction as the source write
 * (`set` = batch.set / tx.set). Merge + increments create the month document if needed.
 */
export function applyStatsDeltas(set: SetFn, uid: string, deltas: StatsDelta[]): void {
  for (const d of deltas) {
    set(
      monthlyStatsDoc(uid, d.month),
      {
        month: d.month,
        expenseTotal: increment(d.expenseTotal),
        expenseCount: increment(d.expenseCount),
        incomeTotal: increment(d.incomeTotal),
        incomeCount: increment(d.incomeCount),
        byCategory: counterIncrements(d.byCategory),
        byPaymentMethod: counterIncrements(d.byPaymentMethod),
        byAccount: counterIncrements(d.byAccount),
        byDay: counterIncrements(d.byDay),
        incomeBySource: counterIncrements(d.incomeBySource),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

const counter = (value: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "number" && v !== 0) out[k] = v;
    }
  }
  return out;
};
const num = (v: unknown) => (typeof v === "number" ? v : 0);

export function subscribeMonthlyStats(
  uid: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
  onData: (stats: MonthlyStats[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(monthlyStatsCol(uid), where("month", ">=", fromMonth), where("month", "<=", toMonth), orderBy("month", "asc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            month: d.id,
            version: typeof data.version === "number" ? data.version : null,
            expenseTotal: num(data.expenseTotal),
            expenseCount: num(data.expenseCount),
            incomeTotal: num(data.incomeTotal),
            incomeCount: num(data.incomeCount),
            byCategory: counter(data.byCategory),
            byPaymentMethod: counter(data.byPaymentMethod),
            byAccount: counter(data.byAccount),
            byDay: counter(data.byDay),
            incomeBySource: counter(data.incomeBySource),
          };
        }),
      ),
    onError,
  );
}

/**
 * Rebuilds months from source data (one bounded query per month) and overwrites their
 * aggregates. Used for months that predate Phase 4 or whose aggregate is missing/outdated.
 */
export async function rebuildMonthlyStats(uid: string, months: MonthKey[]): Promise<void> {
  if (months.length === 0) return;
  const batch = writeBatch(getDb());
  for (const month of months) {
    const { from, to } = monthRange(month);
    const [expenses, incomes] = await Promise.all([
      getDocs(
        query(expensesCol(uid), where("occurredAt", ">=", Timestamp.fromDate(from)), where("occurredAt", "<=", Timestamp.fromDate(to))).withConverter(
          expenseConverter,
        ),
      ),
      getDocs(query(incomesCol(uid), where("forMonth", "==", month)).withConverter(incomeConverter)),
    ]);
    const stats = computeMonthlyStats(
      month,
      expenses.docs.map((d) => d.data()),
      incomes.docs.map((d) => d.data()),
    );
    batch.set(monthlyStatsDoc(uid, month), { ...stats, version: STATS_VERSION, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}
