import { differenceInCalendarDays, format, startOfDay } from "date-fns";

import type { BudgetProgress } from "./budget";
import type { UpcomingItem } from "./upcoming";

export const REMINDER_KINDS = ["emi", "card", "recurring", "budget"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export interface ReminderPrefs {
  enabled: Record<ReminderKind, boolean>;
  /** Remind this many days before a due date (0 = on the day). */
  leadDays: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: { emi: true, card: true, recurring: true, budget: true },
  leadDays: 3,
};

export interface Reminder {
  /** Stable per occurrence — used to notify at most once a day. */
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  urgent: boolean;
  href: string;
  date: Date | null;
}

const when = (date: Date, now: Date) => {
  const days = differenceInCalendarDays(startOfDay(date), startOfDay(now));
  if (days < 0) return `overdue since ${format(date, "d MMM")}`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due ${format(date, "EEE d MMM")} (in ${days} days)`;
};

/**
 * Reminders from upcoming items (EMIs, card bills, recurring payments) within the lead time
 * and budget warnings (≥ 80% used or over). Pure and deterministic, so the same inputs always
 * produce the same reminders — suitable for de-duplicated notifications.
 */
export function buildReminders({
  upcoming,
  budget,
  prefs,
  now = new Date(),
  format: fmt,
}: {
  upcoming: readonly UpcomingItem[];
  budget: { overall: BudgetProgress | null; categories: { name: string; progress: BudgetProgress }[]; month: string } | null;
  prefs: ReminderPrefs;
  now?: Date;
  format: (minor: number) => string;
}): Reminder[] {
  const out: Reminder[] = [];
  for (const item of upcoming) {
    const days = differenceInCalendarDays(startOfDay(item.date), startOfDay(now));
    if (days > prefs.leadDays) continue;
    if (item.kind === "emi" && prefs.enabled.emi) {
      out.push({
        id: `emi:${item.emi.id}:${item.emi.paidCount + 1}`,
        kind: "emi",
        title: `${item.emi.name} EMI ${when(item.date, now)}`,
        body: `${fmt(item.amount)} · installment ${item.emi.paidCount + 1} of ${item.emi.tenureMonths}`,
        urgent: item.overdue,
        href: `/emis/${item.emi.id}`,
        date: item.date,
      });
    } else if (item.kind === "card" && prefs.enabled.card) {
      out.push({
        id: `card:${item.card.id}:${format(item.date, "yyyy-MM-dd")}`,
        kind: "card",
        title: `${item.card.name} bill ${when(item.date, now)}`,
        body: `${fmt(item.amount)} statement${item.minimumDue ? ` · minimum ${fmt(item.minimumDue)}` : ""}`,
        urgent: item.overdue,
        href: `/accounts/${item.card.id}`,
        date: item.date,
      });
    } else if (item.kind === "recurring" && prefs.enabled.recurring && item.cycle === item.payment.cycle) {
      out.push({
        id: `rp:${item.payment.id}:${item.cycle}`,
        kind: "recurring",
        title: `${item.payment.name} ${when(item.date, now)}`,
        body: `${fmt(item.amount)}${item.payment.autoPay ? " · will be recorded automatically" : ""}`,
        urgent: item.overdue && !item.payment.autoPay,
        href: "/recurring",
        date: item.date,
      });
    }
  }

  if (budget && prefs.enabled.budget) {
    const { overall, categories, month } = budget;
    if (overall && overall.state !== "ok") {
      out.push({
        id: `budget:${month}:overall:${overall.state}`,
        kind: "budget",
        title: overall.state === "over" ? "Over your monthly budget" : `${overall.percent}% of your monthly budget used`,
        body: `${fmt(overall.spent)} of ${fmt(overall.limit)}`,
        urgent: overall.state === "over",
        href: "/budgets",
        date: null,
      });
    }
    for (const c of categories) {
      if (c.progress.state === "ok") continue;
      out.push({
        id: `budget:${month}:${c.name}:${c.progress.state}`,
        kind: "budget",
        title: c.progress.state === "over" ? `${c.name} is over budget` : `${c.name} at ${c.progress.percent}% of budget`,
        body: `${fmt(c.progress.spent)} of ${fmt(c.progress.limit)}`,
        urgent: c.progress.state === "over",
        href: "/budgets",
        date: null,
      });
    }
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
}

/** Which reminders haven't been shown as a notification today (one per reminder per day). */
export function dueForNotification(reminders: readonly Reminder[], notified: Record<string, string>, now: Date = new Date()): Reminder[] {
  const today = format(now, "yyyy-MM-dd");
  return reminders.filter((r) => notified[r.id] !== today);
}
