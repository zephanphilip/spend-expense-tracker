import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";
import { nextUsage, rankByUsage, rankPaymentMethods, recentIds, type ExpenseUsage } from "@/lib/expense-preferences";
import { categoryBudgetStatus, sumCategorySpend } from "@/lib/finance/budget";
import { draftFromSearchParams, hasLinkParams, quickAddUrl } from "@/lib/quick-add/deep-link";
import { getQuickExpenseLauncher } from "@/lib/quick-add/launcher";
import {
  EMPTY_DRAFT,
  initialQuickAddState,
  type QuickAddConfig,
  type QuickAddEvent,
  quickAddReducer,
  type QuickAddState,
  type SavedExpense,
} from "@/lib/quick-add/machine";

const config: QuickAddConfig = { digits: 2, askNote: true, oneTapSave: false };

function run(cfg: QuickAddConfig, events: QuickAddEvent[], start = initialQuickAddState(cfg)): QuickAddState {
  const reduce = quickAddReducer(cfg);
  return events.reduce(reduce, start);
}

const saved = (over: Partial<SavedExpense> = {}): SavedExpense => ({
  id: "e1",
  amount: 50000,
  categoryId: "food",
  paymentMethod: "upi",
  note: "",
  occurredAt: new Date(2026, 9, 7),
  pending: false,
  ...over,
});

