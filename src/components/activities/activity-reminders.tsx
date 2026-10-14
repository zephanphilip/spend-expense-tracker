"use client";

import { useActivityReminderNotifications } from "@/hooks/use-activity-reminders";

/** Runs activity reminder notifications app-wide (renders nothing). */
export function ActivityReminders() {
  useActivityReminderNotifications();
  return null;
}
