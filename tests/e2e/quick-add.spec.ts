import { expect, type Page, test } from "@playwright/test";
import { format, setDate, subMonths } from "date-fns";

import { addExpense, PASSWORD, sheet, signUp, uniqueEmail } from "./helpers";

/** Grid tile (not the "…, recent" chip) for a category. */
const tile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}(, (₹|No budget)|$)`) });
const quickAddMain = (page: Page) => page.locator("main");

async function setCategoryBudget(page: Page, limits: Record<string, string>) {
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Set budget" }).click();
  const sheet = page.getByRole("dialog", { name: /Budget for/ });
  for (const [category, amount] of Object.entries(limits)) await sheet.getByLabel(category).fill(amount);
  await sheet.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText(/Budget saved/).first()).toBeVisible();
}

/** Amount → Category → (skip note) → Payment → Confirm → Add. */
async function quickAdd(page: Page, { amount, category, method }: { amount: string; category: string; method: string }) {
  const field = page.getByLabel("Amount");
  await expect(field).toBeFocused();
  await field.fill(amount);
  await page.keyboard.press("Enter");
  await tile(page, category).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: new RegExp(`^${method}`) }).click();
  await page.getByRole("button", { name: "Add expense" }).click();
}

test("quick add: sequential flow and budget remaining / exceeded / none", async ({ page }) => {
  await signUp(page);
  await setCategoryBudget(page, { Food: "8000" });
  await addExpense(page, { amount: "5500", category: "Food" });

  await page.goto("/quick-add");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0); // no app shell
  await quickAdd(page, { amount: "500", category: "Food", method: "UPI" });
  // ₹8,000 − (₹5,500 + ₹500) = ₹2,000 left.
  await expect(page.getByRole("heading", { name: "Added", exact: true })).toBeVisible();
  await expect(quickAddMain(page)).toContainText("₹2,000 remaining");
  await expect(quickAddMain(page)).toContainText("75% used · ₹6,000 of ₹8,000");

  await page.getByRole("button", { name: "Add another" }).click();
  await quickAdd(page, { amount: "2450", category: "Food", method: "Cash" });
  await expect(page.getByRole("heading", { name: "Added — budget exceeded" })).toBeVisible();
  await expect(quickAddMain(page)).toContainText("₹450 over budget");

  await page.getByRole("button", { name: "Add another" }).click();
  await quickAdd(page, { amount: "80", category: "Transport", method: "UPI" });
  await expect(quickAddMain(page)).toContainText("No Transport budget");
  await expect(page.getByRole("link", { name: "Set Transport budget" })).toHaveAttribute("href", "/budgets");

  // Done returns to the normal app, which reflects every quick-added expense.
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/expenses");
  await expect(page.getByText(/4 expenses · ₹8,530/)).toBeVisible();
});

/** Overwrites this month's stored per-category aggregate (as a stale/partial one would be). */
async function corruptMonthlyAggregate(email: string, byCategory: Record<string, number>) {
  const auth = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  }).then((r) => r.json() as Promise<{ localId: string }>);
  const month = format(new Date(), "yyyy-MM");
  const fields = Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, { integerValue: String(v) }]));
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-ledger/databases/(default)/documents/users/${auth.localId}/monthlyStats/${month}?updateMask.fieldPaths=byCategory`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ fields: { byCategory: { mapValue: { fields } } } }),
    },
  );
  expect(res.ok).toBe(true);
}

