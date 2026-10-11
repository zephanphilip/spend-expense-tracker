import {
  Activity,
  Apple,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Leaf,
  type LucideIcon,
  Moon,
  Mountain,
  Music,
  PersonStanding,
  Pill,
  Sun,
  Target,
  Timer,
  Trophy,
  Waves,
  Wind,
} from "lucide-react";

import type { CategoryColorKey } from "./colors";

/** Icons for fitness activities. Keys are persisted; never rename a key. */
export const FITNESS_ICONS = {
  activity: Activity,
  run: Footprints,
  walk: PersonStanding,
  bike: Bike,
  gym: Dumbbell,
  swim: Waves,
  hike: Mountain,
  stretch: Wind,
  yoga: Leaf,
  heart: HeartPulse,
  flame: Flame,
  timer: Timer,
  water: Droplet,
  meditate: Brain,
  read: BookOpen,
  sleep: Bed,
  moon: Moon,
  sun: Sun,
  food: Apple,
  vitamins: Pill,
  music: Music,
  target: Target,
  trophy: Trophy,
} satisfies Record<string, LucideIcon>;

export type FitnessIconKey = keyof typeof FITNESS_ICONS;

export const FITNESS_ICON_KEYS = Object.keys(FITNESS_ICONS) as [FitnessIconKey, ...FitnessIconKey[]];

export function isFitnessIcon(value: unknown): value is FitnessIconKey {
  return typeof value === "string" && value in FITNESS_ICONS;
}

export const FITNESS_STATUSES = ["active", "paused", "archived"] as const;
export type FitnessStatus = (typeof FITNESS_STATUSES)[number];

export const SCHEDULE_KINDS = ["daily", "weekdays", "perWeek", "interval", "none"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/** Schedules the user can pick ("none" is written internally while paused/archived). */
export const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Every day", short: "Daily" },
  { value: "weekdays", label: "Specific days", short: "Set days" },
  { value: "perWeek", label: "Times a week", short: "× a week" },
  { value: "interval", label: "Every few days", short: "Every N" },
] as const satisfies readonly { value: Exclude<ScheduleKind, "none">; label: string; short: string }[];

/** Monday-first for display; values are Date#getDay numbers (0 = Sunday). */
export const WEEKDAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
] as const;

export const FITNESS_UNIT_MAX = 16;
export const FITNESS_NAME_MAX = 40;
export const FITNESS_DESCRIPTION_MAX = 140;
export const FITNESS_NOTE_MAX = 280;
/** 24 hours, in minutes. */
export const FITNESS_MAX_DURATION = 1440;
export const FITNESS_MAX_QUANTITY = 1_000_000;

/** One-tap starting points in the "new activity" sheet. */
export const ACTIVITY_TEMPLATES: {
  name: string;
  icon: FitnessIconKey;
  color: CategoryColorKey;
  targetDuration?: number;
  targetQuantity?: number;
  unit?: string;
}[] = [
  { name: "Jogging", icon: "run", color: "orange", targetDuration: 20 },
  { name: "Walking", icon: "walk", color: "emerald", targetQuantity: 5000, unit: "steps" },
  { name: "Gym", icon: "gym", color: "indigo" },
  { name: "Stretching", icon: "stretch", color: "teal", targetDuration: 10 },
  { name: "Meditation", icon: "meditate", color: "violet", targetDuration: 10 },
  { name: "Reading", icon: "read", color: "amber", targetDuration: 20 },
  { name: "Drink water", icon: "water", color: "sky", targetQuantity: 2, unit: "litres" },
  { name: "Cycling", icon: "bike", color: "lime", targetDuration: 30 },
];
