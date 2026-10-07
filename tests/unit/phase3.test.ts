import { describe, expect, it } from "vitest";

import { afterCardPayment, availableCredit, cardCycle, cardOutstanding, cardUtilization, suggestedMinimumDue } from "@/lib/finance/accounts";
import {
  applyEffects,
  expenseEffects,
  expenseUpdateEffects,
  incomeEffects,
  investmentTxEffects,
  mergeEffects,
  reverseEffects,
  transferEffects,
} from "@/lib/finance/ledger";
import { applyBuy, applySell, applyValuation, investmentReturns, portfolioTotals } from "@/lib/finance/investments";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { frequencyLabel, monthlyEquivalent, nextOccurrence, occurrenceDate, occurrencesUntil, recurringExpenseId } from "@/lib/finance/recurrence";
import { buildUpcoming, upcomingOutflow } from "@/lib/finance/upcoming";
import type { Account, Emi, Investment, RecurringPayment } from "@/types";

const account = (patch: Partial<Account>): Account => ({
  id: "a",
  name: "A",
  type: "bank",
  institution: null,
  openingBalance: 0,
  balance: 0,
  active: true,
  creditLimit: null,
  statementDay: null,
  dueDay: null,
  statementBalance: null,
  minimumDue: null,
  createdAt: new Date(),
  ...patch,
});

describe("ledger effects", () => {
  const start = { bank: 100000, wallet: 5000, card: -20000 };

  it("account transfer moves money without changing the total", () => {
    const effects = transferEffects({ amount: 30000, fromAccountId: "bank", toAccountId: "wallet" });
    const after = applyEffects(start, effects);
    expect(after).toEqual({ bank: 70000, wallet: 35000, card: -20000 });
    const total = (b: Record<string, number>) => Object.values(b).reduce((s, v) => s + v, 0);
    expect(total(after)).toBe(total(start));
  });

  it("credit card spend increases debt; payment reduces debt and bank, with no expense involved", () => {
    const spend = applyEffects(start, expenseEffects({ amount: 15000, accountId: "card" }));
    expect(cardOutstanding({ balance: spend.card })).toBe(35000);
    const paid = applyEffects(spend, transferEffects({ amount: 35000, fromAccountId: "bank", toAccountId: "card" }));
    expect(paid.card).toBe(0);
    expect(paid.bank).toBe(65000);
    // Net position change across both events equals the single expense — nothing double-counted.
    const net = (b: Record<string, number>) => b.bank + b.wallet + b.card;
    expect(net(paid) - net(start)).toBe(-15000);
  });

  it("EMI debt payment debits only the source account", () => {
    expect(transferEffects({ amount: 1037918, fromAccountId: "bank", toAccountId: null })).toEqual([
      { accountId: "bank", delta: -1037918 },
    ]);
  });

  it("untracked expenses/incomes don't touch balances", () => {
    expect(expenseEffects({ amount: 100, accountId: null })).toEqual([]);
    expect(incomeEffects({ amount: 100, accountId: null })).toEqual([]);
    expect(incomeEffects({ amount: 100, accountId: "bank" })).toEqual([{ accountId: "bank", delta: 100 }]);
  });

  it("editing an expense nets out correctly", () => {
    expect(expenseUpdateEffects({ amount: 500, accountId: "bank" }, { amount: 800, accountId: "bank" })).toEqual([
      { accountId: "bank", delta: -300 },
    ]);
    expect(expenseUpdateEffects({ amount: 500, accountId: "bank" }, { amount: 500, accountId: "card" })).toEqual([
      { accountId: "bank", delta: 500 },
      { accountId: "card", delta: -500 },
    ]);
    expect(expenseUpdateEffects({ amount: 500, accountId: "bank" }, { amount: 500, accountId: "bank" })).toEqual([]);
    expect(expenseUpdateEffects({ amount: 500, accountId: null }, { amount: 500, accountId: "bank" })).toEqual([
      { accountId: "bank", delta: -500 },
    ]);
  });

  it("deleting reverses exactly", () => {
    const e = expenseEffects({ amount: 999, accountId: "bank" });
    expect(applyEffects(applyEffects(start, e), reverseEffects(e))).toEqual(start);
    expect(mergeEffects(e, reverseEffects(e))).toEqual([]);
  });

  it("investment buys debit, sells credit, valuations don't move cash", () => {
    expect(investmentTxEffects({ kind: "BUY", amount: 100, accountId: "bank" })).toEqual([{ accountId: "bank", delta: -100 }]);
    expect(investmentTxEffects({ kind: "SELL", amount: 120, accountId: "bank" })).toEqual([{ accountId: "bank", delta: 120 }]);
    expect(investmentTxEffects({ kind: "VALUATION", amount: 999, accountId: "bank" })).toEqual([]);
  });
});

