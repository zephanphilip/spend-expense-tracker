import { describe, expect, it } from "vitest";

import {
  addDays,
  diffDays,
  endOfMonthKey,
  isDateKey,
  startOfWeekKey,
  toDateKey,
  weekdayOf,
} from "@/lib/activities/dates";
import { activityInsights } from "@/lib/activities/insights";
import { dueReminders, nextReminderDelay, reminderQuestion, reminderText } from "@/lib/activities/reminders";
import { activityTotals, categoriesOf, completions, formatMinutes, minutesInvested, totalsByCategory } from "@/lib/activities/totals";
import { Timestamp } from "firebase/firestore";

import { toExportValue } from "@/lib/services/activity.service";
import { fitnessActivityConverter, fitnessLogConverter } from "@/lib/services/converters";
import {
  currentSchedule,
  describeSchedule,
  isScheduledOn,
  ruleOn,
  withScheduleFrom,
  withStartDate,
} from "@/lib/activities/schedule";
import {
  activityStreak,
  activeDays,
  dailyCompletion,
  dayPlan,
  dayStatus,
  heatmap,
  indexLogs,
  overallStreak,
  periodSummary,
  planProgress,
  scheduledCompletion,
} from "@/lib/activities/stats";
import type { TrackedActivity, ActivityLog, ScheduleInput } from "@/types/activities";

const DAILY: ScheduleInput = { kind: "daily", days: [], perWeek: null, every: null };
const MWF: ScheduleInput = { kind: "weekdays", days: [1, 3, 5], perWeek: null, every: null };
const THRICE: ScheduleInput = { kind: "perWeek", days: [], perWeek: 3, every: null };

function activity(patch: Partial<TrackedActivity> & { schedule?: ScheduleInput } = {}): TrackedActivity {
  const { schedule = DAILY, ...rest } = patch;
  const startDate = rest.startDate ?? "2026-09-01";
  return {
    id: "a1",
    name: "Jogging",
    description: "",
    category: null,
    icon: "run",
    color: "orange",
    startDate,
    endDate: null,
    schedules: [{ from: startDate, ...schedule }],
    reminderEnabled: false,
    reminderTime: null,
    targetDuration: null,
    targetQuantity: null,
    unit: null,
    multipleEntries: false,
    status: "active",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...rest,
  };
}

let seq = 0;
function log(date: string, patch: Partial<ActivityLog> = {}): ActivityLog {
  return { id: `l${seq++}`, activityId: "a1", date, completedAt: new Date(`${date}T07:00:00`), durationMin: null, quantity: null, note: "", createdAt: new Date(), updatedAt: new Date(), ...patch };
}

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

