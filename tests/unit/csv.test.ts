import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv, safeCell, toCsv } from "@/lib/csv/csv";
import { exporters, major } from "@/lib/csv/export";
import { autoMapColumns, dateSpan, fingerprint, parseImportRows, summarizeRows, type ImportOptions } from "@/lib/csv/import";
import { detectDateFormat, parseAmountValue, parseDateValue, parsePaymentMethod } from "@/lib/csv/values";
import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";
import type { Category, Expense } from "@/types";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and BOM", () => {
    const text = '﻿Date,Note,Amount\r\n2026-10-01,"Dinner, with ""Meera""",450\r\n2026-10-02,"two\nlines",10\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Note", "Amount"],
      ["2026-10-01", 'Dinner, with "Meera"', "450"],
      ["2026-10-02", "two\nlines", "10"],
    ]);
  });

  it("detects ; and tab delimiters", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["Name", "Note"], ["A", 'He said "hi", then\nleft'], ["B", " padded "]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(safeCell("=HYPERLINK(evil)")).toBe("'=HYPERLINK(evil)");
    expect(safeCell("+cmd")).toBe("'+cmd");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("-12.50")).toBe("-12.50");
    expect(safeCell("-trick")).toBe("'-trick");
    expect(safeCell(-5)).toBe("-5");
  });
});

describe("value parsing", () => {
  it("parses amounts in common bank/app formats", () => {
    expect(parseAmountValue("₹1,234.50")).toEqual({ minor: 123450, negative: false });
    expect(parseAmountValue("INR 99")).toEqual({ minor: 9900, negative: false });
    expect(parseAmountValue("(250.00)")).toEqual({ minor: 25000, negative: true });
    expect(parseAmountValue("-75.5")).toEqual({ minor: 7550, negative: true });
    expect(parseAmountValue("1200 Dr")).toEqual({ minor: 120000, negative: true });
    expect(parseAmountValue("abc")).toBeNull();
    expect(parseAmountValue("1.234")).toBeNull();
  });

  it("detects date order and parses with or without time", () => {
    expect(detectDateFormat(["2026-10-07"])).toBe("ymd");
    expect(detectDateFormat(["07/10/2026", "25/09/2026"])).toBe("dmy");
    expect(detectDateFormat(["10/07/2026", "09/25/2026"])).toBe("mdy");
    expect(parseDateValue("07/10/2026", "dmy")).toEqual(new Date(2026, 9, 7, 12));
    expect(parseDateValue("10/7/26 2:30 PM", "mdy")).toEqual(new Date(2026, 9, 7, 14, 30));
    expect(parseDateValue("2026-10-07T09:15:00", "dmy")).toEqual(new Date(2026, 9, 7, 9, 15));
    expect(parseDateValue("7 Oct 2026", "dmy")).toEqual(new Date(2026, 9, 7, 12));
    expect(parseDateValue("31/02/2026", "dmy")).toBeNull();
  });

  it("maps payment-method synonyms", () => {
    expect(parsePaymentMethod("Google Pay")).toBe("upi");
    expect(parsePaymentMethod("HDFC Credit Card")).toBe("credit");
    expect(parsePaymentMethod("Cash")).toBe("cash");
    expect(parsePaymentMethod("barter")).toBeNull();
  });
});

