import { describe, expect, it } from "vitest";

import { budgetProgress, effectiveBudget } from "@/lib/finance/budget";
import { computeEmi, emiOverview, obligationForMonth, obligationsForMonth, splitNextInstallment } from "@/lib/finance/emi";
import { goalProgress } from "@/lib/finance/goals";
import { pendingRecurring, recurringIncomeId, salaryStats } from "@/lib/finance/income";
import { monthSummary } from "@/lib/finance/summary";
import { dayInMonth, monthsBetween, recentMonths, shiftMonth } from "@/lib/months";
import { outstandingAfter } from "@/lib/services/emi.service";
import type { Budget, Emi, Goal, Income, RecurringIncome } from "@/types";

const loan = (patch: Partial<Emi> = {}): Emi => ({
  id: "l1",
  name: "Car",
  lender: null,
  principal: 50000000, // ₹5,00,000
  annualRateBps: 900, // 9%
  monthlyAmount: computeEmi(50000000, 900, 60),
  tenureMonths: 60,
  startDate: new Date(2026, 0, 5),
  paidCount: 0,
  outstanding: 50000000,
  status: "active",
  createdAt: new Date(2026, 0, 1),
  ...patch,
});

describe("months", () => {
  it("shifts across years and lists ranges", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(recentMonths("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
  it("clamps day-of-month", () => {
    expect(dayInMonth("2026-02", 31)).toEqual(new Date(2026, 1, 28));
    expect(dayInMonth("2028-02", 30)).toEqual(new Date(2028, 1, 29));
  });
});

describe("EMI maths", () => {
  it("matches the standard reducing-balance formula", () => {
    // ₹5L at 9% for 60 months ≈ ₹10,379.18
    expect(computeEmi(50000000, 900, 60)).toBe(1037918);
    expect(computeEmi(1200000, 0, 12)).toBe(100000);
  });

  it("splits the first installment into interest and principal", () => {
    const split = splitNextInstallment(loan());
    expect(split.interestPart).toBe(375000); // 5L × 9%/12
    expect(split.principalPart).toBe(1037918 - 375000);
    expect(split.amount).toBe(1037918);
  });

  it("pays the loan down to exactly zero over the tenure", () => {
    expect(outstandingAfter(loan(), 60)).toBe(0);
    let l = loan();
    let interest = 0;
    for (let i = 0; i < 60; i++) {
      const s = splitNextInstallment(l);
      interest += s.interestPart;
      l = { ...l, outstanding: l.outstanding - s.principalPart, paidCount: l.paidCount + 1 };
    }
    expect(l.outstanding).toBe(0);
    expect(interest).toBeGreaterThan(12000000);
    expect(interest).toBeLessThan(12600000);
  });

  it("supports loans already partly repaid", () => {
    const after12 = outstandingAfter(loan(), 12);
    expect(after12).toBeLessThan(50000000);
    expect(after12).toBeGreaterThan(40000000);
  });

  it("computes schedule overview", () => {
    const o = emiOverview(loan({ paidCount: 3 }), new Date(2026, 3, 20));
    expect(o.nextDueDate).toEqual(new Date(2026, 3, 5));
    expect(o.isOverdue).toBe(true);
    expect(o.remainingTenure).toBe(57);
    expect(o.endDate).toEqual(new Date(2030, 11, 5));
    expect(o.progress).toBeCloseTo(0.05);
  });

  it("finds the installment due in a month", () => {
    expect(obligationForMonth(loan(), "2025-12")).toBeNull();
    expect(obligationForMonth(loan({ paidCount: 1 }), "2026-01")).toMatchObject({ installment: 1, paid: true });
    expect(obligationForMonth(loan({ paidCount: 1 }), "2026-02")).toMatchObject({ installment: 2, paid: false });
    expect(obligationForMonth(loan(), "2031-01")).toBeNull();
    const totals = obligationsForMonth([loan({ paidCount: 2 }), loan({ id: "l2", paidCount: 1 })], "2026-02");
    expect(totals.total).toBe(2 * 1037918);
    expect(totals.paid).toBe(1037918);
    expect(totals.pending).toBe(1037918);
  });
});

describe("budgets", () => {
  const b = (month: string, overall: number | null): Budget => ({ month, overall, categories: {}, updatedAt: new Date() });

  it("classifies progress", () => {
    expect(budgetProgress(1000, 500)).toMatchObject({ state: "ok", percent: 50, remaining: 500 });
    expect(budgetProgress(1000, 850).state).toBe("warning");
    expect(budgetProgress(1000, 1200)).toMatchObject({ state: "over", remaining: -200, percent: 120 });
  });

  it("carries the latest earlier budget forward", () => {
    const list = [b("2026-08", 100), b("2026-05", 50)];
    expect(effectiveBudget(list, "2026-10")).toMatchObject({ budget: { month: "2026-08" }, inherited: true });
    expect(effectiveBudget(list, "2026-08")).toMatchObject({ inherited: false });
    expect(effectiveBudget(list, "2026-06")?.budget.month).toBe("2026-05");
    expect(effectiveBudget(list, "2026-01")).toBeNull();
  });
});

const income = (patch: Partial<Income>): Income => ({
  id: Math.random().toString(36),
  amount: 0,
  source: "salary",
  note: "",
  receivedAt: new Date(),
  forMonth: "2026-10",
  expectedAt: null,
  recurringId: null,
  type: "INCOME",
  accountId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...patch,
});

describe("income", () => {
  it("lists recurring incomes not yet recorded this month", () => {
    const templates: RecurringIncome[] = [
      { id: "t1", name: "Salary", source: "salary", amount: 100, dayOfMonth: 31, startMonth: "2026-01", active: true, accountId: null, autoRecord: false, createdAt: new Date() },
      { id: "t2", name: "Rent in", source: "other", amount: 50, dayOfMonth: 5, startMonth: "2026-01", active: true, accountId: null, autoRecord: false, createdAt: new Date() },
      { id: "t3", name: "Paused", source: "other", amount: 50, dayOfMonth: 5, startMonth: "2026-01", active: false, accountId: null, autoRecord: false, createdAt: new Date() },
      { id: "t4", name: "Future", source: "other", amount: 50, dayOfMonth: 5, startMonth: "2027-01", active: true, accountId: null, autoRecord: false, createdAt: new Date() },
    ];
    const recorded = [income({ id: recurringIncomeId("t2", "2026-09"), recurringId: "t2", forMonth: "2026-09" })];
    const pending = pendingRecurring(templates, recorded, "2026-09");
    expect(pending.map((p) => p.template.id)).toEqual(["t1"]);
    expect(pending[0].expectedAt).toEqual(new Date(2026, 8, 30));
  });

  it("computes salary growth, average and lateness", () => {
    const stats = salaryStats([
      income({ amount: 100000, forMonth: "2026-08", receivedAt: new Date(2026, 8, 1), expectedAt: new Date(2026, 7, 31) }),
      income({ amount: 110000, forMonth: "2026-09", receivedAt: new Date(2026, 8, 30), expectedAt: new Date(2026, 8, 30) }),
      income({ amount: 5000, forMonth: "2026-09", receivedAt: new Date(2026, 9, 2) }),
      income({ amount: 999, source: "bonus", forMonth: "2026-09" }),
    ]);
    expect(stats.months.map((m) => m.month)).toEqual(["2026-09", "2026-08"]);
    expect(stats.latest?.total).toBe(115000);
    expect(stats.average).toBe(107500);
    expect(stats.changeFromPrevious).toBeCloseTo(0.15);
    expect(stats.months[1].daysLate).toBe(1);
    expect(stats.months[0].daysLate).toBe(0);
  });
});

describe("goals", () => {
  const goal = (patch: Partial<Goal> = {}): Goal => ({
    id: "g",
    name: "Phone",
    icon: "phone",
    color: "violet",
    targetAmount: 120000,
    savedAmount: 30000,
    targetDate: new Date(2027, 0, 15),
    status: "active",
    createdAt: new Date(),
    ...patch,
  });

  it("computes remaining and monthly need", () => {
    const p = goalProgress(goal(), new Date(2026, 9, 6));
    expect(p).toMatchObject({ remaining: 90000, percent: 25, achieved: false, monthsLeft: 3, perMonth: 30000 });
  });

  it("caps at 100% when achieved", () => {
    expect(goalProgress(goal({ savedAmount: 150000 }))).toMatchObject({ ratio: 1, achieved: true, perMonth: null, remaining: 0 });
  });
});

describe("monthSummary", () => {
  it("combines income, expenses, savings rate, EMIs and budget", () => {
    const s = monthSummary({
      month: "2026-02",
      incomes: [income({ amount: 100000, forMonth: "2026-02" }), income({ amount: 7, forMonth: "2026-01" })],
      spent: 50000,
      budget: { month: "2026-01", overall: 40000, categories: {}, updatedAt: new Date() },
      emis: [loan({ paidCount: 1 })],
    });
    expect(s).toMatchObject({ income: 100000, expenses: 50000, savings: 50000, savingsRate: 0.5 });
    expect(s.budget).toMatchObject({ state: "over", percent: 125 });
    expect(s.emi).toMatchObject({ total: 1037918, paid: 0 });
  });

  it("has no savings rate without income", () => {
    expect(monthSummary({ month: "2026-02", incomes: [], spent: 0, budget: null, emis: [] }).savingsRate).toBeNull();
  });
});

describe("emiFormSchema", () => {
  it("rejects already-paid installments whose due dates are still in the future", async () => {
    const { emiFormSchema } = await import("@/lib/validation/finance");
    const base = { name: "Car", lender: "", principal: "500000", rate: "9", tenureMonths: "60", monthlyAmount: "", alreadyPaid: "10" };
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bad = emiFormSchema.safeParse({ ...base, startOn: iso(today) });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].path).toEqual(["startOn"]);
    const ok = emiFormSchema.safeParse({ ...base, startOn: iso(new Date(today.getFullYear() - 1, today.getMonth(), 1)) });
    expect(ok.success).toBe(true);
  });
});