describe("quick add state machine", () => {
  it("walks AMOUNT → CATEGORY → NOTE → PAYMENT → CONFIRM", () => {
    const s = run(config, [
      { type: "SET_AMOUNT", value: "500" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SET_NOTE", value: "  Lunch  " },
      { type: "SUBMIT_NOTE" },
      { type: "PICK_METHOD", method: "upi", submissionId: "s1" },
    ]);
    expect(s.step).toBe("CONFIRM");
    expect(s.draft).toEqual({ amount: "500", categoryId: "food", note: "Lunch", paymentMethod: "upi" });
  });

  it("refuses empty, zero and over-limit amounts", () => {
    expect(run(config, [{ type: "SUBMIT_AMOUNT" }])).toMatchObject({ step: "AMOUNT", error: "Enter an amount" });
    expect(run(config, [{ type: "SET_AMOUNT", value: "0" }, { type: "SUBMIT_AMOUNT" }])).toMatchObject({
      step: "AMOUNT",
      error: "Enter an amount greater than zero",
    });
    expect(run(config, [{ type: "SET_AMOUNT", value: "99999999999" }, { type: "SUBMIT_AMOUNT" }]).step).toBe("AMOUNT");
    expect(run(config, [{ type: "SET_AMOUNT", value: "0.5" }, { type: "SUBMIT_AMOUNT" }]).step).toBe("CATEGORY");
  });

  it("skipping the note clears it; askNote=false removes the step", () => {
    const s = run(config, [
      { type: "SET_AMOUNT", value: "5" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SET_NOTE", value: "typo" },
      { type: "SKIP_NOTE" },
    ]);
    expect(s).toMatchObject({ step: "PAYMENT", draft: { note: "" } });
    const noNote = { ...config, askNote: false };
    expect(run(noNote, [{ type: "SET_AMOUNT", value: "5" }, { type: "SUBMIT_AMOUNT" }, { type: "PICK_CATEGORY", categoryId: "food" }]).step).toBe(
      "PAYMENT",
    );
  });

  it("BACK goes to the previous visible step and keeps entered data", () => {
    const s = run(config, [
      { type: "SET_AMOUNT", value: "5" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "BACK" },
      { type: "BACK" },
    ]);
    expect(s).toMatchObject({ step: "AMOUNT", direction: -1, draft: { amount: "5", categoryId: "food" } });
    expect(run(config, [{ type: "BACK" }]).step).toBe("AMOUNT");
  });

  it("editing from CONFIRM returns to CONFIRM", () => {
    const atConfirm = run(config, [
      { type: "SET_AMOUNT", value: "5" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SKIP_NOTE" },
      { type: "PICK_METHOD", method: "upi", submissionId: "x" },
    ]);
    const edited = run(config, [{ type: "EDIT", step: "CATEGORY" }, { type: "PICK_CATEGORY", categoryId: "fuel" }], atConfirm);
    expect(edited).toMatchObject({ step: "CONFIRM", draft: { categoryId: "fuel" }, returnToConfirm: false });
    const amountEdit = run(config, [{ type: "EDIT", step: "AMOUNT" }, { type: "SET_AMOUNT", value: "7" }, { type: "SUBMIT_AMOUNT" }], atConfirm);
    expect(amountEdit).toMatchObject({ step: "CONFIRM", draft: { amount: "7" } });
    // One-tap save doesn't fire when the user is only changing the method from CONFIRM.
    const oneTap = { ...config, oneTapSave: true };
    const methodEdit = run(oneTap, [{ type: "EDIT", step: "PAYMENT" }, { type: "PICK_METHOD", method: "cash", submissionId: "y" }], atConfirm);
    expect(methodEdit.step).toBe("CONFIRM");
  });

  it("guards against duplicate submissions while saving", () => {
    const confirming = run(config, [
      { type: "SET_AMOUNT", value: "500" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SKIP_NOTE" },
      { type: "PICK_METHOD", method: "upi", submissionId: "unused" },
    ]);
    const saving = run(config, [{ type: "SAVE", submissionId: "s1" }], confirming);
    expect(saving).toMatchObject({ step: "SAVING", submissionId: "s1" });
    // A second tap, a stray edit or another submission's result are all ignored.
    expect(run(config, [{ type: "SAVE", submissionId: "s2" }], saving)).toBe(saving);
    expect(run(config, [{ type: "SET_AMOUNT", value: "9" }], saving)).toBe(saving);
    expect(run(config, [{ type: "SAVE_SUCCEEDED", submissionId: "s2", saved: saved() }], saving)).toBe(saving);
    const done = run(config, [{ type: "SAVE_SUCCEEDED", submissionId: "s1", saved: saved() }], saving);
    expect(done.step).toBe("SAVED");
    const budget = categoryBudgetStatus("food", "2026-10", { month: "2026-10", categories: { food: 800000 } }, 600000);
    const result = run(config, [{ type: "BUDGET_LOADED", expenseId: "e1", outcome: { status: "ready", budget, fromCache: false } }], done);
    expect(result.step).toBe("BUDGET_RESULT");
    expect(run(config, [{ type: "RESET" }], result)).toEqual(initialQuickAddState(config));
  });

  it("a failed save returns to CONFIRM with the error and can be retried", () => {
    const saving = run(config, [
      { type: "SET_AMOUNT", value: "5" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SKIP_NOTE" },
      { type: "PICK_METHOD", method: "upi", submissionId: "x" },
      { type: "SAVE", submissionId: "s1" },
      { type: "SAVE_FAILED", submissionId: "s1", error: "Permission denied" },
    ]);
    expect(saving).toMatchObject({ step: "CONFIRM", error: "Permission denied", submissionId: null });
    expect(run(config, [{ type: "SAVE", submissionId: "s2" }], saving).step).toBe("SAVING");
  });

  it("one-tap save goes straight from PAYMENT to SAVING", () => {
    const oneTap = { ...config, oneTapSave: true };
    const s = run(oneTap, [
      { type: "SET_AMOUNT", value: "5" },
      { type: "SUBMIT_AMOUNT" },
      { type: "PICK_CATEGORY", categoryId: "food" },
      { type: "SKIP_NOTE" },
      { type: "PICK_METHOD", method: "cash", submissionId: "s1" },
    ]);
    expect(s).toMatchObject({ step: "SAVING", submissionId: "s1" });
  });

  it("a pre-filled draft starts at the first missing step, never past CONFIRM", () => {
    expect(initialQuickAddState(config, { ...EMPTY_DRAFT, amount: "500" }).step).toBe("CATEGORY");
    expect(initialQuickAddState(config, { ...EMPTY_DRAFT, amount: "500", categoryId: "food" }).step).toBe("NOTE");
    expect(initialQuickAddState(config, { ...EMPTY_DRAFT, amount: "500", categoryId: "food", note: "x" }).step).toBe("PAYMENT");
    expect(initialQuickAddState({ ...config, oneTapSave: true }, { amount: "5", categoryId: "food", note: "", paymentMethod: "upi" }).step).toBe(
      "CONFIRM",
    );
  });
});

describe("quick add deep links", () => {
  const opts = { categories: DEFAULT_CATEGORIES, digits: 2 };
  const parse = (q: string) => draftFromSearchParams(new URLSearchParams(q), opts);

  it("accepts ids, names and labels case-insensitively", () => {
    expect(parse("amount=500&category=Food&method=Credit&note=Lunch")).toEqual({
      amount: "500",
      categoryId: "food",
      paymentMethod: "credit",
      note: "Lunch",
    });
    expect(parse("category=entertainment&method=UPI")).toMatchObject({ categoryId: "entertainment", paymentMethod: "upi" });
    expect(parse("category=fun").categoryId).toBe("entertainment");
  });

  it("drops invalid values instead of guessing", () => {
    expect(parse("amount=abc&category=nope&method=paypal")).toEqual(EMPTY_DRAFT);
    expect(parse("amount=-250").amount).toBe("250");
    expect(parse("amount=1,250.50").amount).toBe("1250.50");
    expect(parse("amount=12,5").amount).toBe("12.5");
    expect(parse("amount=10.999").amount).toBe("10.99");
  });

  it("builds and recognises links", () => {
    expect(quickAddUrl()).toBe("/quick-add");
    expect(quickAddUrl({ amount: "500", category: "food" }, "https://spend-9273d.web.app")).toBe(
      "https://spend-9273d.web.app/quick-add?amount=500&category=food",
    );
    expect(hasLinkParams(new URLSearchParams("amount=1"))).toBe(true);
    expect(hasLinkParams(new URLSearchParams("utm=1"))).toBe(false);
  });
});

describe("category budget status", () => {
  it("computes remaining = limit − spent including the new expense", () => {
    // Budget ₹8,000, spent ₹5,500 before, new ₹500 expense → ₹2,000 left.
    const before = [
      { id: "a", amount: 300000, categoryId: "food" },
      { id: "b", amount: 250000, categoryId: "food" },
      { id: "x", amount: 999900, categoryId: "fuel" },
    ];
    const created = { id: "new", amount: 50000, categoryId: "food" };
    const spent = sumCategorySpend(before, "food", created);
    expect(spent).toBe(600000);
    // Already in the read → not counted twice.
    expect(sumCategorySpend([...before, created], "food", created)).toBe(600000);
    const status = categoryBudgetStatus("food", "2026-10", { month: "2026-10", categories: { food: 800000 } }, spent);
    expect(status.progress).toMatchObject({ limit: 800000, spent: 600000, remaining: 200000, percent: 75, state: "ok" });
  });

  it("handles no budget, zero budget and over budget", () => {
    expect(categoryBudgetStatus("food", "2026-10", null, 100).progress).toBeNull();
    expect(categoryBudgetStatus("food", "2026-10", { month: "2026-09", categories: { fuel: 5 } }, 100)).toMatchObject({
      progress: null,
      budgetMonth: "2026-09",
    });
    expect(categoryBudgetStatus("food", "2026-10", { month: "2026-10", categories: { food: 0 } }, 100).progress).toMatchObject({
      remaining: -100,
      state: "over",
    });
    expect(categoryBudgetStatus("food", "2026-10", { month: "2026-10", categories: { food: 1000 } }, 1450).progress).toMatchObject({
      remaining: -450,
      state: "over",
      percent: 145,
    });
  });
});

describe("expense usage ranking", () => {
  const day = 86_400_000;
  const now = 100 * day;

  it("ranks frequent and recent categories first, keeping default order otherwise", () => {
    let usage: ExpenseUsage = { categories: {}, methods: {} };
    for (let i = 0; i < 5; i++) usage = nextUsage(usage, { categoryId: "fuel", paymentMethod: "cash" }, now - 60 * day);
    usage = nextUsage(usage, { categoryId: "health", paymentMethod: "credit" }, now - 2 * day);
    usage = nextUsage(usage, { categoryId: "health", paymentMethod: "credit" }, now - 2 * day);
    const ids = rankByUsage(DEFAULT_CATEGORIES, (c) => c.id, usage.categories, now).map((c) => c.id);
    expect(ids.slice(0, 3)).toEqual(["health", "fuel", "food"]);
    expect(recentIds(usage.categories, 1)).toEqual(["health"]);
  });

  it("ranks payment methods by usage", () => {
    let usage: ExpenseUsage = { categories: {}, methods: {} };
    usage = nextUsage(usage, { categoryId: "food", paymentMethod: "cash" }, now);
    expect(rankPaymentMethods(usage, now)[0]).toBe("cash");
    // No history (and no storage in tests) → the default method leads.
    expect(rankPaymentMethods({ categories: {}, methods: {} }, now)[0]).toBe("upi");
  });
});

describe("quick expense launcher", () => {
  it("defaults to the PWA implementation without a native bridge", () => {
    const launcher = getQuickExpenseLauncher();
    expect(launcher.platform).toBe("pwa");
    expect(launcher.supportsLiveActivities).toBe(false);
    expect(launcher.finish()).toBe(false);
  });
});
