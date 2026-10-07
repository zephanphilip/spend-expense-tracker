import { expect, test } from "@playwright/test";
import { format, subDays } from "date-fns";

import { signUp } from "./helpers";

const OUT = "/private/tmp/claude-501/-Users-zephanphilip-works-Expense-tracker/76e729b3-542d-45bd-b32f-dfc4c9d55d01/scratchpad/shots4";
test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

function seedCsv() {
  const cats = [["Food", 380], ["Groceries", 1400], ["Transport", 160], ["Shopping", 1800], ["Bills", 2400], ["Fun", 650], ["Health", 900]] as const;
  const methods = ["UPI", "Credit card", "Debit", "Cash"];
  const rows = ["Date,Description,Amount,Category,Mode"];
  let seed = 7;
  const r = (n: number) => ((seed = (seed * 9301 + 49297) % 233280), Math.floor((seed / 233280) * n));
  for (let d = 120; d >= 0; d--) {
    const day = subDays(new Date(), d);
    const weekend = [0, 6].includes(day.getDay());
    const n = 1 + r(weekend ? 4 : 2);
    for (let i = 0; i < n; i++) {
      const [cat, base] = cats[r(cats.length)];
      const amt = Math.round(base * (0.4 + r(100) / 60) * (weekend ? 1.5 : 1));
      rows.push(`${format(day, "yyyy-MM-dd")},${cat} ${i},${amt},${cat},${methods[r(4)]}`);
    }
  }
  return rows.join("\n");
}

test("phase 4 screens", async ({ page }, info) => {
  test.setTimeout(240_000);
  const p = info.project.name;
  const shot = async (name: string) => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${p}-${name}.png`, fullPage: true });
  };
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  test.info().annotations.push({ type: "console", description: "" });
  await signUp(page);
  await page.goto("/data");
  await page.locator("#import-file").setInputFiles({ name: "history.csv", mimeType: "text/csv", buffer: Buffer.from(seedCsv()) });
  await shot("import-map");
  await page.getByRole("button", { name: "Review rows" }).click();
  await shot("import-preview");
  await page.getByRole("button", { name: /^Import \d+ rows/ }).click();
  await expect(page.getByText("Import complete")).toBeVisible({ timeout: 60_000 });
  // Income for each month.
  await page.getByRole("button", { name: "Import another file" }).click();
  await page.getByRole("radiogroup", { name: "What are you importing?" }).getByText("Income").click();
  const inc = ["Date,Amount,Type"];
  for (let m = 4; m >= 0; m--) {
    const d = new Date(); d.setMonth(d.getMonth() - m, 1);
    inc.push(`${format(d, "yyyy-MM-dd")},${85000 + m * 1000},Salary`);
  }
  await page.locator("#import-file").setInputFiles({ name: "salary.csv", mimeType: "text/csv", buffer: Buffer.from(inc.join("\n")) });
  await page.getByRole("button", { name: "Review rows" }).click();
  await page.getByRole("button", { name: /^Import \d+ rows/ }).click();
  await expect(page.getByText("Import complete")).toBeVisible();

  await page.goto("/analytics");
  await page.getByRole("button", { name: "3 months" }).click();
  await expect(page.locator("dl").first()).toBeVisible({ timeout: 30_000 });
  await shot("analytics-overview");
  for (const t of ["Spending", "Cash flow", "Wealth", "Insights"]) {
    await page.getByRole("tab", { name: new RegExp(t) }).click();
    await shot(`analytics-${t.toLowerCase().replace(" ", "")}`);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("tab", { name: "Spending" }).click();
  await shot("analytics-spending-dark");
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m, (counts.get(m) ?? 0) + 1);
  console.log("CONSOLE:\n" + [...counts].map(([m, n]) => `${n}× ${m}`).join("\n"));
});
