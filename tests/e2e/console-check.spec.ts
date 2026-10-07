import { expect, test } from "@playwright/test";

import { addExpense, signUp } from "./helpers";

test.skip(!process.env.CONSOLE_CHECK, "diagnostic only");

test("analytics console is clean", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  await signUp(page);
  await addExpense(page, { amount: "1200", category: "Food" });
  await page.goto("/analytics");
  await expect(page.locator("dl").first()).toBeVisible({ timeout: 30_000 });
  for (const t of ["Spending", "Cash flow", "Wealth", "Insights"]) {
    await page.getByRole("tab", { name: new RegExp(t) }).click();
    await page.waitForTimeout(600);
  }
  const unique = [...new Set(messages.filter((m) => !m.includes("already-exists") && !m.includes("Download the React DevTools")))];
  console.log("CONSOLE:\n" + unique.join("\n"));
});