describe("credit cards", () => {
  const card = account({ type: "credit_card", balance: -4500000, creditLimit: 15000000 });

  it("computes outstanding, available credit and utilisation", () => {
    expect(cardOutstanding(card)).toBe(4500000);
    expect(availableCredit(card)).toBe(10500000);
    expect(cardUtilization(card)).toBeCloseTo(0.3);
    expect(cardOutstanding({ balance: 500 })).toBe(0); // overpaid card
  });

  it("finds statement and due dates (due next month when dueDay ≤ statementDay)", () => {
    const now = new Date(2026, 9, 6);
    expect(cardCycle(20, 8, now)).toEqual({
      lastStatementDate: new Date(2026, 8, 20),
      nextStatementDate: new Date(2026, 9, 20),
      dueDate: new Date(2026, 9, 8),
    });
    expect(cardCycle(3, 23, now).dueDate).toEqual(new Date(2026, 9, 23));
    expect(cardCycle(31, 15, new Date(2026, 2, 1)).lastStatementDate).toEqual(new Date(2026, 1, 28));
  });

  it("suggests a minimum due and reduces dues on payment", () => {
    expect(suggestedMinimumDue(1000000)).toBe(50000); // 5%
    expect(suggestedMinimumDue(100000)).toBe(20000); // ₹200 floor
    expect(suggestedMinimumDue(15000)).toBe(15000); // never above statement
    expect(afterCardPayment({ statementBalance: 1000000, minimumDue: 50000 }, 60000)).toEqual({ statementBalance: 940000, minimumDue: 0 });
    expect(afterCardPayment({ statementBalance: null, minimumDue: null }, 1)).toEqual({ statementBalance: null, minimumDue: null });
  });
});

describe("investments", () => {
  const base = { investedAmount: 0, currentValue: 0, realizedGain: 0 };

  it("tracks buys, valuation and proportional cost basis on sells", () => {
    let inv = applyBuy(base, 100000);
    inv = applyBuy(inv, 50000);
    expect(inv).toEqual({ investedAmount: 150000, currentValue: 150000, realizedGain: 0 });
    inv = applyValuation(inv, 200000);
    expect(investmentReturns(inv)).toEqual({ absolute: 50000, ratio: 1 / 3 });

    const sold = applySell(inv, 50000); // sell 25% of value
    expect(sold.costBasis).toBe(37500);
    expect(sold.realized).toBe(12500);
    expect(sold.next).toEqual({ investedAmount: 112500, currentValue: 150000, realizedGain: 12500 });
    expect(sold.closed).toBe(false);

    const exit = applySell(sold.next, 150000);
    expect(exit.closed).toBe(true);
    expect(exit.next.investedAmount).toBe(0);
    expect(exit.next.realizedGain).toBe(12500 + 37500);
  });

  it("handles losses and guards invalid sells", () => {
    const inv = applyValuation(applyBuy(base, 100000), 80000);
    const s = applySell(inv, 40000);
    expect(s.realized).toBe(-10000);
    expect(() => applySell(inv, 90000)).toThrow();
    expect(() => applySell(inv, 0)).toThrow();
    expect(investmentReturns({ investedAmount: 0, currentValue: 0 }).ratio).toBeNull();
  });

  it("sums a portfolio", () => {
    const mk = (i: number, c: number, r = 0, status: Investment["status"] = "active") =>
      ({ investedAmount: i, currentValue: c, realizedGain: r, status }) as Investment;
    const t = portfolioTotals([mk(100, 150), mk(200, 180, 10), mk(0, 0, 40, "closed")]);
    expect(t).toMatchObject({ invested: 300, current: 330, absolute: 30, realized: 50 });
  });
});

