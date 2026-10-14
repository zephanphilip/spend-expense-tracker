"use client";

import { BellRing } from "lucide-react";

import { type DueReminder, formatTimeOfDay, reminderQuestion } from "@/lib/activities/reminders";

import { useActivityActions } from "./use-activity-actions";

/**
 * In-app reminders: always shown on the dashboard when a reminder time has passed and
 * the activity isn't done — works even where device notifications aren't available.
 */
export function ReminderBanner({ due, today }: { due: DueReminder[]; today: string }) {
  const { complete } = useActivityActions();
  if (!due.length) return null;
  return (
    <section aria-label="Reminders" className="space-y-2">
      {due.slice(0, 3).map(({ activity }) => (
        <div key={activity.id} role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3 dark:bg-amber-400/10">
          <BellRing className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{reminderQuestion(activity)}</span>
            <span className="block text-xs text-muted-foreground">Reminder for {formatTimeOfDay(activity.reminderTime)}</span>
          </p>
          <button
            type="button"
            onClick={() => void complete(activity, today)}
            className="h-9 shrink-0 rounded-xl bg-foreground px-3 text-sm font-medium text-background outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Yes, done
          </button>
        </div>
      ))}
    </section>
  );
}
