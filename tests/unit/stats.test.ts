import { describe, expect, it } from "vitest";

import {
  applyStatsDelta,
  computeMonthlyStats,
  emptyStats,
  expenseStatsDelta,
  expenseUpdateStatsDeltas,
  incomeStatsDelta,
  incomeUpdateStatsDeltas,
  mergeStatsDeltas,
  NO_ACCOUNT,
  sumStats,
} from "@/lib/stats/monthly";
import type { Expense, Income } from "@/types";

const e = (amount: number, day: number, patch: Partial<Expense> = {}) =>
  ({ amount, categoryId: "food", paymentMethod: "upi", accountId: null, occurredAt: new Date(2026, 9, day, 12), ...patch }) as Expense;
const inc = (amount: number, patch: Partial<Income> = {}) => ({ amount, source: "salary", forMonth: "2026-10", ...patch }) as Income;

describe("monthly stats deltas", () => {
  it("records an expense across every dimension", () => {
    const d = expenseStatsDelta(e(500, 7, { accountId: "hdfc", paymentMethod: "credit" }), 1);
    expect(d).toMatchObject({
      month: "2026-10",
      expenseTotal: 500,
      expenseCount: 1,
      byCategory: { food: 500 },
      byPaymentMethod: { credit: 500 },
      byAccount: { hdfc: 500 },
      byDay: { "07": 500 },
    });
    expect(expenseStatsDelta(e(500, 7), 1).byAccount).toEqual({ [NO_ACCOUNT]: 500 });
  });

  it("an edit within the month nets to only what changed", () => {
    const [d] = expenseUpdateStatsDeltas(e(500, 7), e(800, 7, { categoryId: "fun" }));
    expect(d.expenseTotal).toBe(300);
    expect(d.expenseCount).toBe(0);
    expect(d.byCategory).toEqual({ food: -500, fun: 800 });
    expect(d.byPaymentMethod).toEqual({ upi: 300 });
    expect(expenseUpdateStatsDeltas(e(500, 7), e(500, 7))).toEqual([]);
  });

  it("an edit that moves months touches both months", () => {
    const deltas = expenseUpdateStatsDeltas(e(500, 7), { ...e(500, 7), occurredAt: new Date(2026, 8, 30) });
    expect(deltas.map((d) => [d.month, d.expenseTotal, d.expenseCount])).toEqual([
      ["2026-10", -500, -1],
      ["2026-09", 500, 1],
    ]);
  });

  it("income uses forMonth", () => {
    expect(incomeStatsDelta(inc(100, { forMonth: "2026-09" }), 1)).toMatchObject({ month: "2026-09", incomeTotal: 100, incomeBySource: { salary: 100 } });
    const [d] = incomeUpdateStatsDeltas(inc(100), inc(150, { source: "bonus" }));
    expect(d).toMatchObject({ incomeTotal: 50, incomeCount: 0, incomeBySource: { salary: -100, bonus: 150 } });
  });
});

describe("increments stay consistent with a full rebuild", () => {
  it("random history of creates, edits and deletes matches computeMonthlyStats", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const cats = ["food", "fun", "bills"];
    const methods = ["upi", "credit", "cash"] as const;
    let live: Expense[] = [];
    let stats = emptyStats("2026-10");
    for (let step = 0; step < 300; step++) {
      const action = live.length === 0 ? 0 : rand(3);
      if (action === 0) {
        const x = e(1 + rand(5000), 1 + rand(31), { categoryId: cats[rand(3)], paymentMethod: methods[rand(3)], accountId: rand(2) ? "a" : null });
        live.push(x);
        for (const d of mergeStatsDeltas(expenseStatsDelta(x, 1))) stats = applyStatsDelta(stats, d);
      } else if (action === 1) {
        const i = rand(live.length);
        const after = { ...live[i], amount: 1 + rand(5000), categoryId: cats[rand(3)] };
        for (const d of expenseUpdateStatsDeltas(live[i], after)) stats = applyStatsDelta(stats, d);
        live[i] = after;
      } else {
        const i = rand(live.length);
        for (const d of mergeStatsDeltas(expenseStatsDelta(live[i], -1))) stats = applyStatsDelta(stats, d);
        live = live.filter((_, j) => j !== i);
      }
    }
    expect(stats).toEqual(computeMonthlyStats("2026-10", live, []));
  });

  it("sums months", () => {
    const a = computeMonthlyStats("2026-09", [e(100, 1, { occurredAt: new Date(2026, 8, 1) })], [inc(1000, { forMonth: "2026-09" })]);
    const b = computeMonthlyStats("2026-10", [e(50, 2), e(25, 2, { categoryId: "fun" })], []);
    expect(sumStats([a, b])).toMatchObject({ expenseTotal: 175, expenseCount: 3, incomeTotal: 1000, byCategory: { food: 150, fun: 25 } });
  });
});
