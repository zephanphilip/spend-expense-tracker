import type { CategoryColorKey } from "@/lib/constants/colors";
import type { FitnessIconKey, FitnessStatus, ScheduleKind } from "@/lib/constants/fitness";
import type { DateKey } from "@/lib/fitness/dates";

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

export interface FitnessActivity {
  id: string;
  name: string;
  description: string;
  icon: FitnessIconKey;
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
  status: FitnessStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface FitnessActivityInput {
  name: string;
  description: string;
  icon: FitnessIconKey;
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
export interface FitnessLog {
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

export interface FitnessLogInput {
  activityId: string;
  date: DateKey;
  completedAt: Date;
  durationMin: number | null;
  quantity: number | null;
  note: string;
}
