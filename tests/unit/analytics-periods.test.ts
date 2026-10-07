import { describe, expect, it } from "vitest";

import { calendarLabel, isMonthAligned, resolveSelection } from "@/lib/analytics/period";
import type { DayPoint } from "@/lib/analytics/metrics";
import { autoGranularity, granularitiesFor, monthTotals, periodSummary, trendPoints } from "@/components/analytics/use-analytics-model";

// Wednesday 7 Oct 2026, mid-afternoon.
const NOW = new Date(2026, 9, 7, 15, 30);

describe("calendar selections", () => {
  it("this week runs Monday–Sunday and compares with the same weekdays of last week", () => {
    const p = resolveSelection({ kind: "week", offset: 0 }, NOW);
    expect(p.from).toEqual(new Date(2026, 9, 5));
    expect(p.to.getDate()).toBe(11);
    expect(p.inProgress).toBe(true);
    expect(p.elapsedDays).toBe(3);
    expect(p.previous.from).toEqual(new Date(2026, 8, 28));
    expect(p.previous.to.getDate()).toBe(30); // Mon–Wed last week
    expect(p.label).toBe("This week · 5–11 Oct");
    expect(p.previous.label).toBe("same point last week");
  });

  it("past weeks are complete and compare with the whole week before", () => {
    const p = resolveSelection({ kind: "week", offset: -2 }, NOW);
    expect(p.from).toEqual(new Date(2026, 8, 21));
    expect(p.inProgress).toBe(false);
    expect(p.elapsedDays).toBe(7);
    expect(p.previous.from).toEqual(new Date(2026, 8, 14));
    expect(p.previous.to.getDate()).toBe(20);
    expect(calendarLabel("week", -2, NOW)).toBe("21–27 Sep");
    // Weeks spanning two months / years.
    expect(calendarLabel("week", -1, new Date(2026, 0, 6))).toBe("Last week");
    expect(calendarLabel("week", -2, new Date(2026, 0, 6))).toBe("22–28 Dec 2025");
    expect(calendarLabel("week", -2, new Date(2026, 0, 13))).toBe("29 Dec 2025 – 4 Jan");
  });

  it("months step back and stay month-aligned (served from monthly summaries)", () => {
    const p = resolveSelection({ kind: "month", offset: -14 }, NOW);
    expect(p.from).toEqual(new Date(2025, 7, 1));
    expect(isMonthAligned(p)).toBe(true);
    expect(isMonthAligned(p.previous)).toBe(true);
    expect(p.label).toBe("August 2025");
    expect(calendarLabel("month", -3, NOW)).toBe("July");
  });

  it("years compare with the previous year (same point while in progress)", () => {
    const cur = resolveSelection({ kind: "year", offset: 0 }, NOW);
    expect(cur.months).toHaveLength(12);
    expect(cur.inProgress).toBe(true);
    expect(cur.previous.from).toEqual(new Date(2025, 0, 1));
    expect(cur.previous.to.getMonth()).toBe(9);
    expect(cur.previous.to.getDate()).toBe(7);
    const past = resolveSelection({ kind: "year", offset: -2 }, NOW);
    expect(past.label).toBe("2024");
    expect(past.elapsedDays).toBe(366);
    expect(isMonthAligned(past.previous)).toBe(true);
  });

  it("never resolves a future period", () => {
    expect(resolveSelection({ kind: "month", offset: 3 }, NOW).from).toEqual(new Date(2026, 9, 1));
  });
});

describe("rolling ranges and custom", () => {
  it("last N days end today and compare with the N days before", () => {
    const p = resolveSelection({ kind: "range", range: "30d" }, NOW);
    expect(p.from).toEqual(new Date(2026, 8, 8));
    expect(p.elapsedDays).toBe(30);
    expect(p.previous.to.getDate()).toBe(7);
    expect(p.previous.from).toEqual(new Date(2026, 7, 9));
    expect(p.previous.label).toBe("previous 30 days");
  });

  it("last N months include the current month", () => {
    const p = resolveSelection({ kind: "range", range: "6m" }, NOW);
    expect(p.months).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("custom ranges are ordered and inclusive", () => {
    const p = resolveSelection({ kind: "custom", from: new Date(2026, 8, 19), to: new Date(2026, 8, 10) }, NOW);
    expect(p.from).toEqual(new Date(2026, 8, 10));
    expect(p.elapsedDays).toBe(10);
  });
});

describe("trend grouping and summary", () => {
  const day = (d: number, total: number, month = 8): DayPoint => ({ date: new Date(2026, month, d), key: `2026-${month + 1}-${d}`, total });

  it("offers groupings that fit the period length", () => {
    expect(granularitiesFor(7)).toEqual(["day"]);
    expect(granularitiesFor(31)).toEqual(["day", "week"]);
    expect(granularitiesFor(365)).toEqual(["week", "month"]);
    expect(autoGranularity(31)).toBe("day");
    expect(autoGranularity(365)).toBe("month");
  });

  it("groups by week with the previous period aligned", () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i + 1, 100));
    const { points } = trendPoints(days, days, "week");
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.reduce((s, p) => s + p.current, 0)).toBe(1400);
  });

  it("summarises averages, the biggest day and no-spend days", () => {
    const days = Array.from({ length: 28 }, (_, i) => day(i + 1, i === 9 ? 50000 : i % 2 ? 0 : 1000));
    const total = days.reduce((s, d) => s + d.total, 0);
    const s = periodSummary(days, total, 15);
    expect(s.busiest?.date).toEqual(new Date(2026, 8, 10));
    expect(s.noSpendDays).toBe(13); // odd days are 0 except day 10, the biggest
    expect(s.perWeek).toBe(Math.round(((total / 28) * 7) / 100) * 100);
    expect(s.perMonth).not.toBeNull();
    expect(periodSummary(days.slice(0, 3), 100, 0)).toMatchObject({ perWeek: null, perMonth: null, perTransaction: null });
    expect(monthTotals([day(30, 5), day(1, 7, 9)]).map((m) => m.total)).toEqual([5, 7]);
  });
});
