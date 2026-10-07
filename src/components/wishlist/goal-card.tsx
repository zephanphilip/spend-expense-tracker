"use client";

import { format } from "date-fns";
import { PartyPopper } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { goalProgress } from "@/lib/finance/goals";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types";
import { routes } from "@/lib/routes";

export function GoalCard({ goal, onAdd, compact = false }: { goal: Goal; onAdd?: (goal: Goal) => void; compact?: boolean }) {
  const p = goalProgress(goal);
  return (
    <li className={cn("rounded-3xl border bg-card", compact ? "p-3" : "p-4")}>
      <Link href={routes.goal(goal.id)} className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <CategoryIcon category={goal} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{goal.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            <Money amount={goal.savedAmount} /> of <Money amount={goal.targetAmount} />
          </span>
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", p.achieved && "text-emerald-600 dark:text-emerald-400")}>{p.percent}%</span>
      </Link>
      <ProgressBar
        value={p.ratio}
        colorClassName={p.achieved ? "bg-emerald-500" : CATEGORY_COLORS[goal.color].solid}
        size="sm"
        label={`${goal.name} saved`}
        className="mt-3"
      />
      {!compact ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className={cn("text-xs", p.isPastDue ? "font-medium text-destructive" : "text-muted-foreground")}>
            {p.achieved ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <PartyPopper className="size-3.5" aria-hidden /> Goal reached
              </span>
            ) : (
              <>
                <Money amount={p.remaining} /> to go
                {goal.targetDate ? (
                  <>
                    {" · "}
                    {p.isPastDue ? "was due " : "by "}
                    {format(goal.targetDate, "MMM yyyy")}
                    {p.perMonth && !p.isPastDue ? (
                      <>
                        {" · "}
                        <Money amount={p.perMonth} />/mo
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </p>
          {onAdd && !p.achieved ? (
            <Button size="lg" variant="outline" className="rounded-xl" onClick={() => onAdd(goal)}>
              Add money
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
