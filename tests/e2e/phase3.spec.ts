import { expect, type Page, test } from "@playwright/test";
import { format } from "date-fns";

import { openAddSheet, sheet, signUp } from "./helpers";

async function addAccount(
  page: Page,
  opts: { type: "Bank" | "Cash" | "Wallet" | "Card"; name: string; balance?: string; limit?: string; statementDay?: string; dueDay?: string },
) {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const s = page.getByRole("dialog", { name: "Add account" });
  // Radios are visually hidden; tap the segment label like a user would.
  await s.getByRole("radiogroup", { name: "Account type" }).getByText(opts.type, { exact: true }).click();
  await s.getByLabel("Name").fill(opts.name);
  if (opts.balance) await s.getByLabel(/Current (balance|outstanding)/).fill(opts.balance);
  if (opts.limit) await s.getByLabel("Credit limit").fill(opts.limit);
  if (opts.statementDay) await s.getByLabel("Statement day").fill(opts.statementDay);
  if (opts.dueDay) await s.getByLabel("Payment due day").fill(opts.dueDay);
  await s.getByRole("button", { name: "Add account" }).click();
  await expect(s).toBeHidden();
}

const accountRow = (page: Page, name: string) => page.getByRole("link", { name: new RegExp(name) }).first();

test("accounts: transfer moves money without counting as spending", async ({ page }) => {
  await signUp(page);
  await addAccount(page, { type: "Bank", name: "HDFC", balance: "50000" });
  await addAccount(page, { type: "Wallet", name: "Paytm" });
  await expect(page.getByText("Available balance")).toBeVisible();

  await page.getByRole("button", { name: "Transfer between accounts" }).click();
  const t = page.getByRole("dialog", { name: "Transfer money" });
  await t.getByRole("group", { name: "From" }).getByText("HDFC").click();
  await t.getByRole("group", { name: "To" }).getByText("Paytm").click();
  await t.getByLabel("Amount").fill("5000");
  await t.getByRole("button", { name: "Transfer" }).click();
  await expect(page.getByText("₹5,000 moved to Paytm")).toBeVisible();

  await expect(accountRow(page, "HDFC")).toContainText("₹45,000");
  await expect(accountRow(page, "Paytm")).toContainText("₹5,000");

  // Spending is untouched.
  await page.goto("/dashboard");
  await expect(page.getByText("Your first expense is one tap away")).toBeVisible();

  // Account detail shows the TRANSFER with a running balance.
  await page.goto("/accounts");
  await accountRow(page, "HDFC").click();
  const activity = page.getByRole("region", { name: "Activity" });
  await expect(activity).toContainText("Transfer");
  await expect(activity).toContainText("To Paytm");
  await expect(activity).toContainText("₹45,000");
});

test("credit card: spend on card, pay from bank — no double counting", async ({ page }) => {
  await signUp(page);
  await addAccount(page, { type: "Bank", name: "HDFC", balance: "50000" });
  await addAccount(page, { type: "Card", name: "Amex", limit: "100000", statementDay: "20", dueDay: "8" });

  // Paying by "Credit" preselects the card.
  await page.goto("/dashboard");
  await openAddSheet(page);
  const s = sheet(page);
  await s.getByLabel("Amount").fill("2000");
  await s.getByText("Food", { exact: true }).click();
  await s.getByText("Credit", { exact: true }).click();
  await expect(s.getByRole("radio", { name: "Amex" })).toBeChecked();
  await s.getByRole("button", { name: /^Save/ }).click();
  await expect(s).toBeHidden();
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹2,000");

  await page.goto("/accounts");
  await expect(page.getByText("2% used")).toBeVisible();
  await expect(page.getByText("₹98,000 available")).toBeVisible();

  // Pay the full outstanding from the bank.
  await page.getByRole("button", { name: "Pay card" }).click();
  const pay = page.getByRole("dialog", { name: "Pay Amex" });
  await pay.getByRole("button", { name: /Full outstanding/ }).click();
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("₹2,000 paid to Amex")).toBeVisible();
  await expect(accountRow(page, "HDFC")).toContainText("₹48,000");
  await expect(page.getByRole("button", { name: "Pay card" })).toBeHidden(); // nothing owed

  // Spending is still ₹2,000 — the payment is a DEBT_PAYMENT, not an expense.
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹2,000");
  await page.goto("/expenses");
  await expect(page.getByText("1 expense")).toBeVisible();

  // Card activity shows both sides.
  await page.goto("/accounts");
  await accountRow(page, "Amex").click();
  const activity = page.getByRole("region", { name: "Activity" });
  await expect(activity).toContainText("Debt payment");
  await expect(activity).toContainText("Payment from HDFC");
  await expect(activity).toContainText("Expense");
});

