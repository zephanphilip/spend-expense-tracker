"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { useNetWorth } from "@/components/net-worth/use-net-worth";
import { PLAN_ITEMS, PLAN_SECTIONS } from "@/components/layout/nav-items";
import { useUpcoming } from "@/components/upcoming/use-upcoming";
import { formatRate } from "@/components/summary/summary-view";
import { useMonthSummaries } from "@/components/summary/use-month-summaries";
import { Skeleton } from "@/components/ui/skeleton";
import { cardOutstanding } from "@/lib/finance/accounts";
import { goalProgress } from "@/lib/finance/goals";
import { portfolioTotals } from "@/lib/finance/investments";
import { upcomingOutflow } from "@/lib/finance/upcoming";
import { formatMonth, monthKey } from "@/lib/months";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";
import { useFinance } from "@/providers/finance-provider";

export function PlanView() {
  const [month] = useState(() => monthKey(new Date()));
  const data = useMonthSummaries(month, 1);
  const summary = data.summaries?.[0] ?? null;
  const { emis, goals, accounts, investments, recurringPayments } = useFinance();
  const { netWorth, hasData } = useNetWorth();
  const upcoming = useUpcoming(30);
  const { customCategories } = useCategories();

  const activeGoals = (goals.data ?? []).filter((g) => g.status === "active");
  const activeEmis = (emis.data ?? []).filter((e) => e.status === "active");
  const reached = activeGoals.filter((g) => goalProgress(g).achieved).length;

  const stats: Record<string, ReactNode> = {
    "/summary": summary ? (summary.savingsRate === null ? "No income recorded yet" : <>Saved {formatRate(summary.savingsRate)} of income</>) : null,
    "/budgets": summary?.budget ? (
      <span className={cn(summary.budget.state === "over" && "text-destructive", summary.budget.state === "warning" && "text-amber-600 dark:text-amber-400")}>
        {summary.budget.percent}% used
      </span>
    ) : summary ? (
      "No budget set"
    ) : null,
    "/income": summary ? <><Money amount={summary.income} /> this month</> : null,
    "/emis": summary ? (
      activeEmis.length ? <><Money amount={summary.emi.pending} /> due · {activeEmis.length} active</> : "No active loans"
    ) : null,
    "/wishlist": goals.data ? (
      activeGoals.length ? `${activeGoals.length} ${activeGoals.length === 1 ? "wish" : "wishes"}${reached ? ` · ${reached} reached` : ""}` : "Nothing yet"
    ) : null,
    "/categories": `${customCategories.filter((c) => !c.archived).length} custom`,
    "/upcoming":
      upcoming.status === "success"
        ? upcoming.items.length
          ? <>{upcoming.items.filter((i) => i.overdue).length ? `${upcoming.items.filter((i) => i.overdue).length} overdue · ` : ""}<Money amount={upcomingOutflow(upcoming.items)} /> due in 30 days</>
          : "Nothing due"
        : null,
    "/accounts": accounts.data
      ? accounts.data.length
        ? <><Money amount={accounts.data.filter((a) => a.type !== "credit_card" && a.active).reduce((s, a) => s + a.balance, 0)} /> · <Money amount={accounts.data.reduce((s, a) => s + (a.type === "credit_card" ? cardOutstanding(a) : 0), 0)} /> on cards</>
        : "No accounts yet"
      : null,
    "/investments": investments.data
      ? investments.data.length
        ? (() => {
            const t = portfolioTotals(investments.data);
            return <><Money amount={t.current} />{t.ratio !== null ? ` · ${t.absolute >= 0 ? "+" : ""}${(t.ratio * 100).toFixed(1)}%` : ""}</>;
          })()
        : "Nothing tracked yet"
      : null,
    "/net-worth": netWorth && hasData ? <>{netWorth.netWorth < 0 ? "−" : ""}<Money amount={Math.abs(netWorth.netWorth)} /></> : hasData ? null : "Add accounts to start",
    "/analytics": "Trends, categories, heatmap, insights",
    "/data": "Bring in bank statements · back up as CSV",
    "/recurring": recurringPayments.data ? `${recurringPayments.data.filter((p) => p.active).length} active` : null,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Plan" description={`Your money in ${formatMonth(month)}`} />

      <section aria-label="This month" className="grid grid-cols-3 gap-2 rounded-3xl bg-primary p-5 text-primary-foreground">
        {summary ? (
          <>
            <div>
              <p className="text-xs text-primary-foreground/70">Income</p>
              <p className="mt-0.5 font-semibold"><Money amount={summary.income} /></p>
            </div>
            <div>
              <p className="text-xs text-primary-foreground/70">Spent</p>
              <p className="mt-0.5 font-semibold"><Money amount={summary.expenses} /></p>
            </div>
            <div>
              <p className="text-xs text-primary-foreground/70">{summary.income > 0 && summary.savings < 0 ? "Overspent" : "Saved"}</p>
              <p className="mt-0.5 font-semibold">{summary.income > 0 ? <Money amount={Math.abs(summary.savings)} /> : "—"}</p>
            </div>
          </>
        ) : (
          <Skeleton className="col-span-3 h-10 bg-primary-foreground/20" />
        )}
      </section>

      <nav aria-label="Plan" className="space-y-5">
        {PLAN_SECTIONS.map((section) => (
          <section key={section} aria-labelledby={`plan-${section}`} className="space-y-2">
            <h2 id={`plan-${section}`} className="px-1 text-sm font-medium text-muted-foreground">
              {section}
            </h2>
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {PLAN_ITEMS.filter((i) => i.section === section).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 active:bg-muted"
                    >
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{stats[item.href] ?? item.description}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
