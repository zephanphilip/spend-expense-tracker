import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { format, subMonths } from "date-fns";

import { addExpense, signUp } from "./helpers";

const at = (d: Date, h = 12) => {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return format(x, "yyyy-MM-dd'T'HH:mm");
};

test("analytics: totals, comparison, filters, table view and insights", async ({ page }) => {
  await signUp(page);
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  await addExpense(page, { amount: "1200", category: "Food", method: "UPI", when: at(now) });
  await addExpense(page, { amount: "800", category: "Transport", method: "Cash", when: at(now) });
  await addExpense(page, { amount: "500", category: "Food", method: "UPI", when: at(new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)) });

  await page.goto("/analytics");
  const kpis = page.locator("dl").first();
  await expect(kpis).toContainText("Total spending");
  await expect(kpis).toContainText("₹2,000");

  // Last month (whole month → served from monthly aggregates, built on first visit).
  await page.getByRole("button", { name: "Last month", exact: true }).click();
  await expect(kpis).toContainText("₹500");
  await expect(page.getByText("Computed from monthly summaries.")).toBeVisible();

  // Back to this month; filter to Food only (raw rows for the period).
  await page.getByRole("button", { name: "This month", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: false }).click();
  const sheet = page.getByRole("dialog", { name: "Analytics filters" });
  await sheet.getByRole("button", { name: "Food" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(kpis).toContainText("Filtered spending");
  await expect(kpis).toContainText("₹1,200");
  await expect(page.getByText("Computed from individual expenses in this period.")).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(kpis).toContainText("₹2,000");

  // Spending tab: category breakdown + table view.
  await page.getByRole("tab", { name: "Spending" }).click();
  const breakdown = page.getByRole("region", { name: "Category breakdown" });
  await expect(breakdown).toContainText("Food");
  await breakdown.getByRole("button", { name: "View as table" }).click();
  await expect(breakdown.getByRole("table")).toContainText("₹1,200");
  await expect(page.getByRole("region", { name: "Payment methods" })).toContainText("Cash");

  // Keyboard tab navigation + insights tab.
  await page.getByRole("tab", { name: "Spending" }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Cash flow" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Income vs expenses" })).toBeVisible();
  await page.getByRole("tab", { name: /Insights/ }).click();
  await expect(page.getByRole("region", { name: "All insights" })).toContainText("Food is your biggest category");
});

test("CSV import: validation, duplicates, preview, summary and undo; export", async ({ page }) => {
  await signUp(page);
  await addExpense(page, { amount: "450", category: "Food", note: "Dinner", when: "2026-09-12T20:00" });

  await page.goto("/data");
  const csv = [
    "Txn Date,Narration,Withdrawal Amount,Category,Mode",
    "12/09/2026,Dinner,450,Food,UPI", // duplicate of existing
    "13/09/2026,Groceries run,\"1,250.00\",Groceries,Debit Card",
    "13/09/2026,Groceries run,1250,Groceries,debit", // repeated in file
    "31/02/2026,Bad date,99,Food,UPI", // invalid
    "14/09/2026,Refund,-300,Shopping,UPI", // negative → skipped
    "15/09/2026,Metro card,500,Transport,Paytm",
  ].join("\n");
  await page.locator("#import-file").setInputFiles({ name: "bank-sept.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  // Mapping step: columns auto-detected, date format detected as D/M/Y.
  await expect(page.getByLabel("Date *")).toHaveValue("0");
  await expect(page.getByLabel("Amount *")).toHaveValue("2");
  await expect(page.getByLabel("Date format")).toHaveValue("dmy");
  await page.getByRole("button", { name: "Review rows" }).click();

  const counts = page.getByRole("radiogroup", { name: "Show rows" });
  await expect(counts).toContainText("6All");
  await expect(counts).toContainText("2Ready");
  await expect(counts).toContainText("2Duplicates");
  await expect(counts).toContainText("2Invalid");
  await expect(page.getByText("Already in your records")).toBeVisible();
  await expect(page.getByText("Repeated earlier in this file")).toBeVisible();
  await expect(page.getByText(/Unrecognised date/)).toBeVisible();

  await page.getByRole("button", { name: "Import 2 rows" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  const summary = page.getByRole("status").filter({ hasText: "Import complete" });
  await expect(summary).toContainText("2Imported");
  await expect(summary).toContainText("4Skipped");
  await expect(summary).toContainText("2Duplicate");
  await expect(summary).toContainText("2Invalid");

  // Imported rows exist (not overwriting the original).
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "All time" }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("3 expenses")).toBeVisible();
  await expect(page.getByRole("button", { name: /Groceries run/ })).toBeVisible();

  // Export expenses and check the file.
  await page.goto("/data");
  const download = page.waitForEvent("download");
  await page.getByRole("region", { name: "Export" }).getByRole("button", { name: "Expenses" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ledger-expenses-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = readFileSync((await file.path())!, "utf8");
  expect(content).toContain("Date,Amount,Category,Note,Payment method,Account,Type");
  expect(content).toContain("2026-09-13 12:00,1250.00,Groceries,Groceries run,Debit,,EXPENSE");

  // Undo the import from Recent imports.
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Undo import" }).click();
  await expect(page.getByText(/Import undone · 2 entries removed/)).toBeVisible();
  await expect(page.getByText(/undone/).first()).toBeVisible();
});
