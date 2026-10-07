import { expect, type Page, test } from "@playwright/test";
import { format } from "date-fns";

import { addExpense, signUp } from "./helpers";

async function goPlan(page: Page, section: RegExp) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Plan" }).click();
  await page.getByRole("navigation", { name: "Plan" }).getByRole("link", { name: section }).click();
}

test("budgets: set overall + category limits, see progress and over-budget state", async ({ page }) => {
  await signUp(page);
  await addExpense(page, { amount: "1200", category: "Food" });
  await addExpense(page, { amount: "300", category: "Transport" });

  await goPlan(page, /^Budgets/);
  await expect(page.getByText("No budget yet")).toBeVisible();
  await page.getByRole("button", { name: "Set budget" }).click();
  const sheet = page.getByRole("dialog", { name: /Budget for/ });
  await sheet.getByLabel("Overall monthly budget").fill("5000");
  await sheet.getByLabel("Food").fill("1000");
  await sheet.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText(/Budget saved/)).toBeVisible();

  const overall = page.getByRole("region", { name: "Overall" });
  await expect(overall).toContainText("₹3,500"); // left to spend
  await expect(overall).toContainText("30% used");
  const categories = page.getByRole("region", { name: "Categories" });
  await expect(categories).toContainText("₹200 over"); // Food 1200 / 1000
  await expect(page.getByRole("region", { name: "History" })).toBeVisible();

  // Dashboard shows budget progress in the hero and the category snapshot.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹3,500 left of ₹5,000");
  await expect(page.getByRole("region", { name: "Budgets" })).toContainText("Food");
});

test("income: one-time, recurring salary marked received, salary tracker", async ({ page }) => {
  await signUp(page);
  const today = format(new Date(), "yyyy-MM-dd");

  // One-time freelance income from the dashboard.
  await page.getByRole("button", { name: "Income", exact: true }).click();
  let sheet = page.getByRole("dialog", { name: "Add income" });
  await sheet.getByLabel("Amount").fill("15000");
  await sheet.getByText("Freelance", { exact: true }).click();
  await sheet.getByLabel("Note").fill("Logo design");
  await sheet.getByRole("button", { name: "Save income" }).click();
  await expect(page.getByText("₹15,000 freelance added")).toBeVisible();
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹15,000");

  // Recurring salary template, then mark this month's as received.
  await goPlan(page, /^Income & salary/);
  await page.getByRole("radio", { name: "Recurring" }).check({ force: true });
  await page.getByRole("button", { name: "Add recurring income" }).click();
  sheet = page.getByRole("dialog", { name: "New recurring income" });
  await sheet.getByLabel("Usual amount", { exact: true }).fill("85000");
  await sheet.getByLabel("Day of month").fill("1");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Recurring income added")).toBeVisible();
  await expect(page.getByText("Monthly on day 1")).toBeVisible();

  await page.getByRole("radio", { name: "Overview" }).check({ force: true });
  const expected = page.getByRole("region", { name: "Expected this month" });
  await expect(expected).toContainText("Salary");
  await expected.getByRole("button", { name: "Received" }).click();
  const record = page.getByRole("dialog", { name: /Salary received/ });
  await record.getByLabel("Amount").fill("87500");
  await record.getByLabel("Received on").fill(today);
  await record.getByRole("button", { name: "Mark as received" }).click();
  await expect(page.getByText("₹87,500 Salary recorded")).toBeVisible();
  await expect(page.getByRole("region", { name: "Expected this month" })).toBeHidden();
  await expect(page.getByRole("region", { name: /income$/ })).toContainText("₹1,02,500");

  // Salary tab shows stats and history.
  await page.getByRole("radio", { name: "Salary" }).check({ force: true });
  await expect(page.getByText("Latest")).toBeVisible();
  await expect(page.getByRole("region", { name: "Salary history" })).toContainText("₹87,500");
});

