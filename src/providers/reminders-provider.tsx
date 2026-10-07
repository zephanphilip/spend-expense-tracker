"use client";

import { createContext, type ReactNode, use } from "react";

import { useReminderNotifications } from "@/hooks/use-reminder-notifications";
import { useReminders } from "@/hooks/use-reminders";
import type { Reminder } from "@/lib/finance/reminders";

const RemindersContext = createContext<Reminder[]>([]);

/** Computes reminders once for the whole app and drives device notifications. */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const { reminders, ready } = useReminders();
  useReminderNotifications(reminders, ready);
  return <RemindersContext value={reminders}>{children}</RemindersContext>;
}

export const useReminderList = () => use(RemindersContext);