describe("recurrence", () => {
  const rp = (patch: Partial<RecurringPayment> = {}): RecurringPayment => ({
    id: "rp1",
    name: "Netflix",
    amount: 64900,
    categoryId: "entertainment",
    paymentMethod: "credit",
    accountId: null,
    unit: "month",
    interval: 1,
    startDate: new Date(2026, 0, 31),
    cycle: 0,
    nextDate: new Date(2026, 0, 31),
    endDate: null,
    active: true,
    autoPay: false,
    createdAt: new Date(),
    ...patch,
  });

  it("doesn't drift at month ends", () => {
    const start = new Date(2026, 0, 31);
    expect(occurrenceDate(start, "month", 1, 1)).toEqual(new Date(2026, 1, 28));
    expect(occurrenceDate(start, "month", 1, 2)).toEqual(new Date(2026, 2, 31));
    expect(occurrenceDate(new Date(2024, 1, 29), "year", 1, 1)).toEqual(new Date(2025, 1, 28));
    expect(occurrenceDate(new Date(2026, 0, 1), "week", 2, 3)).toEqual(new Date(2026, 1, 12));
    expect(occurrenceDate(new Date(2026, 0, 1), "day", 10, 3)).toEqual(new Date(2026, 0, 31));
  });

  it("finds next and upcoming occurrences, respecting end date and pause", () => {
    expect(nextOccurrence(rp({ cycle: 2 }))).toEqual(new Date(2026, 2, 31));
    expect(nextOccurrence(rp({ active: false }))).toBeNull();
    expect(nextOccurrence(rp({ cycle: 3, endDate: new Date(2026, 2, 31) }))).toBeNull();
    const list = occurrencesUntil(rp(), new Date(2026, 3, 1));
    expect(list.map((o) => o.cycle)).toEqual([0, 1, 2]);
  });

  it("labels and normalises frequency", () => {
    expect(frequencyLabel("month", 1)).toBe("Monthly");
    expect(frequencyLabel("week", 2)).toBe("Every 2 weeks");
    expect(monthlyEquivalent({ amount: 120000, unit: "year", interval: 1 })).toBe(10000);
    expect(monthlyEquivalent({ amount: 1200, unit: "week", interval: 1 })).toBe(5200);
    expect(recurringExpenseId("rp1", 4)).toBe("rp_rp1_4");
  });
});

describe("net worth", () => {
  it("adds assets, subtracts card and loan liabilities", () => {
    const nw = computeNetWorth({
      accounts: [
        account({ id: "b", type: "bank", balance: 50000000 }),
        account({ id: "c", type: "cash", balance: 200000 }),
        account({ id: "w", type: "wallet", balance: 300000 }),
        account({ id: "cc", type: "credit_card", balance: -4500000 }),
        account({ id: "cc2", type: "credit_card", balance: 10000 }),
      ],
      investments: [
        { currentValue: 20000000, status: "active" } as Investment,
        { currentValue: 999, status: "closed" } as Investment,
      ],
      emis: [{ outstanding: 30000000, status: "active" } as Emi, { outstanding: 5, status: "closed" } as Emi],
    });
    expect(nw.assets).toEqual({ bank: 50000000, cash: 200000, wallet: 300000, investments: 20000000, cardCredit: 10000, total: 70510000 });
    expect(nw.liabilities).toEqual({ creditCards: 4500000, loans: 30000000, total: 34500000 });
    expect(nw.netWorth).toBe(36010000);
  });
});

