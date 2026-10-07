import { expect, test } from "@playwright/test";

import { addExpense, signUp } from "./helpers";

const OUT = "/private/tmp/claude-501/-Users-zephanphilip-works-Expense-tracker/76e729b3-542d-45bd-b32f-dfc4c9d55d01/scratchpad/shots3";
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

test("phase 3 screens", async ({ page }, info) => {
  test.setTimeout(180_000);
  const p = info.project.name;
  const shot = async (name: string, fullPage = true) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${p}-${name}.png`, fullPage });
  };
  const addAccount = async (type: string, name: string, balance: string, extra: Record<string, string> = {}) => {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const s = page.getByRole("dialog", { name: "Add account" });
    await s.getByRole("radiogroup", { name: "Account type" }).getByText(type, { exact: true }).click();
    await s.getByLabel("Name").fill(name);
    await s.getByLabel(/Current (balance|outstanding)/).fill(balance);
    for (const [label, value] of Object.entries(extra)) await s.getByLabel(label).fill(value);
    if (name === "Amex Gold") await shot("account-sheet", false);
    await s.getByRole("button", { name: "Add account" }).click();
    await expect(s).toBeHidden();
  };
  await signUp(page);
  await addAccount("Bank", "HDFC Salary", "184500");
  await addAccount("Cash", "Wallet cash", "3200");
  await addAccount("Wallet", "Paytm", "1500");
  await addAccount("Card", "Amex Gold", "24350", { "Credit limit": "150000", "Statement day": "20", "Payment due day": "8" });
  await addExpense(page, { amount: "1840", category: "Food", method: "Credit", note: "Dinner" });
  await addExpense(page, { amount: "620", category: "Transport", method: "UPI" });
  await page.goto("/accounts");
  await shot("accounts");
  await page.getByRole("button", { name: "Pay card" }).click();
  await shot("pay-card", false);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /Amex Gold/ }).first().click();
  await shot("card-detail");

  await page.goto("/investments");
  for (const [name, amt, val] of [["Parag Parikh Flexi Cap", "250000", "312000"], ["HDFC FD", "100000", "107200"], ["Sovereign Gold Bond", "60000", "71500"]]) {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const s = page.getByRole("dialog", { name: "Add investment" });
    if (name.includes("FD")) await s.getByRole("radiogroup", { name: "Investment type" }).getByText("Fixed deposit").click();
    if (name.includes("Gold")) await s.getByRole("radiogroup", { name: "Investment type" }).getByText("Gold").click();
    await s.getByLabel("Name").fill(name);
    await s.getByLabel("Amount invested").fill(amt);
    await s.getByLabel("Current value").fill(val);
    await s.getByRole("button", { name: "Add investment" }).click();
    await expect(s).toBeHidden();
  }
  await shot("investments");

  await page.goto("/recurring");
  for (const [name, amt, cat] of [["Rent", "22000", "Home"], ["Netflix", "649", "Fun"], ["Gym", "1500", "Health"]]) {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const s = page.getByRole("dialog", { name: "New recurring payment" });
    await s.getByLabel("Name").fill(name);
    await s.getByLabel("Amount").fill(amt);
    await s.getByText(cat, { exact: true }).click();
    if (name === "Gym") await shot("recurring-sheet", false);
    await s.getByRole("button", { name: "Save" }).click();
    await expect(s).toBeHidden();
  }
  await shot("recurring");
  await page.goto("/upcoming");
  await shot("upcoming");
  await page.goto("/net-worth");
  await shot("net-worth");
  await page.goto("/plan");
  await shot("plan");
  await page.goto("/dashboard");
  await shot("dashboard");
  await page.goto("/dashboard");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("dialog", { name: "Add expense" }).getByLabel("Amount").fill("450");
  await shot("add-expense", false);
});
