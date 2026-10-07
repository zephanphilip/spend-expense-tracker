"use client";

import { format } from "date-fns";

import { Money } from "@/components/common/money";
import type { DashboardSummary } from "@/lib/analytics";
import type { BudgetProgress } from "@/lib/finance/budget";
import { cn } from "@/lib/utils";

interface SpendingHeroProps {
  summary: DashboardSummary;
  month: Date;
  income: number;
  budget: BudgetProgress | null;
}

export function SpendingHero({ summary, month, income, budget }: SpendingHeroProps) {
  const savings = income - summary.month;
  return (
    <section
      aria-labelledby="month-total-label"
      className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/20"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
      <p id="month-total-label" className="text-sm font-medium text-primary-foreground/70">
        Spent in {format(month, "MMMM")}
      </p>
      <p className="mt-1 text-4xl font-semibold tracking-tight md:text-5xl">
        <Money amount={summary.month} />
      </p>

      {budget ? (
        <div className="mt-4 space-y-1.5">
          <div
            role="progressbar"
            aria-label="Monthly budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(budget.percent, 100)}
            className="h-2 overflow-hidden rounded-full bg-primary-foreground/20"
          >
            <div
              className={cn("h-full rounded-full", budget.state === "over" ? "bg-red-300" : budget.state === "warning" ? "bg-amber-200" : "bg-primary-foreground")}
              style={{ width: `${Math.min(budget.ratio, 1) * 100}%` }}
            />
          </div>
          <p className="text-xs text-primary-foreground/80">
            {budget.state === "over" ? (
              <>
                <Money amount={-budget.remaining} /> over your <Money amount={budget.limit} /> budget
              </>
            ) : (
              <>
                <Money amount={budget.remaining} /> left of <Money amount={budget.limit} /> · {budget.percent}% used
              </>
            )}
          </p>
        </div>
      ) : null}

      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-primary-foreground/65">Today</dt>
          <dd className="mt-0.5 font-semibold">
            <Money amount={summary.today} />
          </dd>
        </div>
        <div>
          <dt className="text-primary-foreground/65">Income</dt>
          <dd className="mt-0.5 font-semibold">
            <Money amount={income} />
          </dd>
        </div>
        <div>
          {/* Without any income recorded, "overspent" would be misleading — stay neutral. */}
          <dt className="text-primary-foreground/65">{income > 0 && savings < 0 ? "Overspent" : "Saved"}</dt>
          <dd className="mt-0.5 font-semibold">
            {income > 0 ? (
              <>
                <Money amount={Math.abs(savings)} />
                <span className="ml-1 text-xs font-normal text-primary-foreground/70">{Math.round((savings / income) * 100)}%</span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
