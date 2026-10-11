import {
  deleteDoc,
  doc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import type { FitnessStatus } from "@/lib/constants/fitness";
import { type DateKey, maxKey } from "@/lib/fitness/dates";
import { currentSchedule, normalizeSchedule, sameSchedule, withScheduleFrom, withStartDate } from "@/lib/fitness/schedule";
import { getDb } from "@/lib/firebase/client";
import { activityInputSchema, logInputSchema } from "@/lib/validation/fitness";
import type { FitnessActivity, FitnessActivityInput, FitnessLog, FitnessLogInput, ScheduleInput, ScheduleRule } from "@/types/fitness";

import { deleteParentThenChildren } from "./batch-delete";
import { fitnessActivityConverter, fitnessLogConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { fitnessActivitiesCol, fitnessActivityDoc, fitnessLogDoc, fitnessLogsCol } from "./paths";

type Unsubscribe = () => void;

const NONE: ScheduleInput = { kind: "none", days: [], perWeek: null, every: null };

// ---------------------------------------------------------------- reads

export function subscribeFitnessActivities(
  uid: string,
  onData: (activities: FitnessActivity[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(fitnessActivitiesCol(uid), orderBy("createdAt", "asc")).withConverter(fitnessActivityConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/** Logs for days in [from, to] (date keys), optionally for one activity — newest first. */
export function subscribeFitnessLogsBetween(
  uid: string,
  { from, to, activityId }: { from: DateKey; to: DateKey; activityId?: string },
  onData: (logs: FitnessLog[], pendingIds: ReadonlySet<string>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const filters = [where("date", ">=", from), where("date", "<=", to)];
  if (activityId) filters.unshift(where("activityId", "==", activityId));
  const q = query(fitnessLogsCol(uid), ...filters, orderBy("date", "desc")).withConverter(fitnessLogConverter);
  // Metadata changes too, so records saved offline flip from "waiting to sync" to synced.
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => onData(snap.docs.map((d) => d.data()), new Set(snap.docs.filter((d) => d.metadata.hasPendingWrites).map((d) => d.id))),
    onError,
  );
}

/** One activity's history, newest first, `limit` at a time (composite index activityId + date). */
export function subscribeActivityLogs(
  uid: string,
  activityId: string,
  limit: number,
  onData: (logs: FitnessLog[], hasMore: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(fitnessLogsCol(uid), where("activityId", "==", activityId), orderBy("date", "desc"), limitTo(limit + 1)).withConverter(
    fitnessLogConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.slice(0, limit).map((d) => d.data()), snap.size > limit), onError);
}

// ---------------------------------------------------------------- activities

function activityFields(input: FitnessActivityInput) {
  const v = activityInputSchema.parse(input);
  return {
    name: v.name,
    description: v.description,
    icon: v.icon,
    color: v.color,
    startDate: v.startDate,
    endDate: v.endDate,
    reminderEnabled: v.reminderEnabled,
    reminderTime: v.reminderEnabled ? v.reminderTime : v.reminderTime ?? null,
    targetDuration: v.targetDuration,
    targetQuantity: v.targetQuantity,
    unit: v.unit || null,
    multipleEntries: v.multipleEntries,
  };
}

export function createFitnessActivity(uid: string, input: FitnessActivityInput): PendingWrite {
  const fields = activityFields(input);
  const ref = doc(fitnessActivitiesCol(uid));
  const schedules: ScheduleRule[] = [{ from: fields.startDate, ...normalizeSchedule(input.schedule) }];
  const batch = writeBatch(getDb());
  batch.set(ref, { ...fields, schedules, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id: ref.id, committed: batch.commit() };
}

/**
 * Saves edits. A new frequency takes effect from `today` (or the start date if that's later)
 * so past days keep the schedule they had — completion records are never rewritten.
 * Paused/archived activities keep their schedule until resumed.
 */
export function updateFitnessActivity(uid: string, activity: FitnessActivity, input: FitnessActivityInput, today: DateKey): Promise<void> {
  const fields = activityFields(input);
  let schedules = activity.schedules;
  if (fields.startDate !== activity.startDate) schedules = withStartDate(schedules, fields.startDate);
  if (activity.status === "active" && !sameSchedule(currentSchedule(activity), normalizeSchedule(input.schedule))) {
    schedules = withScheduleFrom(schedules, input.schedule, maxKey(today, fields.startDate), fields.startDate);
  }
  return updateDoc(fitnessActivityDoc(uid, activity.id), { ...fields, schedules, updatedAt: serverTimestamp() });
}

/** Pause, resume, archive or restore. Nothing is due while paused or archived. */
export function setFitnessActivityStatus(uid: string, activity: FitnessActivity, status: FitnessStatus, today: DateKey): Promise<void> {
  const effective = maxKey(today, activity.startDate);
  let schedules = activity.schedules;
  if (status === "active") {
    schedules = withScheduleFrom(schedules, currentSchedule(activity), effective, activity.startDate);
  } else if (activity.status === "active") {
    const resumeTo = currentSchedule(activity);
    schedules = withScheduleFrom(schedules, NONE, effective, activity.startDate);
    // Paused on its first day: keep the schedule underneath (same day, earlier in the list)
    // so it can be resumed — the later "none" version is the one in effect.
    if (!schedules.some((r) => r.kind !== "none")) schedules = [{ from: activity.startDate, ...resumeTo }, ...schedules];
  }
  return updateDoc(fitnessActivityDoc(uid, activity.id), { status, schedules, updatedAt: serverTimestamp() });
}

/** Deletes an activity and every record of it. */
export async function deleteFitnessActivity(uid: string, activityId: string): Promise<void> {
  const logs = await getDocs(query(fitnessLogsCol(uid), where("activityId", "==", activityId)));
  await deleteParentThenChildren(fitnessActivityDoc(uid, activityId), logs.docs.map((d) => d.ref));
}

// ---------------------------------------------------------------- logs

/** One check-in per activity per day: a deterministic id makes retries and double taps idempotent. */
export function dailyLogId(activityId: string, date: DateKey): string {
  return `${activityId}_${date}`;
}

export class DuplicateLogError extends Error {
  constructor() {
    super("That day already has a record for this activity. Edit it instead.");
    this.name = "DuplicateLogError";
  }
}

function logFields(input: FitnessLogInput) {
  const v = logInputSchema.parse(input);
  return {
    activityId: v.activityId,
    date: v.date,
    completedAt: Timestamp.fromDate(v.completedAt),
    durationMin: v.durationMin,
    quantity: v.quantity,
    note: v.note,
  };
}

type LoggableActivity = Pick<FitnessActivity, "id" | "multipleEntries" | "startDate" | "schedules">;

/**
 * A record dated before the activity's start (e.g. yesterday's jog for a habit created
 * today) moves the start back to that day in the same batch, so the record counts.
 */
function extendStart(batch: ReturnType<typeof writeBatch>, uid: string, activity: LoggableActivity, date: DateKey) {
  if (date >= activity.startDate) return;
  batch.update(fitnessActivityDoc(uid, activity.id), { startDate: date, schedules: withStartDate(activity.schedules, date), updatedAt: serverTimestamp() });
}

function targetLogId(uid: string, activity: Pick<FitnessActivity, "id" | "multipleEntries">, date: DateKey): string {
  return activity.multipleEntries ? doc(fitnessLogsCol(uid)).id : dailyLogId(activity.id, date);
}

/**
 * Records a session/check-in. For daily check-ins pass `alreadyDone` from the live data:
 * a second tap for the same day is a no-op instead of an error.
 */
export function logFitness(
  uid: string,
  activity: LoggableActivity,
  input: FitnessLogInput,
  { alreadyDone = false }: { alreadyDone?: boolean } = {},
): PendingWrite {
  const id = targetLogId(uid, activity, input.date);
  if (!activity.multipleEntries && alreadyDone) return { id, committed: Promise.resolve() };
  const batch = writeBatch(getDb());
  extendStart(batch, uid, activity, input.date);
  batch.set(fitnessLogDoc(uid, id), { ...logFields(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id, committed: batch.commit() };
}

/**
 * Edits a record, including its date/time or activity. A daily check-in whose day changes
 * moves to the new day's id (delete + create in one batch). `occupied` reports whether the
 * destination day already has a check-in, so a correction can't silently overwrite it.
 */
export function editFitnessLog(
  uid: string,
  activity: LoggableActivity,
  existing: FitnessLog,
  input: FitnessLogInput,
  occupied: (activityId: string, date: DateKey) => boolean,
): PendingWrite {
  const fields = logFields(input);
  // Only ids of the form "<activityId>_<date>" encode where the record belongs.
  const usesDailyId = existing.id === dailyLogId(existing.activityId, existing.date);
  const keepsId = existing.activityId === fields.activityId && (!usesDailyId || existing.date === fields.date);
  if (!keepsId && !activity.multipleEntries && occupied(fields.activityId, fields.date)) throw new DuplicateLogError();
  const batch = writeBatch(getDb());
  extendStart(batch, uid, activity, fields.date);
  if (keepsId) {
    batch.update(fitnessLogDoc(uid, existing.id), { ...fields, updatedAt: serverTimestamp() });
    return { id: existing.id, committed: batch.commit() };
  }
  const id = targetLogId(uid, activity, fields.date);
  batch.delete(fitnessLogDoc(uid, existing.id));
  batch.set(fitnessLogDoc(uid, id), { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id, committed: batch.commit() };
}

export function deleteFitnessLog(uid: string, logId: string): Promise<void> {
  return deleteDoc(fitnessLogDoc(uid, logId));
}

/** Restores a deleted record exactly (used by Undo). */
export function restoreFitnessLog(uid: string, log: FitnessLog): Promise<void> {
  const batch = writeBatch(getDb());
  batch.set(fitnessLogDoc(uid, log.id), {
    ...logFields(log),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** Saves reminder settings for several activities at once. */
export function saveFitnessReminders(uid: string, changes: { id: string; reminderEnabled: boolean; reminderTime: string | null }[]): Promise<void> {
  const batch = writeBatch(getDb());
  for (const c of changes) {
    batch.update(fitnessActivityDoc(uid, c.id), { reminderEnabled: c.reminderEnabled, reminderTime: c.reminderTime, updatedAt: serverTimestamp() });
  }
  return batch.commit();
}