describe("import validation", () => {
  const categories: Category[] = [...DEFAULT_CATEGORIES, { id: "c1", name: "Coffee", icon: "coffee", color: "amber", isDefault: false, archived: false }];
  const options: ImportOptions = {
    type: "expenses",
    dateFormat: "dmy",
    defaultPaymentMethod: "upi",
    fallbackCategoryId: "other",
    createMissingCategories: false,
    skipNegative: true,
  };

  it("auto-maps common headers", () => {
    expect(autoMapColumns(["Txn Date", "Narration", "Withdrawal Amount", "Category", "Mode"], "expenses")).toEqual({
      date: 0,
      note: 1,
      amount: 2,
      category: 3,
      paymentMethod: 4,
    });
  });

  it("classifies valid, invalid and duplicate rows with reasons", () => {
    const existing = new Set([fingerprint(new Date(2026, 9, 1), 45000, "Dinner")]);
    const rows = [
      ["01/10/2026", "Dinner", "450", "Food", "UPI"], // duplicate of existing
      ["02/10/2026", "Latte", "₹220", "coffee", "Credit card"],
      ["02/10/2026", "Latte", "220", "Coffee", "credit"], // repeated in file
      ["31/02/2026", "Bad date", "10", "", ""],
      ["03/10/2026", "Refund", "-500", "", ""],
      ["03/10/2026", "Mystery", "99", "Gadgets", "barter"],
      ["", "", "", "", ""],
    ];
    const parsed = parseImportRows(rows, { date: 0, note: 1, amount: 2, category: 3, paymentMethod: 4 }, options, { categories, existingFingerprints: existing });
    expect(parsed.map((r) => r.status)).toEqual(["duplicate", "valid", "duplicate", "invalid", "invalid", "valid", "invalid"]);
    expect(parsed[1]).toMatchObject({ amount: 22000, categoryId: "c1", paymentMethod: "credit", line: 3 });
    expect(parsed[3].errors[0]).toContain("Unrecognised date");
    expect(parsed[4].errors[0]).toContain("Negative amount");
    expect(parsed[5]).toMatchObject({ categoryId: "other", paymentMethod: "upi" });
    expect(parsed[5].warnings).toHaveLength(2);
    expect(summarizeRows(parsed)).toEqual({ total: 7, valid: 2, duplicates: 2, invalid: 3 });
    expect(dateSpan(parsed.filter((r) => r.status !== "invalid"))).toEqual({ from: new Date(2026, 9, 1, 12), to: new Date(2026, 9, 3, 12) });
  });

  it("can create unknown categories instead of falling back", () => {
    const [row] = parseImportRows([["01/10/2026", "x", "1", "Gadgets", ""]], { date: 0, note: 1, amount: 2, category: 3 }, { ...options, createMissingCategories: true }, { categories, existingFingerprints: new Set() });
    expect(row).toMatchObject({ categoryId: null, newCategoryName: "Gadgets", status: "valid" });
  });

  it("parses income sources", () => {
    const parsed = parseImportRows(
      [["2026-10-01", "85000", "Monthly salary"], ["2026-10-05", "5000", "Logo freelance"]],
      { date: 0, amount: 1, source: 2 },
      { ...options, type: "incomes", dateFormat: "ymd" },
      { categories, existingFingerprints: new Set() },
    );
    expect(parsed.map((r) => r.source)).toEqual(["salary", "freelance"]);
  });
});

describe("export", () => {
  it("formats amounts as plain decimals", () => {
    expect([major(123450), major(5), major(-1205), major(null)]).toEqual(["1234.50", "0.05", "-12.05", ""]);
  });

  it("exports expenses with readable columns that re-import cleanly", () => {
    const e = { amount: 45050, categoryId: "food", paymentMethod: "upi", note: "=cmd", occurredAt: new Date(2026, 9, 1, 20, 5), accountId: null, type: "EXPENSE" } as Expense;
    const csv = toCsv(exporters.expenses([e], { category: (id) => DEFAULT_CATEGORIES.find((c) => c.id === id)!, accountName: () => null }));
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(["Date", "Amount", "Category", "Note", "Payment method", "Account", "Type"]);
    expect(rows[1]).toEqual(["2026-10-01 20:05", "450.50", "Food", "'=cmd", "UPI", "", "EXPENSE"]);
    // Round trip through the importer.
    const mapping = autoMapColumns(rows[0], "expenses");
    const [parsed] = parseImportRows(rows.slice(1), mapping, {
      type: "expenses", dateFormat: "ymd", defaultPaymentMethod: "cash", fallbackCategoryId: "other", createMissingCategories: false, skipNegative: true,
    }, { categories: [...DEFAULT_CATEGORIES], existingFingerprints: new Set() });
    expect(parsed).toMatchObject({ status: "valid", amount: 45050, categoryId: "food", paymentMethod: "upi", date: new Date(2026, 9, 1, 20, 5) });
  });
});
