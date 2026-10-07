"use client";

import { Plus, Repeat, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Segmented } from "@/components/common/segmented";
import { Stat } from "@/components/common/stat";
import { ExpenseListSkeleton } from "@/components/expenses/expense-list-skeleton";
import { Button } from "@/components/ui/button";
import { useIncomeHistory, useIncomesForMonths } from "@/hooks/use-finance-queries";
import { sumAmounts } from "@/lib/analytics";
import { INCOME_SOURCE_META, INCOME_SOURCES } from "@/lib/constants/income";
import { type ExpectedIncome, pendingRecurring, salaryStats } from "@/lib/finance/income";
import { formatMoney } from "@/lib/money";
import { formatMonth, monthKey } from "@/lib/months";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useFinance } from "@/providers/finance-provider";
import type { Income, RecurringIncome } from "@/types";

import { ExpectedIncomeList } from "./expected-income-list";
import { IncomeListItem } from "./income-list-item";
import { IncomeSheet } from "./income-sheet";
import { IncomeSourceIcon } from "./income-source-icon";
import { RecordRecurringSheet } from "./record-recurring-sheet";
import { RecurringIncomeSheet } from "./recurring-income-sheet";

type Tab = "overview" | "salary" | "recurring";
const PAGE = 50;

export function IncomeView() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sheet, setSheet] = useState<{ open: boolean; income: Income | null }>({ open: false, income: null });
  const [recording, setRecording] = useState<ExpectedIncome | null>(null);
  const [recurringSheet, setRecurringSheet] = useState<{ open: boolean; template: RecurringIncome | null }>({
    open: false,
    template: null,
  });
  const openIncome = (income: Income | null) => setSheet({ open: true, income });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Income"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => openIncome(null)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Add
          </Button>
        }
      />
      <Segmented<Tab>
        name="income-tab"
        label="Income view"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "salary", label: "Salary" },
          { value: "recurring", label: "Recurring" },
        ]}
      />

      {tab === "overview" ? <Overview onSelect={openIncome} onRecord={setRecording} /> : null}
      {tab === "salary" ? <SalaryPanel onSelect={openIncome} onAdd={() => openIncome(null)} /> : null}
      {tab === "recurring" ? (
        <RecurringPanel
          onEdit={(template) => setRecurringSheet({ open: true, template })}
          onAdd={() => setRecurringSheet({ open: true, template: null })}
        />
      ) : null}

      <IncomeSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} income={sheet.income} />
      <RecordRecurringSheet expected={recording} onOpenChange={(open) => !open && setRecording(null)} />
      <RecurringIncomeSheet
        open={recurringSheet.open}
        onOpenChange={(open) => setRecurringSheet((s) => ({ ...s, open }))}
        template={recurringSheet.template}
      />
    </div>
  );
}

