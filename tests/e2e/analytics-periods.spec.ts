import { expect, type Page, test } from "@playwright/test";
import { format, isSameYear, subDays, subYears } from "date-fns";

import { addExpense, signUp } from "./helpers";

const at = (d: Date) => format(d, "yyyy-MM-dd'T'10:00");
const money = (minor: number) => `₹${minor.toLocaleString("en-IN")}`;
const kind = (page: Page, name: string) => page.getByRole("group", { name: "Period type" }).getByRole("button", { name, exact: true });

test("analytics: week, month, year, rolling ranges and custom dates", async ({ page }) => {
  const now = new Date();
  const lastWeek = subDays(now, 7);
  const lastYear = subYears(now, 1);
  await signUp(page);
  await addExpense(page, { amount: "300", category: "Food", when: at(now) });
  await addExpense(page, { amount: "200", category: "Transport", when: at(lastWeek) });
  await addExpense(page, { amount: "1000", category: "Shopping", when: at(lastYear) });

  await page.goto("/analytics");
  const kpis = page.locator("dl").first();
  await expect(kpis).toContainText("₹300"); // this month (default) …
  if (lastWeek.getMonth() === now.getMonth()) await expect(kpis).toContainText("₹500");

  // Week: this week, step back to last week, and return.
  await kind(page, "Week").click();
  await expect(page.getByText("This week", { exact: true })).toBeVisible();
  await expect(kpis).toContainText("₹300");
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page.getByText("Last week", { exact: true })).toBeVisible();
  await expect(kpis).toContainText("₹200");
  await expect(page.getByRole("button", { name: "Next week" })).toBeEnabled();
  await page.getByRole("button", { name: "This week", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();

  // Year: this year vs last year, monthly grouping available.
  await kind(page, "Year").click();
  const thisYear = 300 + (isSameYear(lastWeek, now) ? 200 : 0);
  await expect(kpis).toContainText(money(thisYear));
  await expect(page.getByRole("group", { name: "Group by" }).getByRole("button", { name: "Month" })).toBeVisible();
  await page.getByRole("button", { name: "Previous year" }).click();
  await expect(kpis).toContainText(money(1000 + (isSameYear(lastWeek, now) ? 0 : 200)));
  await expect(page.getByRole("region", { name: "Period summary" })).toContainText("Biggest day");

  // Rolling ranges.
  await kind(page, "Range").click();
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect(kpis).toContainText("₹300");
  await page.getByRole("button", { name: "Last 30 days" }).click();
  await expect(kpis).toContainText("₹500");

  // Custom dates: just last week's day.
  await kind(page, "Custom").click();
  await page.getByLabel("From").fill(format(lastWeek, "yyyy-MM-dd"));
  await page.getByLabel("To").fill(format(lastWeek, "yyyy-MM-dd"));
  await expect(kpis).toContainText("₹200");
  await expect(page.getByText("Computed from individual expenses in this period.")).toBeVisible();
});
