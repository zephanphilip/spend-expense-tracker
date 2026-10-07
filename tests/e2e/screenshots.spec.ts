import { expect, test } from "@playwright/test";
import { subDays, format } from "date-fns";

import { addExpense, openAddSheet, sheet, signUp } from "./helpers";

const OUT = "/private/tmp/claude-501/-Users-zephanphilip-works-Expense-tracker/76e729b3-542d-45bd-b32f-dfc4c9d55d01/scratchpad/shots";

test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

test("capture screens", async ({ page }, info) => {
  const p = info.project.name;
  await page.goto("/login");
  await page.screenshot({ path: `${OUT}/${p}-login.png` });
  await signUp(page);
  await page.screenshot({ path: `${OUT}/${p}-empty.png` });
  const d = (n: number, h: number) => { const x = subDays(new Date(), n); x.setHours(h, 10); return format(x, "yyyy-MM-dd'T'HH:mm"); };
  await addExpense(page, { amount: "420", category: "Food", note: "Dinner with Meera", when: d(0, 9) });
  await addExpense(page, { amount: "1299", category: "Shopping", method: "Credit", when: d(1, 13) });
  await addExpense(page, { amount: "85", category: "Transport", method: "UPI", note: "Metro", when: d(2, 8) });
  await addExpense(page, { amount: "2400", category: "Bills", method: "Debit", note: "Electricity", when: d(3, 19) });
  await addExpense(page, { amount: "650", category: "Groceries", method: "Cash", when: d(5, 18) });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${p}-dashboard.png`, fullPage: true });
  await openAddSheet(page);
  await sheet(page).getByLabel("Amount").fill("249.5");
  await sheet(page).getByText("Food", { exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${p}-add.png` });
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await page.goto("/expenses");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${p}-history.png`, fullPage: true });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${p}-filters.png` });
  await page.keyboard.press("Escape");
  await page.goto("/categories");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${p}-categories.png`, fullPage: true });
  await page.goto("/settings");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${p}-settings.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${p}-dashboard-dark.png`, fullPage: true });
});