describe("upcoming payments", () => {
  it("merges recurring payments, EMIs, card dues and expected income within the window", () => {
    const now = new Date(2026, 9, 6);
    const items = buildUpcoming({
      now,
      days: 30,
      recurringPayments: [
        {
          id: "rp",
          name: "Gym",
          amount: 150000,
          categoryId: "health",
          paymentMethod: "upi",
          accountId: null,
          unit: "month",
          interval: 1,
          startDate: new Date(2026, 8, 1),
          cycle: 1, // Sept paid → Oct 1 overdue, Nov 1 upcoming
          nextDate: new Date(2026, 9, 1),
          endDate: null,
          active: true,
          autoPay: false,
          createdAt: now,
        },
      ],
      emis: [
        { id: "e", name: "Car", monthlyAmount: 1000000, tenureMonths: 12, paidCount: 0, status: "active", outstanding: 1, startDate: new Date(2026, 9, 10), principal: 1, annualRateBps: 0, lender: null, createdAt: now },
      ],
      accounts: [account({ id: "cc", type: "credit_card", statementDay: 20, dueDay: 8, statementBalance: 500000, minimumDue: 25000, balance: -500000 })],
      recurringIncomes: [{ id: "sal", name: "Salary", source: "salary", amount: 9000000, dayOfMonth: 31, startMonth: "2026-01", active: true, accountId: null, autoRecord: false, createdAt: now }],
      incomes: [],
    });
    expect(items.map((i) => `${i.kind}:${i.date.getDate()}/${i.date.getMonth() + 1}`)).toEqual([
      "recurring:1/10",
      "card:8/10",
      "emi:10/10",
      "income:31/10",
      "recurring:1/11",
    ]);
    expect(items[0].overdue).toBe(true);
    expect(upcomingOutflow(items)).toBe(150000 * 2 + 500000 + 1000000);
  });
});

describe("account activity", () => {
  it("merges every type with a running balance and excludes valuations", async () => {
    const { accountActivity, activityTotals } = await import("@/lib/finance/activity");
    const d = (day: number) => new Date(2026, 9, day);
    const items = accountActivity("bank", 95000, {
      expenses: [{ id: "e", amount: 5000, accountId: "bank", occurredAt: d(3) } as never, { id: "x", amount: 1, accountId: "other", occurredAt: d(3) } as never],
      incomes: [{ id: "i", amount: 100000, accountId: "bank", receivedAt: d(1) } as never],
      transfers: [
        { id: "t", type: "TRANSFER", amount: 20000, fromAccountId: "bank", toAccountId: "wallet", occurredAt: d(4) } as never,
        { id: "c", type: "DEBT_PAYMENT", amount: 10000, fromAccountId: "bank", toAccountId: "card", occurredAt: d(5) } as never,
      ],
      investmentTxs: [
        { id: "b", kind: "SELL", amount: 30000, accountId: "bank", occurredAt: d(6) } as never,
        { id: "v", kind: "VALUATION", amount: 999, accountId: null, occurredAt: d(7) } as never,
      ],
    });
    expect(items.map((i) => `${i.type}:${i.delta}:${i.balanceAfter}`)).toEqual([
      "INVESTMENT:30000:95000",
      "DEBT_PAYMENT:-10000:65000",
      "TRANSFER:-20000:75000",
      "EXPENSE:-5000:95000",
      "INCOME:100000:100000",
    ]);
    // Opening balance implied by the oldest item: 100000 − 100000 = 0
    expect(items.at(-1)!.balanceAfter - items.at(-1)!.delta).toBe(0);
    expect(activityTotals(items)).toEqual({ moneyIn: 130000, moneyOut: 35000 });
  });
});


