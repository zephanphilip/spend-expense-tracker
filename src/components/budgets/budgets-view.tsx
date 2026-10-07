"use client";

import { differenceInCalendarDays, endOfMonth } from "date-fns";
import { Gauge, Pencil } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { MonthSwitcher } from "@/components/common/month-switcher";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyStats } from "@/hooks/use-monthly-stats";
import { budgetProgress, effectiveBudget } from "@/lib/finance/budget";
import { formatMonth, monthKey, recentMonths, shiftMonth } from "@/lib/months";
import { cn } from "@/lib/utils";
import { useFinance } from "@/providers/finance-provider";

import { BudgetProgressCard, STATE_TONE } from "./budget-progress-card";
import { BudgetSheet } from "./budget-sheet";
import { CategoryBudgetList } from "./category-budget-list";

const HISTORY_MONTHS = 6;

export function BudgetsView() {
  const [now] = useState(() => new Date());
  const currentMonth = monthKey(now);
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState(false);
  const { budgets } = useFinance();

  const months = recentMonths(month, HISTORY_MONTHS);
  // Monthly aggregates: 6 small documents instead of six months of expenses.
  const expenses = useMonthlyStats(months[0], month);
  const current = expenses.get(month);

  const effective = budgets.status === "success" ? effectiveBudget(budgets.data, month) : null;
  const budget = effective?.budget ?? null;
  const spent = current.expenseTotal;
  const spentByCategory = new Map(Object.entries(current.byCategory));
  const hasCategoryLimits = budget ? Object.keys(budget.categories).length > 0 : false;
  const daysLeft = month === currentMonth ? differenceInCalendarDays(endOfMonth(now), now) + 1 : undefined;

  const loading = budgets.status === "loading" || expenses.status === "loading";
  const error = budgets.error ?? expenses.error;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setEditing(true)} className="h-10 rounded-xl" disabled={loading}>
            <Pencil aria-hidden />
            {budget ? "Edit" : "Set budget"}
          </Button>
        }
      />
      <MonthSwitcher value={month} onChange={setMonth} max={shiftMonth(currentMonth, 1)} />

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading budgets">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => (budgets.error ? budgets.retry() : expenses.retry())} />
      ) : !budget ? (
        <EmptyState
          icon={Gauge}
          title="No budget yet"
          description="Set an overall monthly limit and optional limits per category. It carries forward each month until you change it."
          action={
            <Button onClick={() => setEditing(true)} className="mt-2 h-11 rounded-xl px-5">
              Set a budget
            </Button>
          }
        />
      ) : (
        <>
          <SectionCard id="overall" title="Overall">
            {budget.overall ? (
              <BudgetProgressCard
                progress={budgetProgress(budget.overall, spent)}
                daysLeft={daysLeft}
                note={effective?.inherited ? `Carried over from ${formatMonth(budget.month)}.` : undefined}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No overall limit. Spent <Money amount={spent} className="font-medium text-foreground" /> so far.
              </p>
            )}
          </SectionCard>

          <SectionCard id="category-budgets" title="Categories">
            {hasCategoryLimits ? (
              <CategoryBudgetList limits={budget.categories} spentByCategory={spentByCategory} />
            ) : (
              <p className="text-sm text-muted-foreground">No category limits set.</p>
            )}
          </SectionCard>
        </>
      )}

      {budgets.status === "success" && expenses.status === "success" && budgets.data.length > 0 ? (
        <SectionCard id="budget-history" title="History">
          <ul className="space-y-3">
            {[...months].reverse().map((key) => {
              const b = effectiveBudget(budgets.data, key)?.budget;
              const monthSpent = expenses.get(key).expenseTotal;
              const progress = b?.overall ? budgetProgress(b.overall, monthSpent) : null;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setMonth(key)}
                    aria-current={key === month ? "true" : undefined}
                    className={cn(
                      "w-full space-y-1.5 rounded-xl p-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                      key === month && "bg-muted/60",
                    )}
                  >
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{formatMonth(key)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <Money amount={monthSpent} className="text-foreground" />
                        {progress ? (
                          <>
                            {" / "}
                            <Money amount={progress.limit} />
                            <span className={cn("ml-2 font-medium", progress.state === "over" && "text-destructive")}>
                              {progress.percent}%
                            </span>
                          </>
                        ) : (
                          " · no limit"
                        )}
                      </span>
                    </div>
                    {progress ? (
                      <ProgressBar value={progress.ratio} tone={STATE_TONE[progress.state]} size="sm" label={`${formatMonth(key)} budget used`} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      <BudgetSheet
        open={editing}
        onOpenChange={setEditing}
        month={month}
        current={budget}
        hasOwnBudget={Boolean(budget && !effective?.inherited)}
      />
    </div>
  );
}
