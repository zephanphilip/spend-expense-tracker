"use client";

import { useEffect } from "react";

import { dueForNotification, type Reminder } from "@/lib/finance/reminders";

import { useLocalPreference } from "./use-local-preference";

export const NOTIFY_PREF_KEY = "ledger:notifications";
const NOTIFIED_KEY = "ledger:notified";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Shows device notifications for reminders when the app is opened or brought back — at most
 * once per reminder per day. There is no push server, so nothing arrives while the app is
 * fully closed; the in-app reminder centre always has the full list.
 */
export function useReminderNotifications(reminders: readonly Reminder[], ready: boolean) {
  const [enabled] = useLocalPreference<boolean>(NOTIFY_PREF_KEY, false);

  useEffect(() => {
    if (!ready || !enabled || !notificationsSupported() || Notification.permission !== "granted") return;
    let notified: Record<string, string> = {};
    try {
      notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
    } catch {
      notified = {};
    }
    const due = dueForNotification(reminders, notified);
    if (!due.length) return;
    void navigator.serviceWorker.ready
      .then(async (registration) => {
        const today = new Date().toISOString().slice(0, 10);
        for (const r of due.slice(0, 5)) {
          await registration.showNotification(r.title, { body: r.body, tag: r.id, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: r.href } });
          notified[r.id] = today;
        }
        // Keep the map small: drop entries older than today.
        const pruned = Object.fromEntries(Object.entries(notified).filter(([, d]) => d === today));
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
      })
      .catch(() => undefined);
  }, [reminders, ready, enabled]);
}
