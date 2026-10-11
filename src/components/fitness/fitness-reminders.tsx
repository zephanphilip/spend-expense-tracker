"use client";

import { useFitnessReminderNotifications } from "@/hooks/use-fitness-reminders";

/** Runs fitness reminder notifications app-wide (renders nothing). */
export function FitnessReminders() {
  useFitnessReminderNotifications();
  return null;
}
