"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from "@/lib/constants/categories";
import { subscribeToCustomCategories } from "@/lib/services/category.service";
import type { Category } from "@/types";

import { useSession } from "./auth-provider";

interface CategoriesContextValue {
  /** Categories offered when adding an expense: defaults + active custom ones. */
  categories: Category[];
  /** The user's custom categories, including archived ones. */
  customCategories: Category[];
  status: "loading" | "ready" | "error";
  /** Resolves any id (including archived or unknown ones) to a displayable category. */
  getCategory: (id: string) => Category;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

type Snapshot = { uid: string; status: "ready" | "error"; custom: Category[] };

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid = user.uid;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(
    () =>
      subscribeToCustomCategories(
        uid,
        (custom) => setSnapshot({ uid, status: "ready", custom }),
        () => setSnapshot({ uid, status: "error", custom: [] }),
      ),
    [uid],
  );

  // Ignore results that belong to a previous user while the new subscription warms up.
  const current = snapshot?.uid === uid ? snapshot : null;
  const customCategories = useMemo(() => current?.custom ?? [], [current]);

  const byId = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of DEFAULT_CATEGORIES) map.set(c.id, c);
    for (const c of customCategories) map.set(c.id, c);
    return map;
  }, [customCategories]);

  const getCategory = useCallback((id: string) => byId.get(id) ?? FALLBACK_CATEGORY, [byId]);

  const value = useMemo<CategoriesContextValue>(
    () => ({
      categories: [...DEFAULT_CATEGORIES, ...customCategories.filter((c) => !c.archived)],
      customCategories,
      // Defaults are always available, so the UI never has to block on this.
      status: current?.status ?? "loading",
      getCategory,
    }),
    [customCategories, current?.status, getCategory],
  );

  return <CategoriesContext value={value}>{children}</CategoriesContext>;
}

export function useCategories(): CategoriesContextValue {
  const context = use(CategoriesContext);
  if (!context) throw new Error("useCategories must be used inside <CategoriesProvider>");
  return context;
}
