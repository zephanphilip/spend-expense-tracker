import { expect, test } from "@playwright/test";
import { format, subDays } from "date-fns";

import { addExpense, openAddSheet, PASSWORD, sheet, signUp } from "./helpers";

test("signed-out visitors are sent to login and back after signing in", async ({ page }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/login\?next=%2Fexpenses$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("sign-in shows a friendly error for wrong credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/don't match|No account found/)).toBeVisible();
});

test("add, edit, search, filter and delete expenses on a phone", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { name: "Hi, Asha" })).toBeVisible();
  await expect(page.getByText("Your first expense is one tap away")).toBeVisible();

  // Validation: nothing entered.
  await openAddSheet(page);
  const s = sheet(page);
  await expect(s.getByLabel("Amount")).toHaveAttribute("inputmode", "decimal");
  await s.getByRole("button", { name: "Save expense" }).click();
  await expect(s.getByText("Enter an amount")).toBeVisible();
  await expect(s.getByText("Pick a category")).toBeVisible();

  // Amount sanitising: letters and extra decimals are dropped.
  await s.getByLabel("Amount").fill("2a49.567");
  await expect(s.getByLabel("Amount")).toHaveValue("249.56");
  await s.getByLabel("Amount").fill("249.5");
  await s.getByText("Food", { exact: true }).click();
  await s.getByText("Cash", { exact: true }).click();
  await s.getByLabel("Note").fill("Team lunch");
  await s.getByRole("button", { name: "Save ₹249.50" }).click();
  await expect(s).toBeHidden();
  await expect(page.getByText("₹249.50 · Food added")).toBeVisible();

  // Dashboard reflects it.
  const hero = page.getByRole("region", { name: /Spent in/ });
  await expect(hero).toContainText("₹249.50");
  await expect(page.getByRole("region", { name: "By category" })).toContainText("Food");
  await expect(page.getByRole("region", { name: "Recent" })).toContainText("Team lunch");

  // Explicit date/time: yesterday morning.
  const yesterday = subDays(new Date(), 1);
  yesterday.setHours(9, 15, 0, 0);
  await addExpense(page, {
    amount: "80",
    category: "Transport",
    method: "UPI",
    note: "Auto to office",
    when: format(yesterday, "yyyy-MM-dd'T'HH:mm"),
  });

  // History groups by day.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Yesterday" })).toBeVisible();
  await expect(page.getByText("Auto to office")).toBeVisible();

  // Search.
  await page.getByLabel("Search expenses").fill("lunch");
  await expect(page.getByText("Team lunch")).toBeVisible();
  await expect(page.getByText("Auto to office")).toBeHidden();
  await page.getByLabel("Search expenses").fill("zzz-nothing");
  await expect(page.getByText("No matching expenses")).toBeVisible();
  await page.getByRole("button", { name: "Clear search & filters" }).click();

  // Filter by payment method (server-side composite index query).
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  await filters.getByRole("button", { name: "UPI" }).click();
  await filters.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Auto to office")).toBeVisible();
  await expect(page.getByText("Team lunch")).toBeHidden();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByText("Team lunch")).toBeVisible();

  // Edit.
  await page.getByRole("button", { name: /Team lunch/ }).click();
  const edit = sheet(page, "Edit expense");
  await expect(edit.getByLabel("Amount")).toHaveValue("249.50");
  await edit.getByLabel("Amount").fill("300");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Expense updated")).toBeVisible();
  await expect(page.getByRole("button", { name: /Team lunch/ })).toContainText("₹300");

  // Delete with confirmation (cancel first, then confirm).
  await page.getByRole("button", { name: /Team lunch/ }).click();
  await sheet(page, "Edit expense").getByRole("button", { name: "Delete expense" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this expense?" });
  await expect(confirm).toContainText("₹300 · Food");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await sheet(page, "Edit expense").getByRole("button", { name: "Delete expense" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Expense deleted")).toBeVisible();
  await expect(page.getByRole("button", { name: /Team lunch/ })).toBeHidden();

  // Undo restores it.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /Team lunch/ })).toBeVisible();
});

test("create a custom category from the add sheet and use it", async ({ page }) => {
  await signUp(page);
  await openAddSheet(page);
  const s = sheet(page);
  await s.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "New category" });
  await dialog.getByLabel("Name").fill("Coffee");
  // Radios are visually hidden; users tap the surrounding label.
  await dialog.locator("label").filter({ has: page.getByRole("radio", { name: "Coffee" }) }).click();
  await dialog.getByRole("button", { name: "Create category" }).click();
  await expect(dialog).toBeHidden();
  // The sheet is still open with the new category selected.
  await expect(s).toBeVisible();
  await expect(s.getByRole("radio", { name: "Coffee" })).toBeChecked();
  await s.getByLabel("Amount").fill("120");
  await s.getByRole("button", { name: "Save ₹120" }).click();
  await expect(page.getByText("₹120 · Coffee added")).toBeVisible();

  // Archive it from the Categories screen; history still shows the name.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Plan" }).click();
  await page.getByRole("navigation", { name: "Plan" }).getByRole("link", { name: /Categories/ }).click();
  await page.getByRole("button", { name: "Archive Coffee" }).click();
  await expect(page.getByRole("region", { name: "Archived" })).toContainText("Coffee");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("button", { name: /Coffee/ })).toBeVisible();
});

test("profile, currency and sign out / sign in", async ({ page }) => {
  const { email } = await signUp(page, { name: "Ravi Kumar" });
  await addExpense(page, { amount: "50", category: "Food" });

  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("$50");

  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(dashboard|settings)$/);
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("$50");
});
