"use client";

import { endOfMonth, min, startOfDay, startOfMonth, subDays } from "date-fns";
import { ArrowRight, BarChart3, Gauge, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CategoryBudgetList } from "@/components/budgets/category-budget-list";
import { SectionCard } from "@/components/common/section-card";
import { IncomeSheet } from "@/components/income/income-sheet";
import { useNetWorth } from "@/components/net-worth/use-net-worth";
import { UpcomingList } from "@/components/upcoming/upcoming-list";
import { useUpcoming } from "@/components/upcoming/use-upcoming";
import { GoalCard } from "@/components/wishlist/goal-card";

import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { ErrorState } from "@/components/common/error-state";
import { ExpenseListItem } from "@/components/expenses/expense-list-item";
import { Button } from "@/components/ui/button";
import { useExpenses } from "@/hooks/use-expenses";
import { useIncomesForMonths } from "@/hooks/use-finance-queries";
import { sumAmounts, summarizeDashboard } from "@/lib/analytics";
import { budgetProgress, effectiveBudget } from "@/lib/finance/budget";
import { goalProgress } from "@/lib/finance/goals";
import { monthKey } from "@/lib/months";
import { useSession } from "@/providers/auth-provider";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";
import { useFinance } from "@/providers/finance-provider";
import { useReminderList } from "@/providers/reminders-provider";
import { ReminderBell } from "@/components/reminders/reminder-center";

import { CategoryBreakdown } from "./category-breakdown";
import { DailySpending } from "./daily-spending";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { SpendingHero } from "./spending-hero";

/** Upper bound for one month of personal expenses; totals are flagged if exceeded. */
const DASHBOARD_LIMIT = 2000;

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardView() {
  const { user, profile } = useSession();
  const { openCreate } = useExpenseSheet();
  const [now] = useState(() => new Date());

  // One query covers both "this month" and "last 7 days" (which may cross into last month).
  const range = useMemo(
    () => ({
      from: min([startOfMonth(now), startOfDay(subDays(now, 6))]),
      to: endOfMonth(now),
    }),
    [now],
  );
  const result = useExpenses({ ...range, limit: DASHBOARD_LIMIT });
  const summary = useMemo(
    () => (result.status === "success" ? summarizeDashboard(result.expenses, now) : null),
    [result.status, result.expenses, now],
  );

  const firstName = (profile?.displayName ?? user.displayName ?? "").split(" ")[0];

  // Phase 2: income, budgets, EMIs and wishlist woven into the overview.
  const month = monthKey(now);
  const incomes = useIncomesForMonths(month, month);
  const { budgets, goals } = useFinance();
  const reminders = useReminderList();
  const upcoming = useUpcoming(14);
  const { netWorth, hasData: hasNetWorth } = useNetWorth();
  const [addingIncome, setAddingIncome] = useState(false);

  const monthIncome = sumAmounts((incomes.data ?? []).filter((i) => i.forMonth === month));
  const budget = budgets.data ? effectiveBudget(budgets.data, month)?.budget ?? null : null;
  const overallProgress = summary && budget?.overall ? budgetProgress(budget.overall, summary.month) : null;
  const spentByCategory = new Map(summary?.byCategory.map((c) => [c.categoryId, c.total]) ?? []);
  const activeGoals = (goals.data ?? []).filter((g) => g.status === "active" && !goalProgress(g).achieved).slice(0, 2);
  const hasAnything = (result.status === "success" && result.expenses.length > 0) || monthIncome > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting(now)}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {firstName ? `Hi, ${firstName}` : "Overview"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAddingIncome(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Income
          </Button>
          <ReminderBell reminders={reminders} className="md:hidden" />
        </div>
      </header>

      {result.status === "loading" ? <DashboardSkeleton /> : null}

      {result.status === "error" ? (
        <ErrorState error={result.error} onRetry={result.retry} />
      ) : null}

      {summary && result.status === "success" ? (
        !hasAnything ? (
          <EmptyState
            icon={Wallet}
            title="Your first expense is one tap away"
            description="Add what you spend as you go — amount, category, done. Your totals and trends will appear here."
            className="py-16"
            action={
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Button onClick={openCreate} className="h-11 rounded-xl px-5">
                  <Plus aria-hidden />
                  Add expense
                </Button>
                <Button variant="outline" onClick={() => setAddingIncome(true)} className="h-11 rounded-xl px-5">
                  Add income
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <SpendingHero summary={summary} month={now} income={monthIncome} budget={overallProgress} />
            <Link
              href="/analytics"
              className="flex items-center gap-3 rounded-3xl border bg-card p-4 text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BarChart3 className="size-5 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">Analytics & insights</span>
                <span className="block text-muted-foreground">Trends, categories and spending patterns</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            {netWorth && hasNetWorth ? (
              <Link
                href="/net-worth"
                className="flex items-center justify-between gap-3 rounded-3xl border bg-card p-4 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span>
                  <span className="block text-xs text-muted-foreground">Net worth</span>
                  <span className="block text-xl font-semibold tracking-tight">
                    {netWorth.netWorth < 0 ? "−" : ""}
                    <Money amount={Math.abs(netWorth.netWorth)} />
                  </span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  <span className="block">
                    Assets <Money amount={netWorth.assets.total} />
                  </span>
                  <span className="block">
                    Owe <Money amount={netWorth.liabilities.total} />
                  </span>
                </span>
              </Link>
            ) : null}
            {upcoming.items.length ? (
              <SectionCard id="upcoming" title="Coming up" href="/upcoming">
                <UpcomingList items={upcoming.items.slice(0, 5)} />
              </SectionCard>
            ) : null}
            {result.hasMore ? (
              <p className="text-xs text-muted-foreground">
                Showing the latest {DASHBOARD_LIMIT} expenses; totals may be incomplete.
              </p>
            ) : null}
            {budget && Object.keys(budget.categories).length ? (
              <SectionCard id="dash-budgets" title="Budgets" href="/budgets">
                <CategoryBudgetList limits={budget.categories} spentByCategory={spentByCategory} top={3} />
              </SectionCard>
            ) : !budget && budgets.status === "success" ? (
              <Link
                href="/budgets"
                className="flex items-center gap-3 rounded-3xl border border-dashed p-4 text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Gauge className="size-5 text-primary" aria-hidden />
                <span className="flex-1">
                  <span className="block font-medium">Set a monthly budget</span>
                  <span className="block text-muted-foreground">See how much you have left as you spend.</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <DailySpending days={summary.last7Days} />
              <CategoryBreakdown totals={summary.byCategory} />
            </div>
            {activeGoals.length ? (
              <SectionCard id="dash-wishlist" title="Wishlist" href="/wishlist">
                <ul className="space-y-2">
                  {activeGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} compact />
                  ))}
                </ul>
              </SectionCard>
            ) : null}
            <section aria-labelledby="recent-title" className="rounded-3xl border bg-card p-2">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <h2 id="recent-title" className="font-semibold">
                  Recent
                </h2>
                <Link
                  href="/expenses"
                  className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  See all <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              {result.expenses.length ? (
                <ul className="space-y-0.5">
                  {result.expenses.slice(0, 5).map((expense) => (
                    <ExpenseListItem key={expense.id} expense={expense} showDate />
                  ))}
                </ul>
              ) : (
                <p className="px-3 pb-3 text-sm text-muted-foreground">No expenses this month yet.</p>
              )}
            </section>
          </>
        )
      ) : null}

      <IncomeSheet open={addingIncome} onOpenChange={setAddingIncome} />
    </div>
  );
}