test("investments: buy from bank, revalue, sell with realised gain", async ({ page }) => {
  await signUp(page);
  await addAccount(page, { type: "Bank", name: "HDFC", balance: "50000" });

  await page.goto("/investments");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const s = page.getByRole("dialog", { name: "Add investment" });
  await s.getByLabel("Name").fill("Index fund");
  await s.getByLabel("Amount invested").fill("10000");
  await s.getByRole("group", { name: /Paid from/ }).getByText("HDFC").click();
  await s.getByRole("button", { name: "Add investment" }).click();
  await expect(page.getByText("Index fund added")).toBeVisible();

  await page.getByRole("link", { name: /Index fund/ }).click();
  await page.getByRole("button", { name: "Value", exact: true }).click();
  let tx = page.getByRole("dialog", { name: "Index fund" });
  await tx.getByLabel("Current value").fill("12000");
  await tx.getByRole("button", { name: "Update value" }).click();
  await expect(page.getByRole("region", { name: "Holding value" })).toContainText("+₹2,000 (+20.0%)");

  await page.getByRole("button", { name: "Sell", exact: true }).click();
  tx = page.getByRole("dialog", { name: "Index fund" });
  await tx.getByLabel("Amount received").fill("6000");
  await expect(tx).toContainText("Cost basis removed ₹5,000");
  await expect(tx).toContainText("Gain ₹1,000");
  await tx.getByRole("group", { name: "Received into" }).getByText("HDFC").click();
  await tx.getByRole("button", { name: "Sell / redeem" }).click();
  await expect(page.getByText(/₹6,000 redeemed · gain ₹1,000/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Holding value" })).toContainText("₹6,000");

  await page.goto("/accounts");
  await expect(accountRow(page, "HDFC")).toContainText("₹46,000"); // 50,000 − 10,000 + 6,000
});

test("recurring payment, upcoming, EMI from account and net worth", async ({ page }) => {
  await signUp(page);
  await addAccount(page, { type: "Bank", name: "HDFC", balance: "100000" });
  await addAccount(page, { type: "Card", name: "Amex", limit: "50000", balance: "1000" });

  await page.goto("/recurring");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const rp = page.getByRole("dialog", { name: "New recurring payment" });
  await rp.getByLabel("Name").fill("Netflix");
  await rp.getByLabel("Amount").fill("649");
  await rp.getByText("Fun", { exact: true }).click();
  await rp.getByRole("group", { name: /From account/ }).getByText("Amex").click();
  await rp.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Netflix added · Monthly/)).toBeVisible();

  // Shows on the upcoming screen; pay it from there.
  await page.goto("/upcoming");
  await expect(page.getByText("Netflix")).toBeVisible();
  await page.getByRole("button", { name: "Pay" }).first().click();
  const pay = page.getByRole("dialog", { name: "Pay Netflix" });
  await pay.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText("₹649 · Netflix paid")).toBeVisible();

  await page.goto("/recurring");
  const next = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, Math.min(new Date().getDate(), 28)), "MMM");
  await expect(page.getByText(new RegExp(`next \\d+ ${next}`))).toBeVisible();

  // EMI paid from the bank debits it once (and also counts in spending by default).
  await page.goto("/emis");
  await page.getByRole("button", { name: "Add loan" }).first().click();
  const e = page.getByRole("dialog", { name: /Add a loan/ });
  await e.getByLabel("Name").fill("Bike");
  await e.getByLabel("Loan amount").fill("12000");
  await e.getByLabel("Interest").fill("0");
  await e.getByLabel("Tenure").fill("12");
  await e.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Pay EMI" }).click();
  const ep = page.getByRole("dialog", { name: "Pay Bike" });
  await expect(ep.getByRole("radio", { name: "HDFC" })).toBeChecked();
  await ep.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Paid from HDFC/)).toBeVisible();

  // Net worth = bank 99,000 − card (1,000 + 649) − loan 11,000 = 86,351
  await page.goto("/net-worth");
  const nw = page.getByRole("region", { name: "Net worth" });
  await expect(nw).toContainText("₹86,351");
  await expect(page.getByRole("region", { name: "Liabilities" })).toContainText("₹1,649");
  await expect(page.getByRole("region", { name: "Liabilities" })).toContainText("₹11,000");
});
