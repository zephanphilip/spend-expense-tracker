import { z } from "zod";

import { CATEGORY_COLOR_KEYS } from "@/lib/constants/colors";
import {
  FITNESS_DESCRIPTION_MAX,
  FITNESS_ICON_KEYS,
  FITNESS_MAX_DURATION,
  FITNESS_MAX_QUANTITY,
  FITNESS_NAME_MAX,
  FITNESS_NOTE_MAX,
  FITNESS_UNIT_MAX,
  SCHEDULE_KINDS,
} from "@/lib/constants/fitness";
import { isDateKey } from "@/lib/fitness/dates";

const dateKey = z.string().refine(isDateKey, "Pick a date");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

/** Optional whole minutes typed into a text field ("" = none). */
const optionalMinutes = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= FITNESS_MAX_DURATION), `Enter minutes between 1 and ${FITNESS_MAX_DURATION}`);

/** Optional positive number ("" = none), up to 2 decimals. */
const optionalQuantity = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= FITNESS_MAX_QUANTITY), "Enter a positive number");

export const scheduleInputSchema = z.object({
  kind: z.enum(SCHEDULE_KINDS),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  perWeek: z.number().int().min(1).max(7).nullable(),
  every: z.number().int().min(1).max(365).nullable(),
});

export const activityFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(FITNESS_NAME_MAX, `Keep it under ${FITNESS_NAME_MAX} characters`),
    description: z.string().trim().max(FITNESS_DESCRIPTION_MAX, `Keep it under ${FITNESS_DESCRIPTION_MAX} characters`),
    icon: z.enum(FITNESS_ICON_KEYS),
    color: z.enum(CATEGORY_COLOR_KEYS),
    kind: z.enum(["daily", "weekdays", "perWeek", "interval"]),
    days: z.array(z.number().int().min(0).max(6)),
    perWeek: z.number().int().min(1).max(7),
    every: z.number().int().min(2).max(365),
    reminderEnabled: z.boolean(),
    reminderTime: z.string(),
    startDate: dateKey,
    endDate: z.string(),
    targetDuration: optionalMinutes,
    targetQuantity: optionalQuantity,
    unit: z.string().trim().max(FITNESS_UNIT_MAX, `Keep it under ${FITNESS_UNIT_MAX} characters`),
    multipleEntries: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "weekdays" && v.days.length === 0) ctx.addIssue({ code: "custom", path: ["days"], message: "Pick at least one day" });
    if (v.reminderEnabled && !timeOfDay.safeParse(v.reminderTime).success) ctx.addIssue({ code: "custom", path: ["reminderTime"], message: "Pick a reminder time" });
    if (v.endDate && (!isDateKey(v.endDate) || v.endDate < v.startDate)) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
  });

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

/** Service-level guard (mirrors firestore.rules). */
export const activityInputSchema = z.object({
  name: z.string().trim().min(1).max(FITNESS_NAME_MAX),
  description: z.string().trim().max(FITNESS_DESCRIPTION_MAX),
  icon: z.enum(FITNESS_ICON_KEYS),
  color: z.enum(CATEGORY_COLOR_KEYS),
  startDate: dateKey,
  endDate: dateKey.nullable(),
  schedule: scheduleInputSchema,
  reminderEnabled: z.boolean(),
  reminderTime: timeOfDay.nullable(),
  targetDuration: z.number().int().min(1).max(FITNESS_MAX_DURATION).nullable(),
  targetQuantity: z.number().positive().max(FITNESS_MAX_QUANTITY).nullable(),
  unit: z.string().trim().max(FITNESS_UNIT_MAX).nullable(),
  multipleEntries: z.boolean(),
});

export const logFormSchema = z.object({
  activityId: z.string().min(1, "Pick an activity"),
  date: dateKey,
  time: timeOfDay,
  durationMin: optionalMinutes,
  quantity: optionalQuantity,
  note: z.string().trim().max(FITNESS_NOTE_MAX, `Keep notes under ${FITNESS_NOTE_MAX} characters`),
});

export type LogFormValues = z.infer<typeof logFormSchema>;

export const logInputSchema = z.object({
  activityId: z.string().min(1).max(128),
  date: dateKey,
  completedAt: z.date(),
  durationMin: z.number().int().min(0).max(FITNESS_MAX_DURATION).nullable(),
  quantity: z.number().min(0).max(FITNESS_MAX_QUANTITY).nullable(),
  note: z.string().trim().max(FITNESS_NOTE_MAX),
});

export const optionalNumber = (value: string): number | null => (value.trim() === "" ? null : Number(value));