function Overview({ onSelect, onRecord }: { onSelect: (i: Income) => void; onRecord: (e: ExpectedIncome) => void }) {
  const [month] = useState(() => monthKey(new Date()));
  const [limit, setLimit] = useState(PAGE);
  const { recurringIncomes } = useFinance();
  const thisMonth = useIncomesForMonths(month, month);
  const history = useIncomeHistory(limit);

  const monthIncomes = thisMonth.data ?? [];
  const pending =
    recurringIncomes.status === "success" && thisMonth.status === "success"
      ? pendingRecurring(recurringIncomes.data, monthIncomes, month)
      : [];
  const bySource = INCOME_SOURCES.map((source) => ({
    source,
    total: sumAmounts(monthIncomes.filter((i) => i.source === source)),
  })).filter((s) => s.total > 0);

  const groups = useMemo(() => {
    const map = new Map<string, Income[]>();
    for (const income of history.data?.items ?? []) {
      const key = monthKey(income.receivedAt);
      map.set(key, [...(map.get(key) ?? []), income]);
    }
    return [...map.entries()];
  }, [history.data]);

  return (
    <div className="space-y-4">
      <SectionCard id="income-month" title={`${formatMonth(month)} income`}>
        {thisMonth.status === "loading" ? (
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        ) : (
          <>
            <p className="text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
              <Money amount={sumAmounts(monthIncomes)} />
            </p>
            {bySource.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {bySource.map(({ source, total }) => (
                  <li key={source} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {INCOME_SOURCE_META[source].label} · <Money amount={total} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </SectionCard>

      {pending.length ? (
        <SectionCard id="income-expected" title="Expected this month">
          <ExpectedIncomeList items={pending} onRecord={onRecord} />
        </SectionCard>
      ) : null}

      <section aria-labelledby="income-history-title" className="space-y-2">
        <h2 id="income-history-title" className="px-1 text-sm font-medium text-muted-foreground">
          History
        </h2>
        {history.status === "loading" ? <ExpenseListSkeleton rows={4} /> : null}
        {history.status === "error" ? <ErrorState error={history.error} onRetry={history.retry} /> : null}
        {history.status === "success" && history.data.items.length === 0 ? (
          <EmptyState icon={Wallet} title="No income recorded yet" description="Add your salary, freelance payments, bonuses and more." />
        ) : null}
        {groups.map(([key, items]) => (
          <section key={key} aria-labelledby={`income-${key}`}>
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <h3 id={`income-${key}`} className="font-medium text-muted-foreground">
                {formatMonth(key)}
              </h3>
              <Money amount={sumAmounts(items)} className="text-muted-foreground" />
            </div>
            <ul className="space-y-0.5">
              {items.map((income) => (
                <IncomeListItem key={income.id} income={income} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        ))}
        {history.status === "success" && history.data.hasMore ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setLimit((l) => l + PAGE)}>
              Load older income
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Growth({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1", up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      <Icon className="size-4" aria-hidden />
      {up ? "+" : ""}
      {(value * 100).toFixed(1)}%
    </span>
  );
}

function SalaryPanel({ onSelect, onAdd }: { onSelect: (i: Income) => void; onAdd: () => void }) {
  const { currency } = useSession();
  const salaries = useIncomeHistory(240, "salary");
  const stats = useMemo(() => salaryStats(salaries.data?.items ?? []), [salaries.data]);
  const chart = stats.months.slice(0, 12).reverse();
  const max = Math.max(...chart.map((m) => m.total), 1);

  if (salaries.status === "loading") return <ExpenseListSkeleton rows={4} grouped={false} />;
  if (salaries.status === "error") return <ErrorState error={salaries.error} onRetry={salaries.retry} />;
  if (stats.months.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Track your salary"
        description="Record each month's salary with its expected date to see growth, averages and whether it arrives on time."
        action={
          <Button onClick={onAdd} className="mt-2 h-11 rounded-xl px-5">
            Add salary
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Latest" value={<Money amount={stats.latest?.total ?? 0} />} hint={stats.latest ? formatMonth(stats.latest.month) : undefined} />
        <Stat label="Average" value={<Money amount={stats.average} />} hint={`${stats.months.length} months`} />
        <Stat label="vs previous month" value={<Growth value={stats.changeFromPrevious} />} />
        <Stat label="Overall growth" value={<Growth value={stats.growthOverall} />} hint={stats.months.length > 1 ? `since ${formatMonth(stats.months[stats.months.length - 1].month)}` : undefined} />
      </dl>

      {chart.length > 1 ? (
        <SectionCard id="salary-trend" title="Trend">
          <ol className="grid h-36 items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${chart.length}, minmax(0, 1fr))` }}>
            {chart.map((m) => (
              <li key={m.month} className="flex h-full flex-col items-center gap-1.5">
                <span className="sr-only">
                  {formatMonth(m.month)}: {formatMoney(m.total, currency)}
                </span>
                <div aria-hidden className="flex w-full flex-1 items-end justify-center">
                  <div className="w-full max-w-8 rounded-md bg-emerald-500/70" style={{ height: `${Math.max((m.total / max) * 100, 4)}%` }} />
                </div>
                <span aria-hidden className="text-[10px] text-muted-foreground">
                  {formatMonth(m.month, "short")}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}

      <SectionCard id="salary-history" title="Salary history">
        <ul className="divide-y">
          {stats.months.map((m) => (
            <li key={m.month}>
              <button
                type="button"
                onClick={() => onSelect(m.records[0])}
                className="flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <IncomeSourceIcon source="salary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{formatMonth(m.month)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Received {format(m.receivedAt, "d MMM")}
                    {m.expectedAt ? ` · expected ${format(m.expectedAt, "d MMM")}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <Money amount={m.total} className="block font-semibold" />
                  {m.daysLate !== null ? (
                    <span className={cn("text-xs", m.daysLate > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {m.daysLate > 0 ? `${m.daysLate}d late` : m.daysLate < 0 ? `${-m.daysLate}d early` : "On time"}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function RecurringPanel({ onEdit, onAdd }: { onEdit: (t: RecurringIncome) => void; onAdd: () => void }) {
  const { recurringIncomes } = useFinance();
  if (recurringIncomes.status === "loading") return <ExpenseListSkeleton rows={3} grouped={false} />;
  if (recurringIncomes.status === "error") return <ErrorState error={recurringIncomes.error} onRetry={recurringIncomes.retry} />;
  const templates = recurringIncomes.data;
  return (
    <div className="space-y-3">
      {templates.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring income"
          description="Add salary or any regular payment once — each month it shows up as expected so you can confirm it in one tap."
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex w-full items-center gap-3 p-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <IncomeSourceIcon source={t.source} className={cn(!t.active && "grayscale")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Monthly on day {t.dayOfMonth}
                    {t.active ? "" : " · Paused"}
                  </span>
                </span>
                <Money amount={t.amount} className="font-semibold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={onAdd} className="h-11 w-full rounded-xl">
        <Plus aria-hidden />
        Add recurring income
      </Button>
    </div>
  );
}