describe("recurring automation planning (idempotent)", () => {
  it("plans only due occurrences of auto-pay schedules, from the current cycle", async () => {
    const { planRecurringPayments } = await import("@/lib/finance/automation");
    const base = {
      id: "rent", name: "Rent", amount: 100, categoryId: "home", paymentMethod: "upi" as const, accountId: null,
      unit: "month" as const, interval: 1, startDate: new Date(2026, 6, 1), nextDate: new Date(), endDate: null,
      active: true, autoPay: true, createdAt: new Date(),
    };
    const now = new Date(2026, 9, 7);
    // Cycles 0..3 = Jul, Aug, Sep, Oct 1 — all due; Nov is not.
    expect(planRecurringPayments([{ ...base, cycle: 0 }], now).map((p) => p.cycle)).toEqual([0, 1, 2, 3]);
    // After cycles 0–2 were recorded, only Oct remains: re-running never repeats an occurrence.
    expect(planRecurringPayments([{ ...base, cycle: 3 }], now).map((p) => p.cycle)).toEqual([3]);
    expect(planRecurringPayments([{ ...base, cycle: 4 }], now)).toEqual([]);
    expect(planRecurringPayments([{ ...base, cycle: 0, autoPay: false }], now)).toEqual([]);
    expect(planRecurringPayments([{ ...base, cycle: 0, endDate: new Date(2026, 7, 15) }], now).map((p) => p.cycle)).toEqual([0, 1]);
    expect(planRecurringPayments([{ ...base, cycle: 0 }], now, 2)).toHaveLength(2);
  });

  it("plans auto-record incomes that are due and not yet recorded", async () => {
    const { planRecurringIncomes } = await import("@/lib/finance/automation");
    const t = { id: "sal", name: "Salary", source: "salary" as const, amount: 9000000, dayOfMonth: 1, startMonth: "2026-01", active: true, accountId: null, autoRecord: true, createdAt: new Date() };
    const recorded = [{ recurringId: "sal", forMonth: "2026-09" }] as never[];
    const plan = planRecurringIncomes([t], recorded, new Date(2026, 9, 7));
    expect(plan.map((p) => p.month)).toEqual(["2026-08", "2026-10"]);
    expect(planRecurringIncomes([{ ...t, autoRecord: false }], [], new Date(2026, 9, 7))).toEqual([]);
  });
});

describe("reminders", () => {
  it("builds EMI, card, recurring and budget reminders within the lead time, de-duplicated per day", async () => {
    const { buildReminders, dueForNotification, DEFAULT_REMINDER_PREFS } = await import("@/lib/finance/reminders");
    const { budgetProgress } = await import("@/lib/finance/budget");
    const now = new Date(2026, 9, 7, 9);
    const fmt = (m: number) => `₹${m / 100}`;
    const upcoming = [
      { kind: "emi", id: "e", date: new Date(2026, 9, 8), amount: 100000, overdue: false, emi: { id: "car", name: "Car", paidCount: 4, tenureMonths: 60 } },
      { kind: "card", id: "c", date: new Date(2026, 9, 5), amount: 500000, overdue: true, card: { id: "amex", name: "Amex" }, minimumDue: 25000 },
      { kind: "recurring", id: "r", date: new Date(2026, 9, 20), amount: 64900, overdue: false, cycle: 2, payment: { id: "nf", name: "Netflix", cycle: 2, autoPay: false } },
      { kind: "income", id: "i", date: new Date(2026, 9, 7), amount: 1, overdue: false },
    ] as never[];
    const reminders = buildReminders({
      upcoming,
      budget: { month: "2026-10", overall: budgetProgress(1000000, 850000), categories: [{ name: "Food", progress: budgetProgress(100000, 120000) }] },
      prefs: DEFAULT_REMINDER_PREFS,
      now,
      format: fmt,
    });
    expect(reminders.map((r) => r.id)).toEqual(["card:amex:2026-10-05", "budget:2026-10:Food:over", "emi:car:5", "budget:2026-10:overall:warning"]);
    expect(reminders[0].title).toBe("Amex bill overdue since 5 Oct");
    expect(reminders[2].title).toBe("Car EMI due tomorrow");
    // Netflix is 13 days away (> 3-day lead) and income isn't a reminder kind.
    const off = buildReminders({ upcoming, budget: null, prefs: { ...DEFAULT_REMINDER_PREFS, enabled: { emi: false, card: true, recurring: true, budget: true } }, now, format: fmt });
    expect(off.map((r) => r.kind)).toEqual(["card"]);
    // Notify once per reminder per day.
    expect(dueForNotification(reminders, { "emi:car:5": "2026-10-07" }, now).map((r) => r.id)).not.toContain("emi:car:5");
    expect(dueForNotification(reminders, { "emi:car:5": "2026-10-06" }, now).map((r) => r.id)).toContain("emi:car:5");
  });
});
