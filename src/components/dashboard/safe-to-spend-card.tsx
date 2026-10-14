"use client";

import { endOfMonth, format } from "date-fns";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import type { DailyAllowance } from "@/lib/finance/budget";
import { cn } from "@/lib/utils";

interface SafeToSpendCardProps {
  /** null when the month's budget has no overall limit. */
  allowance: DailyAllowance | null;
  today: Date;
  /** Expenses dated later this month (not yet "spent", so not counted). */
  laterThisMonth: number;
}

/** "Safe to spend today": the overall budget left, spread evenly over the days left this month. */
export function SafeToSpendCard({ allowance, today, laterThisMonth }: SafeToSpendCardProps) {
  if (!allowance) {
    return (
      <Link
        href="/budgets"
        className="flex items-center gap-3 rounded-3xl border bg-card p-4 text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">Safe to spend today</span>
          <span className="block text-muted-foreground">Add an overall monthly budget to see a daily allowance</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  const { limit, spent, remaining, daysLeft, perDay, progress } = allowance;
  const over = remaining < 0;
  const lastDay = daysLeft === 1;
  const tone = progress.state === "over" ? "over" : progress.state === "warning" ? "warning" : "ok";

  return (
    <section aria-labelledby="safe-title" className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="safe-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className={cn("size-4", over ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")} aria-hidden />
          Safe to spend today
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {lastDay ? "Last day" : `${daysLeft} days left`}
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <Money amount={perDay} className={cn("text-4xl font-semibold tracking-tight", over && "text-destructive")} />
        {!lastDay ? <span className="text-sm text-muted-foreground">/ day</span> : null}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {over ? (
          <>
            You&apos;re <Money amount={-remaining} className="font-medium text-destructive" /> over this month&apos;s budget.
          </>
        ) : lastDay ? (
          "Everything left in this month's budget."
        ) : (
          `Spread evenly to stay on budget through ${format(endOfMonth(today), "d MMM")}.`
        )}
      </p>

      <div className="mt-4 space-y-1.5">
        <ProgressBar value={progress.ratio} tone={tone} label="Share of monthly budget spent" />
        <p className="text-xs text-muted-foreground tabular-nums">{progress.percent}% of the monthly budget used</p>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Budget</dt>
          <dd className="mt-0.5 truncate font-semibold">
            <Money amount={limit} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Spent so far</dt>
          <dd className="mt-0.5 truncate font-semibold">
            <Money amount={spent} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{over ? "Over by" : "Remaining"}</dt>
          <dd className={cn("mt-0.5 truncate font-semibold", over && "text-destructive")}>
            <Money amount={Math.abs(remaining)} />
          </dd>
        </div>
      </dl>

      {laterThisMonth > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Money amount={laterThisMonth} /> dated later this month isn&apos;t counted until that day.
        </p>
      ) : null}
    </section>
  );
}
