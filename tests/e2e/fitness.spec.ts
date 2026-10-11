import { expect, type Page, test } from "@playwright/test";
import { format, subDays } from "date-fns";

import { signUp } from "./helpers";

const key = (d: Date) => format(d, "yyyy-MM-dd");

async function openFitness(page: Page) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Fitness" }).click();
  await expect(page).toHaveURL(/\/fitness$/);
}

async function addActivity(page: Page, template: string, configure?: (sheet: ReturnType<Page["getByRole"]>) => Promise<void>) {
  const first = page.getByRole("button", { name: "Add your first activity" });
  if (await first.isVisible()) await first.click();
  else await page.getByRole("button", { name: /^Activity$/ }).click();
  const sheet = page.getByRole("dialog", { name: "New activity" });
  await sheet.getByRole("button", { name: template, exact: true }).click();
  if (configure) await configure(sheet);
  await sheet.getByRole("button", { name: "Add activity" }).click();
  await expect(sheet).toBeHidden();
}

test("create, complete, undo and correct records", async ({ page }) => {
  await signUp(page);
  await openFitness(page);
  await expect(page.getByText("Build a habit, one tap a day")).toBeVisible();
  await addActivity(page, "Jogging");

  const today = page.getByRole("region", { name: "Your activity today" });
  await expect(today).toContainText("0 of 1 completed");

  // One tap completes; a fast double tap must not create a second record.
  await page.getByRole("button", { name: "Mark Jogging done today" }).dblclick();
  await expect(today).toContainText("All done today");
  await expect(page.getByRole("button", { name: /Jogging done today. Tap to undo/ })).toHaveAttribute("aria-pressed", "true");

  // Undo.
  await page.getByRole("button", { name: /Jogging done today. Tap to undo/ }).click();
  await expect(today).toContainText("0 of 1 completed");
  await page.getByRole("button", { name: "Mark Jogging done today" }).click();
  await expect(today).toContainText("All done today");

  // Log yesterday (before the activity's start date — the start moves back).
  const yesterday = key(subDays(new Date(), 1));
  await page.getByRole("button", { name: "Log an activity" }).click();
  let sheet = page.getByRole("dialog", { name: "Log activity" });
  await sheet.getByLabel("Day").fill(yesterday);
  await sheet.getByLabel("Minutes (optional)").fill("25");
  await sheet.getByLabel("Note (optional)").fill("Park loop");
  await sheet.getByRole("button", { name: "Save record" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("region", { name: "Recent" })).toContainText("25 min · Park loop");

  // A second record for the same day is refused.
  await page.getByRole("button", { name: "Log an activity" }).click();
  sheet = page.getByRole("dialog", { name: "Log activity" });
  await sheet.getByLabel("Day").fill(yesterday);
  await sheet.getByRole("button", { name: "Save record" }).click();
  await expect(sheet.getByRole("alert")).toContainText("already checked off");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Streak: yesterday + today.
  await expect(page.getByRole("term").filter({ hasText: "Streak" }).locator("..")).toContainText("2");

  // Detail: history has exactly two records; move yesterday's to two days ago.
  await page.getByRole("link", { name: /^Jogging/ }).first().click();
  await expect(page).toHaveURL(/\/fitness\/activity\?id=/);
  const history = page.getByRole("region", { name: "History" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history.getByRole("button", { name: /Park loop/ }).click();
  sheet = page.getByRole("dialog", { name: "Edit Jogging" });
  await sheet.getByLabel("Day").fill(key(subDays(new Date(), 2)));
  await sheet.getByLabel("Time").fill("06:15");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(history).toContainText(format(subDays(new Date(), 2), "EEE d MMM yyyy"));
  await expect(history).toContainText("6:15");
  // The gap yesterday now breaks the streak: current 1.
  await expect(page.getByRole("term").filter({ hasText: "Current streak" }).locator("..")).toContainText("1");

  // Delete the corrected record.
  await history.getByRole("button", { name: /Park loop/ }).click();
  sheet = page.getByRole("dialog", { name: "Edit Jogging" });
  await sheet.getByRole("button", { name: "Delete record" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(1);

  // Analytics reflects the records.
  await page.goto("/fitness/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("region", { name: "By activity" })).toContainText("Jogging");
  await expect(page.getByRole("grid", { name: "Activity consistency calendar" })).toBeVisible();
});

test("weekday schedules only show on scheduled days; archive keeps history; delete removes it", async ({ page }) => {
  await signUp(page);
  await openFitness(page);
  await addActivity(page, "Gym", async (sheet) => {
    await sheet.getByText("Set days").click();
    // Default is Mon/Wed/Fri.
    await expect(sheet.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "false");
  });
  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: /^Tuesday/ }).click();
  await expect(page.getByText("Nothing scheduled")).toBeVisible();
  await page.getByRole("button", { name: /^Monday/ }).click();
  // Scheduled, but in the future — can't be checked off yet.
  await expect(page.getByRole("button", { name: /Mark Gym done/ })).toBeDisabled();

  await page.getByRole("link", { name: /^Gym/ }).first().click();
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Gym archived")).toBeVisible();
  await expect(page.getByRole("region", { name: "About" })).toContainText("Archived");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Gym resumed")).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(page.getByText("Build a habit, one tap a day")).toBeVisible();
});

test("reminders: in-app banner when due, permission is only requested on opt-in", async ({ page }) => {
  await signUp(page);
  let requested = 0;
  await page.exposeFunction("__permissionRequested", () => requested++);
  await page.addInitScript(() => {
    Notification.requestPermission = () => {
      (window as unknown as { __permissionRequested: () => void }).__permissionRequested();
      return Promise.resolve("denied");
    };
  });
  await page.reload();
  await openFitness(page);
  await addActivity(page, "Walking", async (sheet) => {
    await sheet.getByText("Daily reminder").click();
    await sheet.getByLabel("Remind me at").fill("00:00");
  });
  expect(requested).toBe(0);

  // Reminder time has passed and it isn't done → in-app prompt.
  const banner = page.getByRole("region", { name: "Reminders" });
  await expect(banner).toContainText("Have you done walking today?");
  await banner.getByRole("button", { name: "Yes, done" }).click();
  await expect(banner).toBeHidden();

  // Opting into device notifications asks for permission; denial is explained.
  await page.getByRole("button", { name: "Reminders" }).click();
  const sheet = page.getByRole("dialog", { name: "Reminders" });
  await expect(sheet.getByLabel("Walking reminder time")).toHaveValue("00:00");
  await sheet.getByText("Device notifications").click();
  await expect(page.getByText(/Notifications (are blocked|aren't available here)/)).toBeVisible();
  await sheet.getByRole("button", { name: "Save reminders" }).click();
  await expect(sheet).toBeHidden();
});

test("money features are untouched by the Fitness tab", async ({ page }) => {
  await signUp(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("navigation", { name: "More" }).getByRole("link", { name: /^Settings/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
});
