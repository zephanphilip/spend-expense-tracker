import { expect, type Page, test } from "@playwright/test";
import { format, subDays } from "date-fns";

import { signUp } from "./helpers";

const key = (d: Date) => format(d, "yyyy-MM-dd");

async function openActivities(page: Page) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Activities" }).click();
  await expect(page).toHaveURL(/\/activities$/);
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
  await openActivities(page);
  await expect(page.getByText("Build a habit, one tap a day")).toBeVisible();
  await addActivity(page, "Jogging");

  const today = page.getByRole("region", { name: "Today's progress" });
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
  await expect(page.getByRole("term").filter({ hasText: /^Current streak$/ }).locator("..")).toContainText("2");

  // Detail: history has exactly two records; move yesterday's to two days ago.
  await page.getByRole("link", { name: /^Jogging/ }).first().click();
  await expect(page).toHaveURL(/\/activities\/activity\?id=/);
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

  // Analytics reflects the records (opened via the old /fitness URL, which still works).
  await page.goto("/fitness/analytics");
  await expect(page).toHaveURL(/\/activities\/analytics$/);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("region", { name: "By activity" })).toContainText("Jogging");
  await expect(page.getByRole("grid", { name: "Activity consistency calendar" })).toBeVisible();
});

test("weekday schedules only show on scheduled days; archive keeps history; delete removes it", async ({ page }) => {
  await signUp(page);
  await openActivities(page);
  await addActivity(page, "Personal project", async (sheet) => {
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
  await expect(page.getByRole("button", { name: /Mark Personal project done/ })).toBeDisabled();

  await page.getByRole("link", { name: /^Personal project/ }).first().click();
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Personal project archived")).toBeVisible();
  await expect(page.getByRole("region", { name: "About" })).toContainText("Archived");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Personal project resumed")).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL(/\/activities$/);
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
  await openActivities(page);
  await addActivity(page, "Walking", async (sheet) => {
    await sheet.getByText("Daily reminder").click();
    await sheet.getByLabel("Remind me at").fill("00:00");
  });
  expect(requested).toBe(0);

  // Reminder time has passed and it isn't done → in-app prompt.
  const banner = page.getByRole("region", { name: "Reminders" });
  await expect(banner).toContainText("Walking — done for today?");
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

test("general-purpose activities: categories, sessions, amounts, analytics, legacy links and export", async ({ page }) => {
  await signUp(page);
  await openActivities(page);

  // Templates carry a suggested category; the category stays optional and editable.
  await addActivity(page, "Solve LeetCode", async (sheet) => {
    await expect(sheet.getByRole("group", { name: "Category" }).getByRole("button", { name: "Coding" })).toHaveAttribute("aria-pressed", "true");
  });
  await addActivity(page, "Freelance work");
  await addActivity(page, "Meditation", async (sheet) => {
    await sheet.getByLabel("Activity", { exact: true }).fill("Write blog post");
    await sheet.getByRole("group", { name: "Category" }).getByRole("button", { name: "Custom…" }).click();
    await sheet.getByLabel("Custom category").fill("Writing");
  });

  // Category filter chips narrow the list.
  const filter = page.getByRole("group", { name: "Filter by category" });
  await filter.getByRole("button", { name: "Writing" }).click();
  await expect(page.getByRole("link", { name: /^Write blog post/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Solve LeetCode/ })).toHaveCount(0);
  await filter.getByRole("button", { name: "All" }).click();
  await expect(page.getByRole("link", { name: /^Solve LeetCode/ }).first()).toBeVisible();

  // A quantity (problems solved) and two timed freelance sessions on the same day.
  await page.getByRole("button", { name: "Log an activity" }).click();
  let sheet = page.getByRole("dialog", { name: "Log activity" });
  await sheet.getByRole("radiogroup", { name: "Activity" }).getByText("Solve LeetCode").click();
  await sheet.getByLabel("Problems (optional)").fill("3");
  await sheet.getByLabel("Minutes (optional)").fill("40");
  await sheet.getByRole("button", { name: "Save record" }).click();
  await expect(sheet).toBeHidden();
  for (const minutes of ["90", "30"]) {
    await page.getByRole("button", { name: "Log an activity" }).click();
    sheet = page.getByRole("dialog", { name: "Log activity" });
    await sheet.getByRole("radiogroup", { name: "Activity" }).getByText("Freelance work").click();
    await sheet.getByLabel("Minutes (optional)").fill(minutes);
    await sheet.getByRole("button", { name: "Save record" }).click();
    await expect(sheet).toBeHidden();
  }
  await expect(page.getByRole("button", { name: /Add a Freelance work session today \(2 so far\)/ })).toBeVisible();
  await expect(page.getByRole("term").filter({ hasText: /^Time invested$/ }).locator("..")).toContainText("2h 40m");

  // Analytics: time per activity and per category; the category filter.
  await page.goto("/activities/analytics");
  const time = page.getByRole("region", { name: "Time & amounts" });
  await expect(time).toContainText("Freelance work");
  await expect(time).toContainText("2h");
  await expect(time).toContainText("3 problems");
  await expect(time).toContainText("Time by category");
  await page.locator("#activity-filter").selectOption("cat:Coding");
  await expect(time).toContainText("Solve LeetCode");
  await expect(time).not.toContainText("Freelance work");

  // Old /fitness notification links keep their query through the redirect: this one checks off.
  await page.goto("/activities");
  const href = await page.getByRole("link", { name: /^Write blog post/ }).first().getAttribute("href");
  const id = new URL(href ?? "", "http://x").searchParams.get("id");
  await page.goto(`/fitness?check=${id}&do=complete`);
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.getByRole("button", { name: /Write blog post done today. Tap to undo/ })).toHaveAttribute("aria-pressed", "true");

  // Export: a recoverable copy with counts.
  await page.goto("/data");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download activity data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByRole("status").filter({ hasText: "Exported" })).toContainText("Exported 3 activities and 4 records.");
});

test("money features are untouched by the Activities tab", async ({ page }) => {
  await signUp(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("navigation", { name: "More" }).getByRole("link", { name: /^Settings/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
});
