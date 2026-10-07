import { describe, expect, it } from "vitest";

import { fromDateTimeLocalValue, getPeriodRange, toDateTimeLocalValue } from "@/lib/dates";
import { expenseFormSchema, toExpenseInput } from "@/lib/validation/expense";
import { categorySchema } from "@/lib/validation/category";
import { safeNextPath } from "@/components/auth/guest-guard";

const NOW = new Date(2026, 9, 6, 15, 30);

describe("getPeriodRange", () => {
  it("this month spans the calendar month", () => {
    const { from, to } = getPeriodRange("this-month", {}, NOW);
    expect(from).toEqual(new Date(2026, 9, 1));
    expect(to?.getDate()).toBe(31);
  });
  it("last month handles year boundaries", () => {
    const { from, to } = getPeriodRange("last-month", {}, new Date(2026, 0, 15));
    expect(from).toEqual(new Date(2025, 11, 1));
    expect(to?.getMonth()).toBe(11);
  });
  it("last 30 days is inclusive of today", () => {
    const { from } = getPeriodRange("last-30", {}, NOW);
    expect(from).toEqual(new Date(2026, 8, 7));
  });
  it("all time is unbounded", () => {
    expect(getPeriodRange("all", {}, NOW)).toEqual({});
  });
});

describe("datetime-local round trip", () => {
  it("preserves minutes", () => {
    const value = toDateTimeLocalValue(NOW);
    expect(value).toBe("2026-10-06T15:30");
    expect(fromDateTimeLocalValue(value)).toEqual(NOW);
  });
  it("rejects garbage", () => {
    expect(fromDateTimeLocalValue("nope")).toBeNull();
  });
});

describe("expenseFormSchema", () => {
  const valid = {
    amount: "249.99",
    categoryId: "food",
    paymentMethod: "upi",
    note: "  Dinner  ",
    occurredAt: "2026-10-06T20:15",
    accountId: "",
  };

  it("accepts a valid form and converts to domain input", () => {
    const parsed = expenseFormSchema.parse(valid);
    expect(toExpenseInput(parsed)).toEqual({
      amount: 24999,
      categoryId: "food",
      paymentMethod: "upi",
      note: "Dinner",
      occurredAt: new Date(2026, 9, 6, 20, 15),
      accountId: null,
    });
  });

  it.each([
    [{ amount: "" }, "amount"],
    [{ amount: "0" }, "amount"],
    [{ categoryId: "" }, "categoryId"],
    [{ paymentMethod: "bitcoin" }, "paymentMethod"],
    [{ note: "x".repeat(281) }, "note"],
    [{ occurredAt: "" }, "occurredAt"],
  ])("rejects %o", (patch, field) => {
    const result = expenseFormSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(field);
  });
});

describe("categorySchema", () => {
  it("trims and bounds the name", () => {
    expect(categorySchema.parse({ name: "  Coffee ", icon: "coffee", color: "amber" }).name).toBe("Coffee");
    expect(categorySchema.safeParse({ name: " ", icon: "coffee", color: "amber" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "Ok", icon: "rocket", color: "amber" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/expenses", "/expenses"],
    [null, "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
