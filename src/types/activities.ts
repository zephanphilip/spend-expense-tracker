import type { CategoryColorKey } from "@/lib/constants/colors";
import type { ActivityIconKey, ActivityStatus, ScheduleKind } from "@/lib/constants/activities";
import type { DateKey } from "@/lib/activities/dates";

/**
 * One version of an activity's schedule, in effect from `from` until the next version.
 * Editing the frequency appends a version instead of rewriting the old one, so past days
 * keep being judged against the schedule that applied then. Pausing/archiving appends a
 * "none" version (nothing is due while paused).
 */
export interface ScheduleRule {
  from: DateKey;
  kind: ScheduleKind;
  /** "weekdays": Date#getDay values (0 = Sunday). */
  days: number[];
  /** "perWeek": how many days a week (any days). */
  perWeek: number | null;
  /** "interval": every N days, counted from `from`. */
  every: number | null;
}

export type ScheduleInput = Omit<ScheduleRule, "from">;

/**
 * An activity to track — learning, coding, work, projects, health, any habit. Stored in the
 * original `fitnessActivities` collection (the schema was always general-purpose).
 */
export interface TrackedActivity {
  id: string;
  name: string;
  description: string;
  /** Optional grouping ("Learning", "Freelance", or anything custom). Older records have none. */
  category: string | null;
  icon: ActivityIconKey;
  color: CategoryColorKey;
  startDate: DateKey;
  endDate: DateKey | null;
  /** Sorted by `from`; the first starts on `startDate`. */
  schedules: ScheduleRule[];
  reminderEnabled: boolean;
  /** "HH:MM", 24-hour, device local time. */
  reminderTime: string | null;
  /** Minutes. */
  targetDuration: number | null;
  targetQuantity: number | null;
  unit: string | null;
  /** Allow several sessions per day instead of one check-in. */
  multipleEntries: boolean;
  status: ActivityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackedActivityInput {
  name: string;
  description: string;
  category: string | null;
  icon: ActivityIconKey;
  color: CategoryColorKey;
  startDate: DateKey;
  endDate: DateKey | null;
  schedule: ScheduleInput;
  reminderEnabled: boolean;
  reminderTime: string | null;
  targetDuration: number | null;
  targetQuantity: number | null;
  unit: string | null;
  multipleEntries: boolean;
}

/** A completed session (or the day's check-in) for an activity. */
export interface ActivityLog {
  id: string;
  activityId: string;
  /** The local day the activity was done on. */
  date: DateKey;
  /** When it was actually done (separate from createdAt, which is when it was recorded). */
  completedAt: Date;
  durationMin: number | null;
  quantity: number | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLogInput {
  activityId: string;
  date: DateKey;
  completedAt: Date;
  durationMin: number | null;
  quantity: number | null;
  note: string;
}