test("quick add: category hints use this month's stored expenses, include this amount, ignore card payments", async ({ page }) => {
  const { email } = await signUp(page);
  // A card with a bank to pay it from.
  for (const a of [
    { type: "Bank", name: "HDFC", balance: "50000" },
    { type: "Card", name: "Amex", limit: "100000" },
  ] as const) {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const s = page.getByRole("dialog", { name: "Add account" });
    await s.getByRole("radiogroup", { name: "Account type" }).getByText(a.type, { exact: true }).click();
    await s.getByLabel("Name").fill(a.name);
    if (a.type === "Bank") await s.getByLabel(/Current balance/).fill(a.balance);
    else await s.getByLabel("Credit limit").fill(a.limit);
    await s.getByRole("button", { name: "Add account" }).click();
    await expect(s).toBeHidden();
  }
  await page.goto("/dashboard");
  await addExpense(page, { amount: "1500", category: "Food", method: "Credit" }); // on the card
  await addExpense(page, { amount: "1000", category: "Food", method: "Cash" });
  // Last month's spending doesn't count against this month.
  const lastMonth = setDate(subMonths(new Date(), 1), 15);
  await addExpense(page, { amount: "3000", category: "Food", method: "Cash", when: format(lastMonth, "yyyy-MM-dd'T'12:00") });
  // Paying the card bill is a transfer, not more Food spending.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Pay card" }).click();
  const pay = page.getByRole("dialog", { name: "Pay Amex" });
  await pay.getByRole("button", { name: /Full outstanding/ }).click();
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("₹1,500 paid to Amex")).toBeVisible();
  await setCategoryBudget(page, { Food: "8000" });
  // The hints must not depend on the derived aggregate (it used to show the full ₹8,000).
  await corruptMonthlyAggregate(email, { food: 0 });

  await page.goto("/quick-add");
  await page.getByLabel("Amount").fill("500");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Budget left this month after ₹500")).toBeVisible();
  // ₹8,000 − (₹1,500 card + ₹1,000 cash + ₹500 this one) = ₹5,000.
  await expect(tile(page, "Food")).toHaveAccessibleName("Food, ₹5,000 left");
  await expect(tile(page, "Transport")).toHaveAccessibleName("Transport, No budget");

  // A bigger amount flips to over budget; the saved result agrees with the hint.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByLabel("Amount").fill("6000");
  await page.keyboard.press("Enter");
  await expect(tile(page, "Food")).toHaveAccessibleName("Food, ₹500 over");
  await tile(page, "Food").click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /^UPI/ }).click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(quickAddMain(page)).toContainText("₹500 over budget");

  // The new expense is counted for the next one straight away (live, not cached).
  await page.getByRole("button", { name: "Add another" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.keyboard.press("Enter");
  await expect(tile(page, "Food")).toHaveAccessibleName("Food, ₹600 over");
});

test("quick add: back navigation keeps data; one-tap save; frequent choices first", async ({ page }) => {
  await signUp(page);
  await addExpense(page, { amount: "10", category: "Fuel", method: "Cash" });
  await addExpense(page, { amount: "10", category: "Fuel", method: "Cash" });

  await page.goto("/quick-add");
  await page.getByLabel("Amount").fill("42");
  await page.getByRole("button", { name: "Continue" }).click();
  // Most used category and method come first.
  await expect(page.getByRole("button", { name: "Fuel, recent" })).toBeVisible();
  const firstTile = page.locator("[aria-labelledby='all-title'] button").first();
  await expect(firstTile).toHaveAccessibleName(/^Fuel/);
  await tile(page, "Health").click();
  await page.getByLabel("Note (optional)").fill("Pharmacy");
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Amount")).toHaveValue("42");
  await page.keyboard.press("Enter");
  await tile(page, "Health").click();
  await expect(page.getByLabel("Note (optional)")).toHaveValue("Pharmacy");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button").filter({ hasText: /^Cash/ })).toContainText("Most used");

  // Search narrows the list; Enter picks the first match.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByLabel("Search categories").fill("trav");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toContainText("₹42 · Travel");

  // One-tap save: picking the method saves immediately.
  await page.evaluate(() => {
    localStorage.setItem("ledger:quick-add", JSON.stringify({ askNote: false, oneTapSave: true }));
    sessionStorage.removeItem("ledger:quick-add-draft"); // otherwise the unfinished draft resumes
  });
  await page.goto("/quick-add");
  await page.getByLabel("Amount").fill("7");
  await page.keyboard.press("Enter");
  await tile(page, "Food").click(); // no note step when askNote is off
  await page.getByRole("button", { name: /^UPI/ }).click();
  await expect(page.getByRole("heading", { name: "Added", exact: true })).toBeVisible();
});

