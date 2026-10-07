import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import { addExpense, signUp } from "./helpers";

const OUT = "/private/tmp/claude-501/-Users-zephanphilip-works-Expense-tracker/76e729b3-542d-45bd-b32f-dfc4c9d55d01/scratchpad/shots2";
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

test("phase 2 screens", async ({ page }, info) => {
  test.setTimeout(180_000);
  const p = info.project.name;
  const shot = async (name: string, fullPage = true) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${p}-${name}.png`, fullPage });
  };
  const nav = (name: string) => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name });
  await signUp(page);
  await addExpense(page, { amount: "4200", category: "Food" });
  await addExpense(page, { amount: "1299", category: "Shopping" });
  await addExpense(page, { amount: "2400", category: "Bills" });

  await page.goto("/budgets");
  await page.getByRole("button", { name: "Set budget" }).click();
  const b = page.getByRole("dialog", { name: /Budget for/ });
  await b.getByLabel("Overall monthly budget").fill("30000");
  await b.getByLabel("Food").fill("5000");
  await b.getByLabel("Shopping").fill("1000");
  await shot("budget-sheet", false);
  await b.getByRole("button", { name: "Save budget" }).click();
  await expect(b).toBeHidden();
  await shot("budgets");

  await page.goto("/income");
  await page.getByRole("radio", { name: "Recurring" }).check({ force: true });
  await page.getByRole("button", { name: "Add recurring income" }).click();
  const r = page.getByRole("dialog", { name: "New recurring income" });
  await r.getByLabel("Usual amount", { exact: true }).fill("85000");
  await r.getByLabel("Day of month").fill("1");
  await r.getByRole("button", { name: "Save" }).click();
  await expect(r).toBeHidden();
  await page.getByRole("button", { name: "Add" }).first().click();
  const i = page.getByRole("dialog", { name: "Add income" });
  await i.getByLabel("Amount").fill("82000");
  await i.getByLabel("Salary for").fill(format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), "yyyy-MM"));
  await shot("income-sheet", false);
  await i.getByRole("button", { name: "Save income" }).click();
  await expect(i).toBeHidden();
  await page.getByRole("radio", { name: "Overview" }).check({ force: true });
  await shot("income");

  await page.goto("/emis");
  await page.getByRole("button", { name: "Add loan" }).first().click();
  const e = page.getByRole("dialog", { name: /Add a loan/ });
  await e.getByLabel("Name").fill("Car loan");
  await e.getByLabel("Lender").fill("HDFC");
  await e.getByLabel("Loan amount").fill("500000");
  await e.getByLabel("Interest").fill("9");
  await e.getByLabel("Tenure").fill("60");
  await e.getByLabel("First EMI date").fill(format(new Date(new Date().getFullYear() - 1, new Date().getMonth(), 5), "yyyy-MM-dd"));
  await e.getByLabel("Installments already paid").fill("12");
  await shot("emi-sheet", false);
  await e.getByRole("button", { name: "Add loan" }).click();
  await expect(e).toBeHidden();
  await shot("emis");
  await page.getByRole("link", { name: /Car loan/ }).click();
  await shot("emi-detail");

  await page.goto("/wishlist");
  await page.getByRole("button", { name: "New wish" }).click();
  const g = page.getByRole("dialog", { name: "New wish" });
  await g.getByLabel("What do you want?").fill("MacBook Air");
  await g.getByLabel("Target amount").fill("120000");
  await g.getByLabel("Already saved").fill("45000");
  await g.getByLabel("By (optional)").fill(format(new Date(new Date().getFullYear() + 1, 2, 1), "yyyy-MM-dd"));
  await g.getByRole("button", { name: "Add wish" }).click();
  await expect(g).toBeHidden();
  await shot("wishlist");

  await page.goto("/summary");
  await shot("summary");
  await nav("Plan").click();
  await shot("plan");
  await nav("Home").click();
  await shot("dashboard");
  await page.emulateMedia({ colorScheme: "dark" });
  await shot("dashboard-dark");
});