test("EMI: add loan, pay installment (logged as expense), undo", async ({ page }) => {
  await signUp(page);
  await goPlan(page, /^EMIs/);
  await page.getByRole("button", { name: "Add loan" }).first().click();
  const sheet = page.getByRole("dialog", { name: /Add a loan/ });
  await sheet.getByLabel("Name").fill("Car loan");
  await sheet.getByLabel("Loan amount").fill("500000");
  await sheet.getByLabel("Interest").fill("9");
  await sheet.getByLabel("Tenure").fill("60");
  await sheet.getByLabel("First EMI date").fill(format(new Date(), "yyyy-MM-dd"));
  await expect(sheet).toContainText("₹10,379.18"); // computed EMI preview
  await sheet.getByRole("button", { name: "Add loan" }).click();
  await expect(page.getByText("Car loan added")).toBeVisible();

  await expect(page.getByText("0 of 60 paid")).toBeVisible();
  await page.getByRole("button", { name: "Pay EMI" }).click();
  const pay = page.getByRole("dialog", { name: "Pay Car loan" });
  await expect(pay).toContainText("Interest ₹3,750");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/₹10,379.18 paid · Car loan/)).toBeVisible();
  await expect(page.getByText("1 of 60 paid")).toBeVisible();

  // Detail page: outstanding reduced by the principal part, history shows #1.
  await page.getByRole("link", { name: /Car loan/ }).click();
  await expect(page.getByRole("region", { name: "Loan balance" })).toContainText("₹4,93,370.82");
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("#1");

  // It was also logged as an expense.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Car loan · EMI 1/60")).toBeVisible();

  // Undo from the detail page restores the balance and removes the expense.
  await page.goBack();
  await page.getByRole("button", { name: "Undo last" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Undo payment" }).click();
  await expect(page.getByText("Payment undone")).toBeVisible();
  await expect(page.getByRole("region", { name: "Loan balance" })).toContainText("₹5,00,000");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Car loan · EMI 1/60")).toBeHidden();
});

test("wishlist: create with opening balance, add, withdraw, history", async ({ page }) => {
  await signUp(page);
  await goPlan(page, /^Wishlist/);
  await page.getByRole("button", { name: "New wish" }).click();
  const sheet = page.getByRole("dialog", { name: "New wish" });
  await sheet.getByLabel("What do you want?").fill("New phone");
  await sheet.getByLabel("Target amount").fill("80000");
  await sheet.getByLabel("Already saved").fill("20000");
  await sheet.getByRole("button", { name: "Add wish" }).click();
  await expect(page.getByText("“New phone” added to your wishlist")).toBeVisible();
  await expect(page.getByText("25%")).toBeVisible();

  await page.getByRole("button", { name: "Add money" }).click();
  let contribution = page.getByRole("dialog", { name: "New phone" });
  await contribution.getByLabel("Amount").fill("10000");
  await contribution.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("₹10,000 saved towards New phone")).toBeVisible();

  await page.getByRole("link", { name: /New phone/ }).click();
  await expect(page.getByRole("region", { name: "Savings progress" })).toContainText("₹30,000");
  await page.getByRole("button", { name: "Withdraw" }).click();
  contribution = page.getByRole("dialog", { name: "New phone" });
  await contribution.getByLabel("Amount").fill("50000");
  await contribution.getByRole("button", { name: "Save" }).click();
  await expect(contribution.getByText(/You've saved ₹30,000 so far/)).toBeVisible();
  await contribution.getByLabel("Amount").fill("5000");
  await contribution.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Savings progress" })).toContainText("₹25,000");
  const history = page.getByRole("region", { name: "Contribution history" });
  await expect(history).toContainText("Opening balance");
  await expect(history).toContainText("−₹5,000");
});

test("monthly summary: income, expenses, savings rate", async ({ page }) => {
  await signUp(page);
  await addExpense(page, { amount: "2500", category: "Food" });
  await page.getByRole("button", { name: "Income", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add income" });
  await sheet.getByLabel("Amount").fill("10000");
  await sheet.getByRole("button", { name: "Save income" }).click();
  await expect(page.getByText(/₹10,000 salary added/)).toBeVisible();

  await goPlan(page, /^Monthly summary/);
  await expect(page.getByText("Savings rate")).toBeVisible();
  const stats = page.locator("dl").first();
  await expect(stats).toContainText("₹10,000");
  await expect(stats).toContainText("₹2,500");
  await expect(stats).toContainText("₹7,500");
  await expect(stats).toContainText("75%");
  await expect(page.getByRole("region", { name: /Last 6 months/ })).toBeVisible();
});