// 2026-10-05 is a Monday.
describe("activity dates", () => {
  it("does calendar arithmetic on day keys", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(diffDays("2026-10-01", "2026-11-01")).toBe(31);
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(startOfWeekKey("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeekKey("2026-10-05")).toBe("2026-10-05");
    expect(endOfMonthKey("2026-02-10")).toBe("2026-02-28");
  });

  it("validates keys strictly", () => {
    expect(isDateKey("2026-10-05")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-1-5")).toBe(false);
    expect(isDateKey(20261005)).toBe(false);
  });

  it("uses the local calendar day at the date boundary", () => {
    // TZ is pinned to Asia/Kolkata (UTC+5:30) in vitest.config.
    expect(toDateKey(new Date("2026-10-05T23:59:00+05:30"))).toBe("2026-10-05");
    expect(toDateKey(new Date("2026-10-05T00:01:00+05:30"))).toBe("2026-10-05");
    // 18:45 UTC on the 5th is already the 6th locally.
    expect(toDateKey(new Date("2026-10-05T18:45:00Z"))).toBe("2026-10-06");
  });

  it("is immune to daylight-saving transitions (key arithmetic runs in UTC)", () => {
    // US DST ends 2026-11-01; Europe on 2026-10-25 — a day is still one day.
    expect(eachLen("2026-10-24", "2026-10-26")).toBe(3);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

function eachLen(a: string, b: string) {
  return diffDays(a, b) + 1;
}

describe("schedules", () => {
  it("knows which days are scheduled", () => {
    const gym = activity({ schedule: MWF });
    expect(isScheduledOn(gym, "2026-10-05")).toBe(true); // Mon
    expect(isScheduledOn(gym, "2026-10-06")).toBe(false); // Tue
    expect(isScheduledOn(gym, "2026-10-09")).toBe(true); // Fri
    const everyThird = activity({ schedule: { kind: "interval", days: [], perWeek: null, every: 3 }, startDate: "2026-10-01" });
    expect(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d) => isScheduledOn(everyThird, d))).toEqual([true, false, false, true]);
  });

  it("respects start and end dates", () => {
    const a = activity({ startDate: "2026-10-05", endDate: "2026-10-07" });
    expect(isScheduledOn(a, "2026-10-04")).toBe(false);
    expect(isScheduledOn(a, "2026-10-07")).toBe(true);
    expect(isScheduledOn(a, "2026-10-08")).toBe(false);
  });

  it("changing the frequency keeps the old schedule for past days", () => {
    const a = activity({ startDate: "2026-09-01" });
    const schedules = withScheduleFrom(a.schedules, MWF, "2026-10-01", a.startDate);
    const changed = { ...a, schedules };
    expect(isScheduledOn(changed, "2026-09-29")).toBe(true); // Tue, still daily then
    expect(isScheduledOn(changed, "2026-10-06")).toBe(false); // Tue, MWF now
    expect(currentSchedule(changed).kind).toBe("weekdays");
    expect(describeSchedule(currentSchedule(changed))).toBe("Mon, Wed, Fri");
    // Re-applying the same schedule doesn't add a version.
    expect(withScheduleFrom(schedules, MWF, "2026-10-05", a.startDate)).toHaveLength(2);
    // Editing again on the same day replaces that day's version.
    expect(withScheduleFrom(schedules, THRICE, "2026-10-01", a.startDate)).toHaveLength(2);
  });

  it("pausing appends a 'none' version and resuming restores the schedule", () => {
    const a = activity({ schedule: MWF });
    const paused = withScheduleFrom(a.schedules, { kind: "none", days: [], perWeek: null, every: null }, "2026-10-06", a.startDate);
    expect(ruleOn({ ...a, schedules: paused }, "2026-10-07")?.kind).toBe("none");
    expect(currentSchedule({ schedules: paused }).kind).toBe("weekdays");
    const resumed = withScheduleFrom(paused, MWF, "2026-10-12", a.startDate);
    expect(isScheduledOn({ ...a, schedules: resumed }, "2026-10-09")).toBe(false);
    expect(isScheduledOn({ ...a, schedules: resumed }, "2026-10-12")).toBe(true);
  });

  it("re-anchors versions when the start date moves", () => {
    const schedules = withStartDate([{ from: "2026-09-01", ...DAILY }, { from: "2026-10-01", ...MWF }], "2026-08-01");
    expect(schedules[0].from).toBe("2026-08-01");
    expect(schedules).toHaveLength(2);
  });
});

describe("streaks", () => {
  const today = "2026-10-11"; // Sunday

  it("counts consecutive scheduled days and doesn't break on a pending today", () => {
    const a = activity({ startDate: "2026-10-01" });
    const index = indexLogs(days("2026-10-06", 5).map((d) => log(d))); // Tue..Sat
    expect(activityStreak(a, index, today)).toMatchObject({ current: 5, unit: "day" });
    const withToday = indexLogs([...days("2026-10-06", 6).map((d) => log(d))]);
    expect(activityStreak(a, withToday, today).current).toBe(6);
  });

  it("a missed day resets the current streak but keeps the best", () => {
    const a = activity({ startDate: "2026-10-01" });
    const index = indexLogs(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-06", "2026-10-10"].map((d) => log(d)));
    expect(activityStreak(a, index, today)).toEqual({ current: 1, best: 4, unit: "day" });
  });

  it("Mon/Wed/Fri streaks ignore unscheduled days", () => {
    const gym = activity({ schedule: MWF, startDate: "2026-09-28" });
    const index = indexLogs(["2026-09-28", "2026-09-30", "2026-10-02", "2026-10-05", "2026-10-07", "2026-10-09"].map((d) => log(d)));
    expect(activityStreak(gym, index, today)).toEqual({ current: 6, best: 6, unit: "day" });
    // Missing Wednesday breaks it.
    const missed = indexLogs(["2026-09-28", "2026-09-30", "2026-10-02", "2026-10-05", "2026-10-09"].map((d) => log(d)));
    expect(activityStreak(gym, missed, today).current).toBe(1);
  });

  it("extra sessions on rest days don't extend or break a streak", () => {
    const gym = activity({ schedule: MWF, startDate: "2026-10-05" });
    const index = indexLogs(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09"].map((d) => log(d)));
    expect(activityStreak(gym, index, today).current).toBe(3);
    expect(dayStatus(gym, "2026-10-06", index, today)).toBe("extra");
  });

  it("times-a-week streaks count weeks that met the target", () => {
    const a = activity({ schedule: THRICE, startDate: "2026-09-21" });
    const index = indexLogs(["2026-09-21", "2026-09-23", "2026-09-25", "2026-09-28", "2026-09-29", "2026-10-01", "2026-10-06"].map((d) => log(d)));
    // Weeks of 21 Sep and 28 Sep met; week of 5 Oct had 1 of 3 and is over? No — today is
    // Sunday 11 Oct, so that week is still pending: streak stays at 2.
    expect(activityStreak(a, index, today)).toMatchObject({ current: 2, best: 2, unit: "week" });
    expect(activityStreak(a, index, "2026-10-12").current).toBe(0);
  });

  it("historical edits change the streak", () => {
    const a = activity({ startDate: "2026-10-08" });
    const logs = ["2026-10-08", "2026-10-10"].map((d) => log(d));
    expect(activityStreak(a, indexLogs(logs), today).current).toBe(1);
    // Add the missing Friday afterwards.
    expect(activityStreak(a, indexLogs([...logs, log("2026-10-09")]), today).current).toBe(3);
    // Delete Saturday's record.
    expect(activityStreak(a, indexLogs([logs[0], log("2026-10-09")]), today).current).toBe(0);
  });

  it("overall streak counts days with any activity", () => {
    const set = new Set(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-01", "2026-10-02"]);
    expect(overallStreak(set, today)).toEqual({ current: 4, best: 4 });
    expect(overallStreak(new Set([...set, today]), today).current).toBe(5);
    expect(overallStreak(new Set(["2026-10-09"]), today).current).toBe(0);
  });
});

describe("completion rates", () => {
  const today = "2026-10-11";

  it("is completed ÷ scheduled, excluding unscheduled days, pre-start days and a pending today", () => {
    const gym = activity({ schedule: MWF, startDate: "2026-10-05" });
    const index = indexLogs(["2026-10-05", "2026-10-09"].map((d) => log(d)));
    expect(scheduledCompletion(gym, index, "2026-10-01", "2026-10-31", today)).toEqual({ scheduled: 3, completed: 2, rate: 2 / 3 });
    const daily = activity({ startDate: "2026-10-09" });
    // 9th done, 10th missed, 11th (today) pending → 1 of 2.
    expect(scheduledCompletion(daily, indexLogs([log("2026-10-09")]), "2026-10-01", "2026-10-31", today)).toEqual({ scheduled: 2, completed: 1, rate: 0.5 });
    // Completing today adds to both.
    expect(scheduledCompletion(daily, indexLogs([log("2026-10-09"), log(today)]), "2026-10-01", "2026-10-31", today).rate).toBeCloseTo(2 / 3);
  });

  it("counts a day once however many sessions it has", () => {
    const a = activity({ startDate: "2026-10-10", multipleEntries: true });
    const index = indexLogs([log("2026-10-10", { durationMin: 20 }), log("2026-10-10", { durationMin: 15 })]);
    expect(scheduledCompletion(a, index, "2026-10-10", "2026-10-10", today)).toEqual({ scheduled: 1, completed: 1, rate: 1 });
    expect(periodSummary([a], index, "2026-10-10", "2026-10-10", today)).toMatchObject({ sessions: 2, duration: 35 });
  });

  it("works without duration or quantity", () => {
    const a = activity({ startDate: "2026-10-10" });
    expect(periodSummary([a], indexLogs([log("2026-10-10")]), "2026-10-10", today, today)).toMatchObject({ completed: 1, duration: 0, quantity: 0, activeDays: 1 });
  });

  it("times-a-week: finished weeks count the full target, the current week only what's done", () => {
    const a = activity({ schedule: THRICE, startDate: "2026-09-28" });
    const index = indexLogs(["2026-09-28", "2026-09-30", "2026-10-06"].map((d) => log(d)));
    // Week 28 Sep: 2 of 3 (finished). Week 5 Oct: pending, 1 done.
    expect(scheduledCompletion(a, index, "2026-09-28", today, today)).toEqual({ scheduled: 4, completed: 3, rate: 0.75 });
  });

  it("future dates never count", () => {
    const a = activity({ startDate: "2026-10-01" });
    expect(scheduledCompletion(a, indexLogs([]), "2026-10-12", "2026-10-31", today).scheduled).toBe(0);
  });

  it("daily completion points and the heatmap agree", () => {
    const a = activity({ startDate: "2026-10-05", schedule: MWF });
    const b = activity({ id: "b", startDate: "2026-10-05" });
    const index = indexLogs([log("2026-10-05"), log("2026-10-05", { activityId: "b" }), log("2026-10-06", { activityId: "b" }), log("2026-10-07")]);
    const points = dailyCompletion([a, b], index, "2026-10-05", "2026-10-07", today);
    expect(points.map((p) => [p.completed, p.scheduled])).toEqual([[2, 2], [1, 1], [1, 2]]);
    const grid = heatmap([a, b], index, "2026-10-05", "2026-10-11", today);
    expect(grid[0].slice(0, 3).map((c) => c.level)).toEqual([4, 4, 2]);
    const single = heatmap([a], index, "2026-10-05", "2026-10-11", today, a);
    expect(single[0].slice(0, 3).map((c) => c.status)).toEqual(["done", "rest", "done"]);
  });
});

describe("today's plan", () => {
  const today = "2026-10-11";
  it("lists only what's due on the date", () => {
    const jog = activity({ id: "jog", startDate: "2026-10-01" });
    const gym = activity({ id: "gym", schedule: MWF, startDate: "2026-10-01" });
    const weekend = activity({ id: "walk", schedule: { kind: "weekdays", days: [0, 6], perWeek: null, every: null }, startDate: "2026-10-01" });
    const index = indexLogs([log(today, { activityId: "walk" })]);
    const plan = dayPlan([jog, gym, weekend], index, today, today);
    expect(plan.map((p) => [p.activity.id, p.done])).toEqual([["jog", false], ["walk", true]]);
    expect(planProgress(plan)).toEqual({ total: 2, completed: 1, rate: 0.5 });
  });

  it("hides a times-a-week activity once the week's target is met (except where it was done)", () => {
    const a = activity({ schedule: { kind: "perWeek", days: [], perWeek: 2, every: null }, startDate: "2026-09-01" });
    const index = indexLogs([log("2026-10-06"), log("2026-10-08")]);
    expect(dayPlan([a], index, today, today)).toHaveLength(0);
    expect(dayPlan([a], index, "2026-10-08", today)[0]).toMatchObject({ kind: "flexible", done: true, week: { done: 2, target: 2 } });
    expect(dayPlan([a], indexLogs([log("2026-10-06")]), today, today)[0]).toMatchObject({ done: false, week: { done: 1, target: 2 } });
  });

  it("shows a rest-day session as extra without counting it as due", () => {
    const gym = activity({ schedule: MWF });
    const plan = dayPlan([gym], indexLogs([log("2026-10-06")]), "2026-10-06", today);
    expect(plan[0].kind).toBe("extra");
    expect(planProgress(plan).total).toBe(0);
  });
});

describe("reminders", () => {
  const at = (time: string) => new Date(`2026-10-11T${time}:00`);
  const jog = activity({ id: "jog", reminderEnabled: true, reminderTime: "07:00", startDate: "2026-10-01" });
  const gym = activity({ id: "gym", schedule: MWF, reminderEnabled: true, reminderTime: "06:00", startDate: "2026-10-01" });
  const off = activity({ id: "off", reminderEnabled: false, reminderTime: "06:00", startDate: "2026-10-01" });
  const paused = activity({ id: "p", status: "paused", reminderEnabled: true, reminderTime: "06:00", startDate: "2026-10-01" });

  it("fires only for activities due today, enabled, not done, after their time", () => {
    expect(dueReminders([jog, gym, off, paused], indexLogs([]), at("06:30"))).toHaveLength(0);
    expect(dueReminders([jog, gym, off, paused], indexLogs([]), at("07:00")).map((r) => r.activity.id)).toEqual(["jog"]);
    expect(dueReminders([jog], indexLogs([log("2026-10-11", { activityId: "jog" })]), at("08:00"))).toHaveLength(0);
  });

  it("knows when the next one is due", () => {
    expect(nextReminderDelay([jog], indexLogs([]), at("06:30"))).toBe(30 * 60_000);
    expect(nextReminderDelay([jog], indexLogs([]), at("07:30"))).toBeNull();
  });
});

describe("insights", () => {
  it("are derived from stored records", () => {
    const today = "2026-10-11";
    const jog = activity({ id: "jog", name: "Jogging", startDate: "2026-09-12" });
    const walk = activity({ id: "walk", name: "Walking", startDate: "2026-09-12" });
    const logs = [
      ...days("2026-10-05", 6).map((d) => log(d, { activityId: "jog" })),
      ...days("2026-09-12", 30).filter((_, i) => i % 3 === 0).map((d) => log(d, { activityId: "walk" })),
    ];
    const texts = activityInsights([jog, walk], indexLogs(logs), today).map((i) => i.text);
    expect(texts[0]).toBe("You completed Jogging on 6 days this week.");
    expect(texts.some((t) => t.startsWith("Your most consistent activity is Walking"))).toBe(true);
    expect(activityInsights([], indexLogs([]), today)).toEqual([]);
    expect(activeDays(indexLogs(logs)).size).toBeGreaterThan(6);
  });
});

describe("general-purpose activities: totals keep measures separate", () => {
  // Wed 14 Oct 2026; the week started Mon 12 Oct.
  const today = "2026-10-14";
  const leet = activity({ id: "leet", name: "Solve LeetCode", category: "Coding", unit: "problems", targetQuantity: 2 });
  const csharp = activity({ id: "cs", name: "Study C#", category: "Learning", targetDuration: 45 });
  const freelance = activity({ id: "fl", name: "Freelance work", category: "Freelance", multipleEntries: true });
  const jog = activity({ id: "jog", name: "Jogging" }); // a pre-existing activity: no category
  const logs = [
    log("2026-10-12", { activityId: "leet", quantity: 3 }),
    log("2026-10-13", { activityId: "leet", quantity: 2, durationMin: 40 }),
    log("2026-10-12", { activityId: "cs", durationMin: 45 }),
    log("2026-10-13", { activityId: "cs", durationMin: 60 }),
    log("2026-10-13", { activityId: "fl", durationMin: 90 }),
    log("2026-10-13", { activityId: "fl", durationMin: 30 }), // second session, same day
    log("2026-10-14", { activityId: "jog" }), // old-style check-in: no duration, no quantity
    log("2026-10-01", { activityId: "cs", durationMin: 999 }), // before the week
  ];
  const index = indexLogs(logs);

  it("counts sessions, days done, minutes and quantity per activity without inventing values", () => {
    expect(activityTotals(index, "leet", "2026-10-12", today, today)).toEqual({ sessions: 2, daysDone: 2, minutes: 40, quantity: 5 });
    expect(activityTotals(index, "fl", "2026-10-12", today, today)).toEqual({ sessions: 2, daysDone: 1, minutes: 120, quantity: 0 });
    // A check-in without details adds a completion but no time or amount.
    expect(activityTotals(index, "jog", "2026-10-12", today, today)).toEqual({ sessions: 1, daysDone: 1, minutes: 0, quantity: 0 });
  });

  it("completions count each activity once per day; time adds recorded minutes only", () => {
    const all = [leet, csharp, freelance, jog];
    expect(completions(all, index, "2026-10-12", today, today)).toBe(2 + 2 + 1 + 1);
    expect(minutesInvested(all, index, "2026-10-12", today, today)).toBe(40 + 105 + 120);
  });

  it("groups time by category, with uncategorised (older) activities kept separately", () => {
    const rows = totalsByCategory([leet, csharp, freelance, jog], index, "2026-10-12", today, today);
    expect(rows.map((r) => [r.category, r.minutes])).toEqual([
      ["Freelance", 120],
      ["Learning", 105],
      ["Coding", 40],
      [null, 0],
    ]);
    expect(categoriesOf([leet, csharp, jog, activity({ id: "x", category: "Coding" })])).toEqual(["Coding", "Learning"]);
  });

  it("formats durations", () => {
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(60), formatMinutes(510)]).toEqual(["0m", "45m", "1h", "8h 30m"]);
  });

  it("insights state time, amounts in their unit, and scheduled days — only from real data", () => {
    const texts = activityInsights([leet, csharp, freelance, jog], index, today).map((i) => i.text);
    expect(texts).toContain("You spent 2h on Freelance work this week (2 sessions).");
    expect(texts).toContain("You logged 5 problems for Solve LeetCode this month.");
    expect(texts.some((t) => /was completed on \d+ of \d+ scheduled days this week/.test(t))).toBe(true);
    // Nothing recorded → no time or amount insight.
    expect(activityInsights([jog], indexLogs([log("2026-10-14", { activityId: "jog" })]), today).some((i) => /spent|logged \d/.test(i.text))).toBe(false);
  });

  it("reminder copy uses the name exactly as typed", () => {
    expect(reminderQuestion({ name: "Study C#" })).toBe("Study C# — done for today?");
    expect(reminderText({ name: "Solve LeetCode" })).toEqual({ title: "Solve LeetCode", body: "Time for Solve LeetCode. Done for today? Tap to check it off." });
  });
});

describe("existing (Fitness-era) records read unchanged", () => {
  // A snapshot as Firestore returns it for a document written before categories existed.
  const snapshot = (id: string, data: Record<string, unknown>) =>
    ({ id, data: () => data }) as unknown as Parameters<typeof fitnessActivityConverter.fromFirestore>[0];

  it("an old activity keeps every field and reads with no category", () => {
    const a = fitnessActivityConverter.fromFirestore(
      snapshot("jogId123", {
        name: "Jogging",
        description: "Around the park",
        icon: "run",
        color: "orange",
        startDate: "2026-09-01",
        endDate: null,
        schedules: [
          { from: "2026-09-01", kind: "daily", days: [], perWeek: null, every: null },
          { from: "2026-10-05", kind: "weekdays", days: [1, 3, 5], perWeek: null, every: null },
        ],
        reminderEnabled: true,
        reminderTime: "07:00",
        targetDuration: 20,
        targetQuantity: null,
        unit: null,
        multipleEntries: false,
        status: "paused",
      }),
    );
    expect(a).toMatchObject({
      id: "jogId123",
      name: "Jogging",
      description: "Around the park",
      category: null,
      icon: "run",
      color: "orange",
      startDate: "2026-09-01",
      reminderEnabled: true,
      reminderTime: "07:00",
      targetDuration: 20,
      status: "paused",
    });
    expect(a.schedules).toHaveLength(2);
    expect(a.schedules[1]).toEqual({ from: "2026-10-05", kind: "weekdays", days: [1, 3, 5], perWeek: null, every: null });
  });

  it("a new activity's category is read back", () => {
    expect(fitnessActivityConverter.fromFirestore(snapshot("x", { name: "Study C#", icon: "study", color: "violet", startDate: "2026-10-01", category: "Learning" })).category).toBe("Learning");
  });

  it("old logs keep id, day, time, duration, quantity and note", () => {
    const l = fitnessLogConverter.fromFirestore(
      snapshot("jogId123_2026-10-09", { activityId: "jogId123", date: "2026-10-09", durationMin: 25, quantity: null, note: "Park loop" }),
    );
    expect(l).toMatchObject({ id: "jogId123_2026-10-09", activityId: "jogId123", date: "2026-10-09", durationMin: 25, quantity: null, note: "Park loop" });
  });
});

describe("activity export", () => {
  it("keeps raw fields and turns timestamps into ISO strings", () => {
    const at = new Date("2026-10-09T01:35:00.000Z");
    expect(toExportValue({ date: "2026-10-09", completedAt: Timestamp.fromDate(at), durationMin: 25, quantity: null, note: "Park loop", schedules: [{ from: "2026-09-01", days: [1, 3] }] })).toEqual({
      date: "2026-10-09",
      completedAt: "2026-10-09T01:35:00.000Z",
      durationMin: 25,
      quantity: null,
      note: "Park loop",
      schedules: [{ from: "2026-09-01", days: [1, 3] }],
    });
  });
});
