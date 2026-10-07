import type { Category } from "@/types";

/**
 * Built-in categories. IDs are persisted on expenses — never change an existing ID.
 * They are merged with the user's custom categories at read time (see CategoriesProvider).
 */
const DEFAULTS: Pick<Category, "id" | "name" | "icon" | "color">[] = [
  { id: "food", name: "Food", icon: "utensils", color: "orange" },
  { id: "groceries", name: "Groceries", icon: "basket", color: "lime" },
  { id: "transport", name: "Transport", icon: "car", color: "blue" },
  { id: "fuel", name: "Fuel", icon: "fuel", color: "slate" },
  { id: "shopping", name: "Shopping", icon: "bag", color: "pink" },
  { id: "bills", name: "Bills", icon: "receipt", color: "amber" },
  { id: "home", name: "Home", icon: "house", color: "teal" },
  { id: "health", name: "Health", icon: "health", color: "rose" },
  { id: "entertainment", name: "Fun", icon: "film", color: "violet" },
  { id: "travel", name: "Travel", icon: "plane", color: "sky" },
  { id: "education", name: "Education", icon: "education", color: "indigo" },
  { id: "emi", name: "EMI", icon: "bank", color: "indigo" },
  { id: "other", name: "Other", icon: "other", color: "emerald" },
];

export const DEFAULT_CATEGORIES: readonly Category[] = DEFAULTS.map((c) => ({
  ...c,
  isDefault: true,
  archived: false,
}));

export const DEFAULT_CATEGORY_IDS: ReadonlySet<string> = new Set(
  DEFAULTS.map((c) => c.id),
);

export const FALLBACK_CATEGORY: Category = {
  id: "__unknown__",
  name: "Uncategorized",
  icon: "other",
  color: "slate",
  isDefault: true,
  archived: true,
};

export const MAX_CUSTOM_CATEGORIES = 50;

/** Category used for expenses logged automatically from EMI payments. */
export const EMI_CATEGORY_ID = "emi";
