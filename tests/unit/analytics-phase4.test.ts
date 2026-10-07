import { describe, expect, it } from "vitest";

import { canUseAggregates, NO_FILTERS, spendFromExpenses, spendFromStats } from "@/lib/analytics/dataset";
import { buildInsights, THRESHOLDS } from "@/lib/analytics/insights";
import {
  breakdown,
  budgetUtilization,
  categoryTrends,
  change,
  dailySeries,
  emiBurden,
  heatmap,
  monthlySeries,
  subscriptionCosts,
  weekdayPattern,
  weeklySeries,
} from "@/lib/analytics/metrics";
import { fullMonthsIn, isMonthAligned, resolvePeriod } from "@/lib/analytics/period";
import { computeMonthlyStats } from "@/lib/stats/monthly";
import type { Account, Expense, RecurringPayment } from "@/types";

const NOW = new Date(2026, 9, 7, 15, 0); // Wed 7 Oct 2026

let n = 0;
const ex = (amount: number, date: Date, patch: Partial<Expense> = {}): Expense => ({
  id: `e${++n}`,
  amount,
  categoryId: "food",
  paymentMethod: "upi",
  note: "",
  occurredAt: date,
  type: "EXPENSE",
  accountId: null,
  recurringId: null,
  occurrence: null,
  createdAt: date,
  updatedAt: date,
  ...patch,
});

describe("periods", () => {
  it("this month compares against the same elapsed days of last month", () => {
    const p = resolvePeriod("this-month", {}, NOW);
    expect(p.inProgress).toBe(true);
    expect(p.elapsedDays).toBe(7);
    expect(p.previous.from).toEqual(new Date(2026, 8, 1));
    expect(p.previous.to.getDate()).toBe(7);
    expect(p.previous.to.getMonth()).toBe(8);
  });

  it("completed months compare with the same number of months before", () => {
    const p = resolvePeriod("last-month", {}, NOW);
    expect(p.inProgress).toBe(false);
    expect(isMonthAligned(p)).toBe(true);
    expect(isMonthAligned(p.previous)).toBe(true);
    expect(p.previous.from).toEqual(new Date(2026, 7, 1));
    const q = resolvePeriod("3m", {}, NOW);
    expect(q.months).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(q.previous.from).toEqual(new Date(2026, 4, 1));
  });

  it("custom ranges compare with an equal-length span just before", () => {
    const p = resolvePeriod("custom", { from: new Date(2026, 8, 10), to: new Date(2026, 8, 19) }, NOW);
    expect(p.elapsedDays).toBe(10);
    expect(p.previous.from).toEqual(new Date(2026, 7, 31));
    expect(p.previous.to.getDate()).toBe(9);
    expect(fullMonthsIn(p)).toEqual([]);
  });
});

describe("dataset: aggregates and raw rows agree", () => {
  const rows = [
    ex(1000, new Date(2026, 7, 3), { categoryId: "food", paymentMethod: "credit", accountId: "card" }),
    ex(2500, new Date(2026, 7, 3), { categoryId: "bills" }),
    ex(700, new Date(2026, 8, 15), { categoryId: "food", paymentMethod: "cash" }),
    ex(300, new Date(2026, 8, 30, 23, 59), { categoryId: "fun" }),
  ];
  const stats = ["2026-08", "2026-09"].map((m) => computeMonthlyStats(m, rows, []));

  it("produces identical totals, breakdowns and daily series for whole months", () => {
    const span = { from: new Date(2026, 7, 1), to: new Date(2026, 8, 30, 23, 59, 59, 999) };
    expect(canUseAggregates(span, NO_FILTERS)).toBe(true);
    expect(spendFromStats(stats, span)).toEqual(spendFromExpenses(rows, span));
  });

  it("filters force raw rows and apply AND across dimensions", () => {
    const span = { from: new Date(2026, 7, 1), to: new Date(2026, 8, 30, 23, 59) };
    const f = { categoryIds: ["food"], accountIds: [], paymentMethods: ["cash" as const] };
    expect(canUseAggregates(span, f)).toBe(false);
    expect(spendFromExpenses(rows, span, f)).toMatchObject({ total: 700, count: 1 });
    expect(spendFromExpenses(rows, span, { ...NO_FILTERS, accountIds: ["_none"] }).total).toBe(3500);
  });
});

