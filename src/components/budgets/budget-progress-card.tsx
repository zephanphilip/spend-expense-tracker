"use client";

import { AlertTriangle } from "lucide-react";

import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import type { BudgetProgress } from "@/lib/finance/budget";
import { cn } from "@/lib/utils";

export const STATE_TONE = { ok: "ok", warning: "warning", over: "over" } as const;

interface BudgetProgressCardProps {
  progress: BudgetProgress;
  /** Days left in the month, for a "per day" pace hint (current month only). */
  daysLeft?: number;
  note?: string;
  className?: string;
}

export function BudgetProgressCard({ progress, daysLeft, note, className }: BudgetProgressCardProps) {
  const over = progress.state === "over";
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{over ? "Over budget by" : "Left to spend"}</p>
          <p className={cn("text-3xl font-semibold tracking-tight", over && "text-destructive")}>
            <Money amount={Math.abs(progress.remaining)} />
          </p>
        </div>
        <p className={cn("text-sm font-semibold tabular-nums", over ? "text-destructive" : progress.state === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {progress.percent}% used
        </p>
      </div>
      <ProgressBar value={progress.ratio} tone={STATE_TONE[progress.state]} label="Overall budget used" />
      <p className="text-sm text-muted-foreground">
        <Money amount={progress.spent} className="font-medium text-foreground" /> of <Money amount={progress.limit} />
        {daysLeft && !over && progress.remaining > 0 ? (
          <>
            {" · "}
            {/* Whole currency units read better for a pace hint. */}
            <Money amount={Math.floor(progress.remaining / daysLeft / 100) * 100} />/day for {daysLeft} {daysLeft === 1 ? "day" : "days"}
          </>
        ) : null}
      </p>
      {over ? (
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          You&apos;ve gone over this month&apos;s budget.
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
