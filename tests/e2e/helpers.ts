import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-42";

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function signUp(page: Page, { name = "Asha Rao", email = uniqueEmail("user") } = {}) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { name, email };
}

/** The add/edit sheet (vaul drawer on phones, dialog on desktop). */
export function sheet(page: Page, name: "Add expense" | "Edit expense" = "Add expense") {
  return page.getByRole("dialog", { name });
}

export async function openAddSheet(page: Page) {
  // Bottom-nav button on phones, sidebar button on desktop; only one is visible.
  await page.getByRole("button", { name: /^Add expense/ }).filter({ visible: true }).first().click();
  await expect(sheet(page)).toBeVisible();
}

export async function addExpense(
  page: Page,
  { amount, category, method, note, when }: {
    amount: string;
    category: string;
    method?: string;
    note?: string;
    when?: string;
  },
) {
  await openAddSheet(page);
  const s = sheet(page);
  await s.getByLabel("Amount").fill(amount);
  await s.getByText(category, { exact: true }).click();
  if (method) await s.getByText(method, { exact: true }).click();
  if (note) await s.getByLabel("Note").fill(note);
  if (when) await s.getByLabel("Date and time").fill(when);
  await s.getByRole("button", { name: /^Save/ }).click();
  await expect(s).toBeHidden();
}
