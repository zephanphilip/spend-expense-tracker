import {
  Activity,
  Apple,
  Bed,
  Bike,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Brush,
  CalendarCheck,
  CircleCheck,
  Code,
  Coffee,
  Database,
  Droplet,
  Dumbbell,
  Flame,
  FolderKanban,
  Footprints,
  GraduationCap,
  HeartPulse,
  Languages,
  Laptop,
  Leaf,
  Lightbulb,
  type LucideIcon,
  Moon,
  Mountain,
  Music,
  PenLine,
  PersonStanding,
  Pill,
  Rocket,
  Sun,
  Target,
  Terminal,
  Timer,
  Trophy,
  Waves,
  Wind,
} from "lucide-react";

import type { CategoryColorKey } from "./colors";

/** Activity icons. Keys are persisted (and listed in firestore.rules); never rename or remove a key. */
export const ACTIVITY_ICONS = {
  activity: Activity,
  // General (learning, coding, work, projects)
  code: Code,
  terminal: Terminal,
  laptop: Laptop,
  database: Database,
  study: GraduationCap,
  book: Book,
  read: BookOpen,
  briefcase: Briefcase,
  project: FolderKanban,
  pen: PenLine,
  brush: Brush,
  idea: Lightbulb,
  language: Languages,
  rocket: Rocket,
  coffee: Coffee,
  calendar: CalendarCheck,
  check: CircleCheck,
  // Health & routines
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
  sleep: Bed,
  moon: Moon,
  sun: Sun,
  food: Apple,
  vitamins: Pill,
  music: Music,
  target: Target,
  trophy: Trophy,
} satisfies Record<string, LucideIcon>;

export type ActivityIconKey = keyof typeof ACTIVITY_ICONS;

export const ACTIVITY_ICON_KEYS = Object.keys(ACTIVITY_ICONS) as [ActivityIconKey, ...ActivityIconKey[]];

export function isActivityIcon(value: unknown): value is ActivityIconKey {
  return typeof value === "string" && value in ACTIVITY_ICONS;
}

export const ACTIVITY_STATUSES = ["active", "paused", "archived"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

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

export const ACTIVITY_UNIT_MAX = 16;
export const ACTIVITY_NAME_MAX = 40;
export const ACTIVITY_DESCRIPTION_MAX = 140;
export const ACTIVITY_NOTE_MAX = 280;
/** 24 hours, in minutes. */
export const ACTIVITY_MAX_DURATION = 1440;
export const ACTIVITY_MAX_QUANTITY = 1_000_000;

/** Optional grouping. Suggestions only — any custom name (≤ ACTIVITY_CATEGORY_MAX) works. */
export const ACTIVITY_CATEGORY_PRESETS = ["Learning", "Coding", "Career", "Freelance", "Personal projects", "Health", "Reading", "Productivity", "Other"] as const;
export const ACTIVITY_CATEGORY_MAX = 24;

/** One-tap starting points in the "new activity" sheet (every field stays editable). */
export const ACTIVITY_TEMPLATES: {
  name: string;
  icon: ActivityIconKey;
  color: CategoryColorKey;
  category?: string;
  targetDuration?: number;
  targetQuantity?: number;
  unit?: string;
  multipleEntries?: boolean;
}[] = [
  { name: "Solve LeetCode", icon: "code", color: "amber", category: "Coding", targetQuantity: 2, unit: "problems" },
  { name: "Study C#", icon: "study", color: "violet", category: "Learning", targetDuration: 45 },
  { name: "Learn .NET", icon: "laptop", color: "indigo", category: "Learning", targetDuration: 30 },
  { name: "Freelance work", icon: "briefcase", color: "emerald", category: "Freelance", targetDuration: 120, multipleEntries: true },
  { name: "Personal project", icon: "project", color: "teal", category: "Personal projects", targetDuration: 60 },
  { name: "Read documentation", icon: "read", color: "sky", category: "Reading", targetDuration: 20 },
  { name: "Practice SQL", icon: "database", color: "blue", category: "Coding", targetQuantity: 3, unit: "queries" },
  { name: "Jogging", icon: "run", color: "orange", category: "Health", targetDuration: 20 },
  { name: "Walking", icon: "walk", color: "lime", category: "Health", targetQuantity: 5000, unit: "steps" },
  { name: "Meditation", icon: "meditate", color: "pink", category: "Health", targetDuration: 10 },
];
