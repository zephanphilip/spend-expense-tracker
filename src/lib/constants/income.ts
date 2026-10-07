import { Briefcase, Gift, type LucideIcon, Laptop, Sparkles } from "lucide-react";

export const INCOME_SOURCES = ["salary", "freelance", "bonus", "other"] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const INCOME_SOURCE_META: Record<IncomeSource, { label: string; icon: LucideIcon; tile: string }> = {
  salary: {
    label: "Salary",
    icon: Briefcase,
    tile: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  freelance: {
    label: "Freelance",
    icon: Laptop,
    tile: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  },
  bonus: {
    label: "Bonus",
    icon: Gift,
    tile: "bg-amber-500/14 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  other: {
    label: "Other",
    icon: Sparkles,
    tile: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
};

export function isIncomeSource(value: unknown): value is IncomeSource {
  return typeof value === "string" && (INCOME_SOURCES as readonly string[]).includes(value);
}
