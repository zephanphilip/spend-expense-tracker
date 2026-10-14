"use client";

import { useEffect, useState } from "react";

import { useLocalPreference } from "@/hooks/use-local-preference";
import { notificationsSupported } from "@/hooks/use-reminder-notifications";
import { toDateKey } from "@/lib/activities/dates";
import { activityRoutes } from "@/lib/activities/routes";
import { dueReminders, nextReminderDelay, reminderText } from "@/lib/activities/reminders";
import { useActivityTracker } from "@/providers/activity-provider";

// Storage keys and the notification tag keep their original "fitness" names so existing
// preferences and "already notified today" state carry over (no duplicate notifications).
export const ACTIVITY_NOTIFY_KEY = "spend:fitness-notifications";
const NOTIFIED_KEY = "spend:fitness-notified";

function readNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Device notifications for activity reminders — while Spend is open or the next time it's
 * opened/foregrounded. There's no push server, so nothing arrives while the app is fully
 * closed (the dashboard banner shows the same reminders). At most one per activity per day.
 */
export function useActivityReminderNotifications() {
  const { live, index, today, status } = useActivityTracker();
  const [enabled] = useLocalPreference<boolean>(ACTIVITY_NOTIFY_KEY, false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== "success" || !enabled || !notificationsSupported() || Notification.permission !== "granted") return;
    const now = new Date();
    const notified = readNotified();
    const due = dueReminders(live, index, now).filter((r) => notified[r.activity.id] !== today);
    if (due.length) {
      void navigator.serviceWorker.ready
        .then(async (registration) => {
          for (const { activity } of due.slice(0, 4)) {
            const { title, body } = reminderText(activity);
            const check = `${activityRoutes.home}?check=${encodeURIComponent(activity.id)}&date=${today}`;
            await registration.showNotification(title, {
              body,
              tag: `fitness-${activity.id}`,
              icon: "/icons/icon-192.png",
              badge: "/icons/icon-192.png",
              data: { url: check, completeUrl: `${check}&do=complete` },
              // Action buttons where the platform supports them (not on iOS).
              ...({ actions: [{ action: "complete", title: "Mark completed" }, { action: "open", title: "Open Activities" }] } as object),
            });
            notified[activity.id] = today;
          }
          const pruned = Object.fromEntries(Object.entries(notified).filter(([, d]) => d === toDateKey(new Date())));
          localStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
        })
        .catch(() => undefined);
    }
    // Wake up for the next reminder while the app stays open.
    const delay = nextReminderDelay(live, index, now);
    if (delay === null) return;
    const timer = setTimeout(() => setTick((t) => t + 1), Math.min(delay + 1000, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [live, index, today, status, enabled, tick]);
}
