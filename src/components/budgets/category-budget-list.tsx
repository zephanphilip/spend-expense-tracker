"use client";

import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import { budgetProgress } from "@/lib/finance/budget";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";

import { STATE_TONE } from "./budget-progress-card";

interface CategoryBudgetListProps {
  limits: Record<string, number>;
  spentByCategory: Map<string, number>;
  /** Show only the N rows closest to (or over) their limit. */
  top?: number;
}

export function CategoryBudgetList({ limits, spentByCategory, top }: CategoryBudgetListProps) {
  const { getCategory } = useCategories();
  const rows = Object.entries(limits)
    .map(([id, limit]) => ({ category: getCategory(id), progress: budgetProgress(limit, spentByCategory.get(id) ?? 0) }))
    .sort((a, b) => b.progress.ratio - a.progress.ratio)
    .slice(0, top);

  return (
    <ul className="space-y-4">
      {rows.map(({ category, progress }) => (
        <li key={category.id} className="flex items-center gap-3">
          <CategoryIcon category={category} size="sm" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{category.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                <Money amount={progress.spent} className="font-medium text-foreground" /> / <Money amount={progress.limit} />
              </span>
            </div>
            <ProgressBar value={progress.ratio} tone={STATE_TONE[progress.state]} size="sm" label={`${category.name} budget used`} />
            <p
              className={cn(
                "text-xs",
                progress.state === "over" ? "font-medium text-destructive" : progress.state === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
              )}
            >
              {progress.state === "over" ? (
                <>
                  <Money amount={-progress.remaining} /> over
                </>
              ) : (
                <>
                  <Money amount={progress.remaining} /> left · {progress.percent}%
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