test("quick add: deep link pre-fills, survives sign-in, and never saves by itself", async ({ page }) => {
  await page.goto("/quick-add?amount=250&category=Transport&method=cash&note=Auto");
  await expect(page).toHaveURL(/\/login\?next=/);
  const next = new URL(page.url()).searchParams.get("next")!;
  expect(next).toBe("/quick-add?amount=250&category=Transport&method=cash&note=Auto");

  await page.goto(`/signup?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Name").fill("Asha Rao");
  await page.getByLabel("Email").fill(uniqueEmail("qa"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // Lands on the confirm screen with everything pre-filled; the query is then dropped.
  await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();
  await expect(page).toHaveURL(/\/quick-add$/);
  const main = quickAddMain(page);
  await expect(main).toContainText("₹250");
  await expect(main).toContainText("Transport");
  await expect(main).toContainText("Cash");
  await expect(main).toContainText("Auto");

  // Edit the category from confirm; a reload keeps the draft and the edit context.
  await page.getByRole("button", { name: /^Category/ }).click();
  await page.reload();
  await tile(page, "Fuel").click();
  await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();
  await expect(main).toContainText("Fuel");

  // Partial link: amount only → starts at the category step.
  await page.goto("/quick-add?amount=-99.999");
  await expect(page.getByRole("heading", { name: "Category" })).toBeVisible();
  await expect(main).toContainText("₹99.99");
});

test("quick add: a double tap saves exactly one expense", async ({ page }) => {
  await signUp(page);
  await page.goto("/quick-add");
  await page.getByLabel("Amount").fill("333");
  await page.keyboard.press("Enter");
  await tile(page, "Food").click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /^UPI/ }).click();
  await page.getByRole("button", { name: "Add expense" }).dblclick();
  await expect(page.getByRole("heading", { name: "Added", exact: true })).toBeVisible();
  await page.goto("/expenses");
  await expect(page.getByText(/^1 expense · ₹333/)).toBeVisible();
});

test("quick add: validation and offline save", async ({ page, context }) => {
  await signUp(page);
  await setCategoryBudget(page, { Food: "1000" });
  await page.goto("/quick-add");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#amount-error")).toHaveText("Enter an amount");
  await page.getByLabel("Amount").fill("0");
  await page.keyboard.press("Enter");
  await expect(page.locator("#amount-error")).toHaveText("Enter an amount greater than zero");
  await page.getByLabel("Amount").fill("-12a.505");
  await expect(page.getByLabel("Amount")).toHaveValue("12.50");

  await page.keyboard.press("Enter");
  await tile(page, "Food").click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /^UPI/ }).click();
  await context.setOffline(true);
  await expect(page.getByText(/Offline — it'll be saved on this iPhone/)).toBeVisible();
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("heading", { name: "Added", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Saved on this device/)).toBeVisible();
  // Budget comes from this device's cache, including the pending expense.
  await expect(quickAddMain(page)).toContainText("₹987.50 remaining");
  await expect(quickAddMain(page)).toContainText("may not include changes made elsewhere");
  await context.setOffline(false);
});

test("quick add: settings toggles", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
  const section = page.getByRole("region", { name: "Quick Add" });
  await section.getByText("Launch with Back Tap or Shortcuts").click();
  await expect(section.getByText(/\/quick-add$/)).toBeVisible();
  const askNote = section.getByRole("switch", { name: /Ask for a note/ });
  await expect(askNote).toBeChecked();
  await section.getByText("Ask for a note").click();
  await expect(askNote).not.toBeChecked();
  await section.getByRole("link", { name: "Open Quick Add" }).click();
  await expect(page).toHaveURL(/\/quick-add$/);
  await page.getByLabel("Amount", { exact: true }).fill("5");
  await page.keyboard.press("Enter");
  await tile(page, "Food").click();
  await expect(page.getByRole("heading", { name: "Paid with" })).toBeVisible();
});

test("quick add: 'open the app into Quick Add' applies to launches of the installed app", async ({ page, context }) => {
  await signUp(page);
  await page.goto("/settings");
  await page.locator("label[for=qa-launch]").click();
  await expect(page.getByRole("switch", { name: /Open the app into Quick Add/ })).toBeChecked();

  // A fresh launch of the Home Screen app (iOS sets navigator.standalone).
  await context.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
  const app = await context.newPage();
  await app.goto("/dashboard");
  await expect(app).toHaveURL(/\/quick-add$/);
  await expect(app.getByLabel("Amount")).toBeVisible();
  // Leaving Quick Add goes to the dashboard and stays there for the rest of the launch.
  await app.getByRole("button", { name: "Cancel" }).click();
  await expect(app).toHaveURL(/\/dashboard$/);
  await app.waitForTimeout(500);
  await expect(app).toHaveURL(/\/dashboard$/);

  // A webapp:// link while the app is still in memory reloads the start page in the same
  // session (sessionStorage intact): that's a launch too.
  await app.reload();
  await expect(app).toHaveURL(/\/quick-add$/);

  // The browser tab (not standalone) is unaffected.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("quick add: budget is computed from stored expenses (edits, deletions, category changes)", async ({ page }) => {
  await signUp(page);
  await setCategoryBudget(page, { Food: "2000" });
  await addExpense(page, { amount: "500", category: "Food", note: "Moved later" });
  await addExpense(page, { amount: "700", category: "Food", note: "Deleted later" });

  await page.goto("/expenses");
  // Category change: Food → Transport.
  await page.getByRole("button", { name: /Moved later/ }).click();
  await sheet(page, "Edit expense").getByText("Transport", { exact: true }).click();
  await sheet(page, "Edit expense").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Expense updated")).toBeVisible();
  // Deletion.
  await page.getByRole("button", { name: /Deleted later/ }).click();
  await sheet(page, "Edit expense").getByRole("button", { name: "Delete expense" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Expense deleted")).toBeVisible();

  // Only the new ₹100 counts against Food now.
  await page.goto("/quick-add");
  await quickAdd(page, { amount: "100", category: "Food", method: "UPI" });
  await expect(quickAddMain(page)).toContainText("₹1,900 remaining");
  await expect(quickAddMain(page)).toContainText("5% used · ₹100 of ₹2,000");
});

test("quick add: returning to the installed app after a while opens Quick Add (webapp:// relaunch)", async ({ page, context }) => {
  await signUp(page);
  await page.evaluate(() => localStorage.setItem("ledger:quick-add", JSON.stringify({ launchOnOpen: true })));
  await context.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
  const app = await context.newPage();
  await app.goto("/expenses");
  await expect(app.getByRole("heading", { name: "History" })).toBeVisible();
  const away = async (ms: number) =>
    app.evaluate((ms) => {
      const set = (state: string) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
        document.dispatchEvent(new Event("visibilitychange"));
      };
      set("hidden");
      // Pretend the app sat in the background for `ms`.
      const realNow = Date.now;
      Date.now = () => realNow() + ms;
      set("visible");
      Date.now = realNow;
    }, ms);

  await away(1_000); // a quick app switch doesn't redirect
  await expect(app).toHaveURL(/\/expenses$/);
  await away(60_000);
  await expect(app).toHaveURL(/\/quick-add$/);
  await expect(app.getByLabel("Amount", { exact: true })).toBeVisible();
});
