import { describe, expect, it } from "vitest";

import { dailyTotals, groupByDay, summarizeDashboard, totalsByCategory } from "@/lib/analytics";
import { searchExpenses } from "@/lib/filters";
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from "@/lib/constants/categories";
import type { Expense } from "@/types";

let seq = 0;
function expense(partial: Partial<Expense> & Pick<Expense, "amount" | "occurredAt">): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    categoryId: "food",
    paymentMethod: "upi",
    note: "",
    type: "EXPENSE",
    accountId: null,
    recurringId: null,
    occurrence: null,
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    ...partial,
  };
}

const NOW = new Date(2026, 9, 6, 15, 0); // 6 Oct 2026, 3pm local

const data: Expense[] = [
  expense({ amount: 10000, occurredAt: new Date(2026, 9, 6, 9), note: "Breakfast" }),
  expense({ amount: 5000, occurredAt: new Date(2026, 9, 6, 8), categoryId: "transport", paymentMethod: "cash" }),
  expense({ amount: 20000, occurredAt: new Date(2026, 9, 2, 20), categoryId: "shopping", note: "Shoes" }),
  expense({ amount: 7000, occurredAt: new Date(2026, 8, 30, 12), note: "Lunch" }), // last month, within 7 days
  expense({ amount: 99900, occurredAt: new Date(2026, 9, 20, 12), categoryId: "bills" }), // future, this month
];

describe("summarizeDashboard", () => {
  const summary = summarizeDashboard(data, NOW);

  it("totals today and the month", () => {
    expect(summary.today).toBe(15000);
    expect(summary.todayCount).toBe(2);
    expect(summary.month).toBe(10000 + 5000 + 20000 + 99900);
    expect(summary.monthCount).toBe(4);
  });

  it("excludes future-dated expenses from the daily average", () => {
    expect(summary.dailyAverage).toBe(Math.round(35000 / 6));
  });

  it("builds a 7-day series ending today, oldest first", () => {
    expect(summary.last7Days).toHaveLength(7);
    expect(summary.last7Days[0].date).toEqual(new Date(2026, 8, 30));
    expect(summary.last7Days[0].total).toBe(7000);
    expect(summary.last7Days[6].total).toBe(15000);
  });

  it("ranks categories by spend with shares", () => {
    expect(summary.byCategory[0]).toMatchObject({ categoryId: "bills", total: 99900, count: 1 });
    const shares = summary.byCategory.reduce((s, c) => s + c.share, 0);
    expect(shares).toBeCloseTo(1);
  });
});

describe("totalsByCategory / dailyTotals", () => {
  it("handles empty input", () => {
    expect(totalsByCategory([])).toEqual([]);
    expect(dailyTotals([], 3, NOW).map((d) => d.total)).toEqual([0, 0, 0]);
  });
});

describe("groupByDay", () => {
  it("groups consecutive days with totals", () => {
    const sorted = [...data].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const groups = groupByDay(sorted);
    expect(groups.map((g) => g.key)).toEqual(["2026-10-20", "2026-10-06", "2026-10-02", "2026-09-30"]);
    expect(groups[1].total).toBe(15000);
    expect(groups[1].items).toHaveLength(2);
  });
});

describe("searchExpenses", () => {
  const getCategory = (id: string) => DEFAULT_CATEGORIES.find((c) => c.id === id) ?? FALLBACK_CATEGORY;

  it("matches note, category, payment method and amount", () => {
    expect(searchExpenses(data, "shoes", getCategory)).toHaveLength(1);
    expect(searchExpenses(data, "transport", getCategory)).toHaveLength(1);
    expect(searchExpenses(data, "cash", getCategory)).toHaveLength(1);
    expect(searchExpenses(data, "999", getCategory)).toHaveLength(1);
  });

  it("requires every term to match", () => {
    expect(searchExpenses(data, "food lunch", getCategory)).toHaveLength(1);
    expect(searchExpenses(data, "food shoes", getCategory)).toHaveLength(0);
  });

  it("returns everything for a blank query", () => {
    expect(searchExpenses(data, "   ", getCategory)).toHaveLength(data.length);
  });
});
