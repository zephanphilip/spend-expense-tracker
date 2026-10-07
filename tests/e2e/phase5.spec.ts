import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { format, subMonths } from "date-fns";

import { addExpense, signUp } from "./helpers";

async function addRecurring(page: Page, { name, amount, start, auto }: { name: string; amount: string; start: Date; auto: boolean }) {
  await page.goto("/recurring");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const s = page.getByRole("dialog", { name: "New recurring payment" });
  await s.getByLabel("Name").fill(name);
  await s.getByLabel("Amount").fill(amount);
  await s.getByLabel("Next payment").fill(format(start, "yyyy-MM-dd"));
  await s.getByText("Home", { exact: true }).click();
  if (auto) await s.getByLabel("Record automatically").check({ force: true });
  await s.getByRole("button", { name: "Save" }).click();
  await expect(s).toBeHidden();
}

test("recurring automation records due occurrences exactly once", async ({ page }) => {
  await signUp(page);
  const start = subMonths(new Date(), 2); // 3 occurrences due: 2 months ago, last month, this month
  await addRecurring(page, { name: "Rent", amount: "20000", start, auto: true });
  await page.goto("/dashboard");
  await expect(page.getByText(/Recorded 3 recurring entries automatically/)).toBeVisible({ timeout: 15000 });

  // Reloading (automation runs again) must not create duplicates.
  await page.reload();
  await page.waitForTimeout(3000);
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "All time" }).click();
  await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("3 expenses")).toBeVisible();
  await expect(page.getByLabel("Recurring").first()).toBeVisible();
  await page.goto("/recurring");
  await expect(page.getByText(/next \d+ \w{3}/)).toBeVisible();
});

test("backup and restore into a fresh account, without duplicates", async ({ page }) => {
  await signUp(page, { name: "Asha Rao" });
  await addExpense(page, { amount: "450", category: "Food", note: "Dinner" });
  await addExpense(page, { amount: "120", category: "Transport", note: "Metro" });
  // An account with a non-trivial balance history (balance ≠ opening after an expense).
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const acc = page.getByRole("dialog", { name: "Add account" });
  await acc.getByLabel("Name").fill("HDFC");
  await acc.getByLabel(/Current balance/).fill("10000");
  await acc.getByRole("button", { name: "Add account" }).click();
  await expect(acc).toBeHidden();
  await addExpense(page, { amount: "1000", category: "Bills", method: "UPI", note: "Electricity" });

  await page.goto("/data");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await download;
  const backupPath = (await file.path())!;
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  expect(backup.app).toBe("ledger");
  expect(backup.collections.expenses).toHaveLength(3);

  // Fresh account.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signUp(page, { name: "Ravi Kumar" });
  await page.goto("/data");
  await page.locator("#restore-file").setInputFiles(backupPath);
  const preview = page.getByRole("table", { name: "Restore preview" });
  await expect(preview).toContainText("Expenses");
  await page.getByRole("button", { name: /^Restore \d+/ }).click();
  await expect(page.getByText("Restore complete")).toBeVisible({ timeout: 20000 });

  await page.goto("/accounts");
  await expect(page.getByRole("link", { name: /HDFC/ })).toContainText("₹9,000"); // balance restored as backed up
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹1,570");

  // Restoring the same file again creates nothing.
  await page.goto("/data");
  await page.locator("#restore-file").setInputFiles(backupPath);
  await expect(page.getByRole("button", { name: "Restore 0" })).toBeDisabled();
});

test("quick add deep link, keyboard help, reminders and offline banner", async ({ page, context }) => {
  await signUp(page);
  await page.goto("/dashboard?add=expense");
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.keyboard.press("Escape");

  // EMI due tomorrow → reminder.
  await page.goto("/emis");
  await page.getByRole("button", { name: "Add loan" }).first().click();
  const e = page.getByRole("dialog", { name: /Add a loan/ });
  await e.getByLabel("Name").fill("Bike");
  await e.getByLabel("Loan amount").fill("12000");
  await e.getByLabel("Interest").fill("0");
  await e.getByLabel("Tenure").fill("12");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await e.getByLabel("First EMI date").fill(format(tomorrow, "yyyy-MM-dd"));
  await e.getByRole("button", { name: "Add loan" }).click();
  await expect(page.getByText("Bike added")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Reminders, \d/ }).click();
  await expect(page.getByRole("dialog", { name: "Reminders" })).toContainText("Bike EMI due tomorrow");
  await page.keyboard.press("Escape");

  // Offline banner.
  await context.setOffline(true);
  await expect(page.getByText(/Offline — changes are saved on this device/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Back online", { exact: true })).toBeVisible();
});

test("desktop keyboard shortcuts", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "desktop only");
  await signUp(page);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  // Shortcuts are ignored while any dialog is still in the DOM (incl. its exit animation).
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/analytics$/);
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/expenses/);
  await expect(page.getByLabel("Search expenses")).toBeFocused();
});

test("offline app shell: installed app reopens offline with cached data (production build)", async ({ page, context }) => {
  test.skip(process.env.E2E_PROD !== "1", "service worker is only registered in production builds");
  await signUp(page);
  await addExpense(page, { amount: "321", category: "Food", note: "Offline check" });
  // Let the service worker install and precache the app shell.
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Offline — changes are saved on this device/)).toBeVisible();
  // Auth (IndexedDB) and Firestore's persistent cache still serve the dashboard.
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹321");
  // Adding works offline too and appears immediately.
  await addExpense(page, { amount: "50", category: "Transport", note: "Offline add" });
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹371");
  await context.setOffline(false);
  await expect(page.getByText("Back online", { exact: true })).toBeVisible();
});
