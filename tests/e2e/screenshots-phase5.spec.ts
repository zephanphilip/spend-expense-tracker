import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import { addExpense, signUp } from "./helpers";

const OUT = "/private/tmp/claude-501/-Users-zephanphilip-works-Expense-tracker/76e729b3-542d-45bd-b32f-dfc4c9d55d01/scratchpad/shots5";
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

test("phase 5 screens", async ({ page, context }, info) => {
  test.setTimeout(180_000);
  const p = info.project.name;
  const shot = async (name: string, fullPage = true) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${p}-${name}.png`, fullPage });
  };
  await signUp(page);
  await addExpense(page, { amount: "1840", category: "Food", note: "Dinner" });
  await page.goto("/emis");
  await page.getByRole("button", { name: "Add loan" }).first().click();
  const e = page.getByRole("dialog", { name: /Add a loan/ });
  await e.getByLabel("Name").fill("Car loan");
  await e.getByLabel("Loan amount").fill("500000");
  await e.getByLabel("Interest").fill("9");
  await e.getByLabel("Tenure").fill("60");
  const t = new Date(); t.setDate(t.getDate() + 2);
  await e.getByLabel("First EMI date").fill(format(t, "yyyy-MM-dd"));
  await e.getByRole("button", { name: "Add loan" }).click();
  await expect(page.getByText("Car loan added")).toBeVisible();
  await page.goto("/dashboard");
  await shot("dashboard", false);
  await page.getByRole("button", { name: /Reminders/ }).first().click();
  await shot("reminders", false);
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await shot("settings");
  await page.goto("/data");
  await shot("data");
  await context.setOffline(true);
  await page.goto("/dashboard").catch(() => undefined);
  await shot("offline", false);
  await context.setOffline(false);
  await page.goto("/missing-page");
  await shot("not-found", false);
});
