import { expect, test } from "@playwright/test";

import { sheet, signUp } from "./helpers";

test("keyboard-first add on desktop", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("complementary").getByRole("button", { name: /Add expense/ })).toBeVisible();

  await page.keyboard.press("n");
  const s = sheet(page);
  await expect(s).toBeVisible();
  // Amount is focused immediately — start typing.
  await expect(s.getByLabel("Amount")).toBeFocused();
  await page.keyboard.type("1499");
  await s.getByText("Shopping", { exact: true }).click();
  await s.getByLabel("Note").fill("Headphones");
  await s.getByLabel("Note").press("Enter");
  await expect(s).toBeHidden();
  await expect(page.getByText("₹1,499 · Shopping added")).toBeVisible();
  await expect(page.getByRole("region", { name: /Spent in/ })).toContainText("₹1,499");
});