describe("metrics", () => {
  it("computes change with a null ratio from zero", () => {
    expect(change(150, 100)).toEqual({ current: 150, previous: 100, delta: 50, ratio: 0.5 });
    expect(change(10, 0).ratio).toBeNull();
  });

  it("folds the breakdown tail into Other", () => {
    const rows = breakdown({ a: 50, b: 20, c: 10, d: 10, e: 5, f: 5 }, { a: 25 }, 3);
    expect(rows.map((r) => r.key)).toEqual(["a", "b", "c", "__other__"]);
    expect(rows[3].total).toBe(20);
    expect(rows[0].change.ratio).toBe(1);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
  });

  it("builds daily, weekly, weekday and heatmap views", () => {
    const span = { from: new Date(2026, 8, 28), to: new Date(2026, 9, 4, 23, 59) }; // Mon → Sun
    const spend = spendFromExpenses([ex(100, new Date(2026, 8, 28)), ex(300, new Date(2026, 9, 3)), ex(500, new Date(2026, 9, 4))], span);
    const days = dailySeries(spend, span);
    expect(days.map((d) => d.total)).toEqual([100, 0, 0, 0, 0, 300, 500]);
    expect(weeklySeries(days)).toEqual([{ weekStart: new Date(2026, 8, 28), total: 900, days: 7 }]);
    const wd = weekdayPattern(days);
    expect(wd[6]).toMatchObject({ label: "Sun", total: 500, days: 1, average: 500 });
    const grid = heatmap(days);
    expect(grid).toHaveLength(1);
    expect(grid[0].map((c) => c.level)).toEqual([1, 0, 0, 0, 0, 2, 4]);
  });

  it("monthly series, savings rate and category trends from aggregates", () => {
    const rows = [ex(4000, new Date(2026, 7, 2), { categoryId: "food" }), ex(1000, new Date(2026, 8, 2), { categoryId: "fun" })];
    const stats = [
      computeMonthlyStats("2026-08", rows, [{ amount: 10000, source: "salary", forMonth: "2026-08" }]),
      computeMonthlyStats("2026-09", rows, []),
    ];
    const series = monthlySeries(["2026-08", "2026-09", "2026-10"], stats);
    expect(series.map((s) => [s.expenses, s.income, s.savingsRate])).toEqual([
      [4000, 10000, 0.6],
      [1000, 0, null],
      [0, 0, null],
    ]);
    const trends = categoryTrends(["2026-08", "2026-09"], stats, 1);
    expect(trends.keys).toEqual(["food"]);
    expect(trends.rows[1]).toMatchObject({ food: 0, __other__: 1000 });
  });

  it("budget utilisation flags over-budget categories per month", () => {
    const stats = [computeMonthlyStats("2026-09", [ex(6000, new Date(2026, 8, 3)), ex(500, new Date(2026, 8, 4), { categoryId: "fun" })], [])];
    const [m] = budgetUtilization(["2026-09"], stats, [{ month: "2026-08", overall: 10000, categories: { food: 5000, fun: 1000 }, updatedAt: NOW }]);
    expect(m.overall).toMatchObject({ percent: 65, state: "ok" });
    expect(m.overCategories.map((c) => c.categoryId)).toEqual(["food"]);
  });

  it("annualises recurring payments and measures EMI burden", () => {
    const rp = (amount: number, unit: RecurringPayment["unit"], active = true) => ({ amount, unit, interval: 1, active }) as RecurringPayment;
    const s = subscriptionCosts([rp(64900, "month"), rp(149900, "year"), rp(1, "month", false)]);
    expect(s.items.map((i) => i.annual)).toEqual([778800, 149904]);
    expect(s.annual).toBe((64900 + 12492) * 12);
    const emi = { startDate: new Date(2026, 0, 5), tenureMonths: 24, monthlyAmount: 2000000, paidCount: 9, status: "active" } as never;
    expect(emiBurden([emi], "2026-10", 5000000)).toEqual({ monthly: 2000000, ofIncome: 0.4 });
  });
});

describe("insights", () => {
  const base = {
    currency: "INR" as const,
    periodLabel: "This month",
    previousLabel: "same point last month",
    current: { total: 0, count: 0, byCategory: {}, byPaymentMethod: {}, byAccount: {}, daily: {} },
    categoryBaseline: { months: 0, perMonth: {} },
    periodMonths: 1,
    categoryName: (id: string) => id.charAt(0).toUpperCase() + id.slice(1),
    budgets: [],
    months: [],
    recurring: { monthly: 0, ofIncome: null },
    emi: { monthly: 0, ofIncome: null },
    cards: [] as Account[],
    weekdays: [],
  };

  it("is silent when nothing crosses a threshold", () => {
    expect(buildInsights({ ...base, spending: change(100000, 95000) })).toEqual([]);
  });

  it("flags a spending increase with an explainable detail", () => {
    const [i] = buildInsights({ ...base, spending: change(500000, 300000) });
    expect(i.id).toBe("spending-change");
    expect(i.title).toBe("Spending up 67% vs same point last month");
    expect(i.detail).toContain(`${Math.round(THRESHOLDS.spendingChange * 100)}%`);
  });

  it("detects category spikes, card utilisation, savings shifts and weekday skew", () => {
    const insights = buildInsights({
      ...base,
      spending: change(900000, 880000),
      current: { ...base.current, total: 900000, byCategory: { food: 600000, bills: 300000 } },
      categoryBaseline: { months: 3, perMonth: { food: 300000, bills: 300000 } },
      cards: [{ id: "c", name: "Amex", type: "credit_card", balance: -8000000, creditLimit: 10000000 } as Account],
      months: [
        { month: "2026-08", label: "Aug", expenses: 1, income: 1, savings: 0, savingsRate: 0.3 },
        { month: "2026-09", label: "Sep", expenses: 1, income: 1, savings: 0, savingsRate: 0.1 },
      ],
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, weekday) => ({
        weekday,
        label,
        days: 4,
        total: weekday === 5 ? 40000 : 8000,
        average: weekday === 5 ? 10000 : 2000,
      })),
    });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("category-spike-food");
    expect(ids).not.toContain("category-spike-bills");
    expect(ids).toContain("card-util-c");
    expect(ids).toContain("savings-rate-shift");
    expect(insights.find((i) => i.id === "weekday-pattern")?.title).toBe("You spend most on Saturdays");
    expect(insights.find((i) => i.id === "largest-category")?.title).toBe("Food is your biggest category");
    // Highest priority first: 80% card utilisation outranks the rest.
    expect(insights[0].id).toBe("card-util-c");
  });
});
