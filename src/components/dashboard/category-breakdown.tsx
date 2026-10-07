"use client";

import { PieChart } from "lucide-react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import type { CategoryTotal } from "@/lib/analytics";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";

export function CategoryBreakdown({ totals }: { totals: CategoryTotal[] }) {
  const { getCategory } = useCategories();

  return (
    <section aria-labelledby="categories-title" className="rounded-3xl border bg-card p-5">
      <h2 id="categories-title" className="font-semibold">
        By category
      </h2>
      {totals.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="Nothing this month yet"
          description="Your spending by category will show up here."
          className="mt-4 border-0 py-8"
        />
      ) : (
        <>
          <div aria-hidden className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {totals.map((t) => (
              <div
                key={t.categoryId}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", CATEGORY_COLORS[getCategory(t.categoryId).color].solid)}
                style={{ width: `${t.share * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {totals.map((t) => {
              const category = getCategory(t.categoryId);
              const percent = Math.round(t.share * 100);
              return (
                <li key={t.categoryId} className="flex items-center gap-3">
                  <CategoryIcon category={category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{category.name}</span>
                      <Money amount={t.total} className="text-sm font-semibold" />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", CATEGORY_COLORS[category.color].solid)}
                          style={{ width: `${Math.max(t.share * 100, 2)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                        {percent < 1 ? "<1" : percent}% · {t.count}
                        <span className="sr-only"> expenses</span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
