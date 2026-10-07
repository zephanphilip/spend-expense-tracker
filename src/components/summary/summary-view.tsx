"use client";

import { format } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { STATE_TONE } from "@/components/budgets/budget-progress-card";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { MonthSwitcher } from "@/components/common/month-switcher";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SectionCard } from "@/components/common/section-card";
import { Stat } from "@/components/common/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { INCOME_SOURCE_META, INCOME_SOURCES } from "@/lib/constants/income";
import type { MonthSummary } from "@/lib/finance/summary";
import { formatMoney } from "@/lib/money";
import { formatMonth, monthKey } from "@/lib/months";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

import { useMonthSummaries } from "./use-month-summaries";

const TREND_MONTHS = 6;

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function SummaryView() {
  const [currentMonth] = useState(() => monthKey(new Date()));
  const [month, setMonth] = useState(currentMonth);
  const data = useMonthSummaries(month, TREND_MONTHS);
  const summary = data.summaries?.at(-1) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader title="Monthly summary" back={{ href: "/plan", label: "Plan" }} />
      <MonthSwitcher value={month} onChange={setMonth} max={currentMonth} />

      {data.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading summary">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      ) : data.status === "error" ? (
        <ErrorState error={data.error} onRetry={data.retry} />
      ) : summary ? (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Income" value={<Money amount={summary.income} className="text-emerald-600 dark:text-emerald-400" />} />
            <Stat label="Expenses" value={<Money amount={summary.expenses} />} />
            <Stat
              label={summary.income > 0 && summary.savings < 0 ? "Overspent" : "Saved"}
              value={
                summary.income > 0 ? (
                  <Money amount={Math.abs(summary.savings)} className={summary.savings < 0 ? "text-destructive" : undefined} />
                ) : (
                  "—"
                )
              }
            />
            <Stat label="Savings rate" value={formatRate(summary.savingsRate)} hint={summary.income === 0 ? "No income recorded" : undefined} />
          </dl>

          <SectionCard id="summary-budget" title="Budget utilisation" href="/budgets" linkLabel="Budgets">
            {summary.budget ? (
              <div className="space-y-2">
                <ProgressBar value={summary.budget.ratio} tone={STATE_TONE[summary.budget.state]} label="Budget used" />
                <p className="text-sm text-muted-foreground">
                  <span className={cn("font-semibold text-foreground", summary.budget.state === "over" && "text-destructive")}>
                    {summary.budget.percent}%
                  </span>{" "}
                  of <Money amount={summary.budget.limit} /> used
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No overall budget for {formatMonth(month)}. <Link href="/budgets" className="font-medium text-foreground underline-offset-4 hover:underline">Set one</Link>
              </p>
            )}
          </SectionCard>

          <SectionCard id="summary-emi" title="EMI obligations" href="/emis" linkLabel="EMIs">
            {summary.emi.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No EMIs due in {formatMonth(month)}.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  <Money amount={summary.emi.total} className="font-semibold text-foreground" /> due ·{" "}
                  <Money amount={summary.emi.paid} /> paid
                  {summary.income > 0 ? ` · ${Math.round((summary.emi.total / summary.income) * 100)}% of income` : ""}
                </p>
                <ul className="space-y-2">
                  {summary.emi.items.map((o) => (
                    <li key={o.emi.id} className="flex items-center gap-2 text-sm">
                      {o.paid ? (
                        <CheckCircle2 className="size-4 text-emerald-500" aria-label="Paid" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" aria-label="Not paid" />
                      )}
                      <span className="flex-1 truncate">
                        {o.emi.name} <span className="text-muted-foreground">· due {format(o.dueDate, "d MMM")}</span>
                      </span>
                      <Money amount={o.amount} className="font-medium" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>

          <IncomeBreakdown bySource={data.incomeBySource(month)} />

          {data.summaries ? <Trend summaries={data.summaries} selected={month} onSelect={setMonth} /> : null}

          <p className="px-1 text-xs text-muted-foreground">
            Savings = income − expenses. EMI payments count as expenses when logged from the EMI screen.
          </p>
        </>
      ) : null}
    </div>
  );
}

function IncomeBreakdown({ bySource }: { bySource: Record<string, number> }) {
  const rows = INCOME_SOURCES.map((s) => ({ source: s, total: bySource[s] ?? 0 })).filter((r) => r.total > 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (!rows.length) return null;
  return (
    <SectionCard id="summary-income" title="Income by source" href="/income" linkLabel="Income">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.source} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{INCOME_SOURCE_META[r.source].label}</span>
              <Money amount={r.total} className="font-medium" />
            </div>
            <ProgressBar value={r.total / total} tone="ok" size="sm" label={`${INCOME_SOURCE_META[r.source].label} share`} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Trend({ summaries, selected, onSelect }: { summaries: MonthSummary[]; selected: string; onSelect: (m: string) => void }) {
  const { currency } = useSession();
  const max = Math.max(...summaries.flatMap((s) => [s.income, s.expenses]), 1);
  return (
    <SectionCard id="summary-trend" title={`Last ${summaries.length} months`}>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden /> Income</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/60" aria-hidden /> Expenses</span>
      </div>
      <ol className="grid h-44 items-end gap-2" style={{ gridTemplateColumns: `repeat(${summaries.length}, minmax(0, 1fr))` }}>
        {summaries.map((s) => (
          <li key={s.month} className="h-full">
            <button
              type="button"
              onClick={() => onSelect(s.month)}
              aria-current={s.month === selected ? "true" : undefined}
              aria-label={`${formatMonth(s.month)}: income ${formatMoney(s.income, currency)}, expenses ${formatMoney(s.expenses, currency)}, savings rate ${formatRate(s.savingsRate)}`}
              className={cn(
                "flex h-full w-full flex-col items-center gap-1.5 rounded-xl p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                s.month === selected && "bg-muted/70",
              )}
            >
              <span className="flex w-full flex-1 items-end justify-center gap-0.5" aria-hidden>
                <span className="w-1/3 max-w-4 rounded-t bg-emerald-500" style={{ height: `${(s.income / max) * 100}%` }} />
                <span className="w-1/3 max-w-4 rounded-t bg-primary/60" style={{ height: `${(s.expenses / max) * 100}%` }} />
              </span>
              <span className="text-[10px] font-medium text-muted-foreground" aria-hidden>
                {formatMonth(s.month, "short")}
              </span>
              <span className={cn("text-[10px] tabular-nums", s.savingsRate !== null && s.savingsRate < 0 ? "text-destructive" : "text-muted-foreground")} aria-hidden>
                {formatRate(s.savingsRate)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
