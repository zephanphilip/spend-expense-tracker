/**
 * Category color palette. Stored in Firestore as the key; class names are spelled out
 * in full so Tailwind can detect them at build time.
 */
export const CATEGORY_COLORS = {
  orange: {
    label: "Orange",
    tile: "bg-orange-500/12 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
    solid: "bg-orange-500",
    /** For SVG charts (same as Tailwind orange-500). */
    hex: "#f97316",
  },
  amber: {
    label: "Amber",
    tile: "bg-amber-500/14 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    solid: "bg-amber-500",
    /** For SVG charts (same as Tailwind amber-500). */
    hex: "#f59e0b",
  },
  lime: {
    label: "Lime",
    tile: "bg-lime-500/15 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300",
    solid: "bg-lime-500",
    /** For SVG charts (same as Tailwind lime-500). */
    hex: "#84cc16",
  },
  emerald: {
    label: "Emerald",
    tile: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    solid: "bg-emerald-500",
    /** For SVG charts (same as Tailwind emerald-500). */
    hex: "#10b981",
  },
  teal: {
    label: "Teal",
    tile: "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
    solid: "bg-teal-500",
    /** For SVG charts (same as Tailwind teal-500). */
    hex: "#14b8a6",
  },
  sky: {
    label: "Sky",
    tile: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    solid: "bg-sky-500",
    /** For SVG charts (same as Tailwind sky-500). */
    hex: "#0ea5e9",
  },
  blue: {
    label: "Blue",
    tile: "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    solid: "bg-blue-500",
    /** For SVG charts (same as Tailwind blue-500). */
    hex: "#3b82f6",
  },
  indigo: {
    label: "Indigo",
    tile: "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    solid: "bg-indigo-500",
    /** For SVG charts (same as Tailwind indigo-500). */
    hex: "#6366f1",
  },
  violet: {
    label: "Violet",
    tile: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    solid: "bg-violet-500",
    /** For SVG charts (same as Tailwind violet-500). */
    hex: "#8b5cf6",
  },
  pink: {
    label: "Pink",
    tile: "bg-pink-500/12 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
    solid: "bg-pink-500",
    /** For SVG charts (same as Tailwind pink-500). */
    hex: "#ec4899",
  },
  rose: {
    label: "Rose",
    tile: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    solid: "bg-rose-500",
    /** For SVG charts (same as Tailwind rose-500). */
    hex: "#f43f5e",
  },
  slate: {
    label: "Slate",
    tile: "bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    solid: "bg-slate-500",
    /** For SVG charts (same as Tailwind slate-500). */
    hex: "#64748b",
  },
} as const;

export type CategoryColorKey = keyof typeof CATEGORY_COLORS;

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as [
  CategoryColorKey,
  ...CategoryColorKey[],
];
