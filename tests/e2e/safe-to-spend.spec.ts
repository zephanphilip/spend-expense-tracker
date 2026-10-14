import { expect, type Page, test } from "@playwright/test";
import { addDays, format, getDaysInMonth, isSameMonth } from "date-fns";

import { formatMoney } from "@/lib/money";

import { addExpense, signUp } from "./helpers";

const inr = (minor: number) => formatMoney(minor, "INR");
const card = (page: Page) => page.getByRole("region", { name: "Safe to spend today" });

async function setOverallBudget(page: Page, amount: string) {
  await page.goto("/budgets");
  await page.getByRole("button", { name: /^(Set budget|Edit)$/ }).first().click();
  const sheet = page.getByRole("dialog", { name: /Budget for/ });
  await sheet.getByLabel("Overall monthly budget").fill(amount);
  await sheet.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText(/Budget saved/).first()).toBeVisible();
}

test("safe to spend today: budget ÷ days left, live updates, overspending", async ({ page }) => {
  const now = new Date();
  const daysLeft = getDaysInMonth(now) - now.getDate() + 1;
  const perDay = (remainingMinor: number) => inr(Math.floor(Math.max(0, remainingMinor) / daysLeft));

  await signUp(page);
  await addExpense(page, { amount: "2000", category: "Food" });
  // A budget with only category limits: the card asks for an overall budget instead.
  await page.goto("/budgets");
  await page.getByRole("button", { name: /^Set budget/ }).first().click();
  const sheet = page.getByRole("dialog", { name: /Budget for/ });
  await sheet.getByLabel("Food").fill("5000");
  await sheet.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText(/Budget saved/).first()).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Safe to spend today.*overall monthly budget/ })).toHaveAttribute("href", "/budgets");

  await setOverallBudget(page, "31000");
  await page.goto("/dashboard");
  const c = card(page);
  await expect(c).toContainText(perDay(2900000));
  await expect(c.getByRole("term").filter({ hasText: /^Budget$/ }).locator("..")).toContainText(inr(3100000));
  await expect(c.getByRole("term").filter({ hasText: "Spent so far" }).locator("..")).toContainText(inr(200000));
  await expect(c.getByRole("term").filter({ hasText: "Remaining" }).locator("..")).toContainText(inr(2900000));
  await expect(c.getByRole("progressbar", { name: "Share of monthly budget spent" })).toHaveAttribute("aria-valuenow", "6");
  await expect(c).toContainText(daysLeft === 1 ? "Last day" : `${daysLeft} days left`);

  // A new expense updates the card live (no reload).
  await addExpense(page, { amount: "1000", category: "Transport" });
  await expect(c.getByRole("term").filter({ hasText: "Spent so far" }).locator("..")).toContainText(inr(300000));
  await expect(c).toContainText(perDay(2800000));

  // Something dated later this month isn't "spent" yet — it's called out, not counted.
  const later = addDays(now, 1);
  if (isSameMonth(later, now)) {
    await addExpense(page, { amount: "500", category: "Bills", when: format(later, "yyyy-MM-dd'T'12:00") });
    await expect(c).toContainText(`${inr(50000)} dated later this month`);
    await expect(c.getByRole("term").filter({ hasText: "Spent so far" }).locator("..")).toContainText(inr(300000));
  }

  // Overspending: nothing safe to spend, shows how far over.
  await addExpense(page, { amount: "30000", category: "Shopping" });
  await expect(c).toContainText("over this month's budget");
  await expect(c.getByRole("term").filter({ hasText: "Over by" }).locator("..")).toContainText(inr(200000));
  await expect(c).toContainText(`${inr(0)}`);
  await expect(c.getByRole("progressbar", { name: "Share of monthly budget spent" })).toHaveAttribute("aria-valuenow", "100");

  // Raising the budget updates it straight away too.
  await setOverallBudget(page, "64000");
  await page.goto("/dashboard");
  await expect(card(page)).toContainText(perDay(6400000 - 3300000));
});
