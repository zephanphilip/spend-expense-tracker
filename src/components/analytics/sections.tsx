"use client";

import { format } from "date-fns";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountIcon } from "@/components/accounts/account-icon";
import { utilizationTone } from "@/components/accounts/card-summary";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import { STATE_TONE } from "@/components/budgets/budget-progress-card";
import { useNetWorthHistory } from "@/hooks/use-finance-queries";
import type { Insight } from "@/lib/analytics/insights";
import { change, type Change } from "@/lib/analytics/metrics";
import type { ResolvedPeriod } from "@/lib/analytics/period";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { INVESTMENT_KIND_LABELS, INVESTMENT_KINDS } from "@/lib/constants/accounts";
import { PAYMENT_METHOD_META } from "@/lib/constants/payment-methods";
import { availableCredit, cardOutstanding, cardUtilization } from "@/lib/finance/accounts";
import { goalProgress } from "@/lib/finance/goals";
import { portfolioTotals } from "@/lib/finance/investments";
import { frequencyLabel } from "@/lib/finance/recurrence";
import { formatMoney } from "@/lib/money";
import { formatMonth } from "@/lib/months";
import { NO_ACCOUNT } from "@/lib/stats/monthly";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";
import type { PaymentMethod } from "@/types";

import { ChartCard } from "./chart-card";
import { BarList, ChangeChip, Donut, Heatmap, IncomeExpenseBars, LineSeries, SimpleBars, StackedCategoryBars, TrendChart } from "./charts";
import { KIND_COLORS, METHOD_COLORS, OTHER_COLOR, SERIES } from "./palette";
import type { useAnalyticsModel } from "./use-analytics-model";

type Model = ReturnType<typeof useAnalyticsModel>["model"];
interface SectionProps {
  model: Model;
  period: ResolvedPeriod;
  compare: boolean;
}

const pct = (r: number | null, digits = 0) => (r === null ? "—" : `${(r * 100).toFixed(digits)}%`);

function Kpi({ label, value, change: c, invert, hint }: { label: string; value: ReactNode; change?: Change | null; invert?: boolean; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tracking-tight tabular-nums">{value}</span>
        {c ? <ChangeChip change={c} invert={invert} /> : null}
      </dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function useCategoryColor() {
  const { getCategory } = useCategories();
  return (id: string) => (id === "__other__" ? OTHER_COLOR : CATEGORY_COLORS[getCategory(id).color].hex);
}

const TONE_ICON = { warning: AlertTriangle, positive: CheckCircle2, neutral: Info } as const;
const TONE_CLASS = {
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  positive: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  neutral: "bg-primary/10 text-primary",
} as const;

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const list = limit ? insights.slice(0, limit) : insights;
  if (!list.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="size-4" aria-hidden />
        Nothing stands out for this period — insights appear when a rule&apos;s threshold is crossed.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {list.map((i) => {
        const Icon = TONE_ICON[i.tone];
        const body = (
          <>
            <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONE_CLASS[i.tone])}>
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                <span className="sr-only">{i.tone === "warning" ? "Attention: " : i.tone === "positive" ? "Good: " : "Note: "}</span>
                {i.title}
              </span>
              <span className="block text-xs text-muted-foreground">{i.detail}</span>
            </span>
            {i.href ? <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </>
        );
        return (
          <li key={i.id}>
            {i.href ? (
              <Link href={i.href} className="flex items-start gap-3 rounded-xl outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function OverviewSection({ model: m, period, compare, onSeeInsights }: SectionProps & { onSeeInsights: () => void }) {
  const { currency } = useSession();
  const color = useCategoryColor();
  const { getCategory } = useCategories();
  const granularityLabel = m.trend.granularity === "day" ? "per day" : m.trend.granularity === "week" ? "per week" : "per month";
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label={m.filtered ? "Filtered spending" : "Total spending"} value={<Money amount={m.current.total} />} change={compare ? m.spending : null} hint={compare ? <>vs <Money amount={m.previous.total} /> {period.previous.label}</> : `${m.current.count} expenses`} />
        <Kpi label="Average per day" value={<Money amount={m.avgPerDay} />} change={compare ? change(m.avgPerDay, m.prevAvgPerDay) : null} hint={`over ${period.elapsedDays} days`} />
        {m.filtered ? (
          <Kpi label="Transactions" value={m.current.count} change={compare ? change(m.current.count, m.previous.count) : null} />
        ) : (
          <>
            <Kpi label="Income" value={<Money amount={m.income} />} hint="by month it's for" />
            <Kpi
              label={m.income > 0 && m.savings < 0 ? "Overspent" : "Saved"}
              value={m.income > 0 ? <Money amount={Math.abs(m.savings)} /> : "—"}
              hint={m.savingsRate !== null ? `${pct(m.savingsRate)} savings rate` : "No income recorded"}
            />
          </>
        )}
      </dl>

      <ChartCard
        title="Spending trend"
        subtitle={`${period.label} · ${granularityLabel}`}
        legend={compare ? [{ label: "This period", color: "var(--series-expense)" }, { label: `Previous (${period.previous.label})`, color: "var(--series-previous)", dashed: true }] : undefined}
        table={{ columns: ["Period", "Spent", ...(compare ? ["Previous"] : [])], rows: m.trend.points.map((p) => [p.title, formatMoney(p.current, currency), ...(compare ? [p.previous === undefined ? "—" : formatMoney(p.previous, currency)] : [])]) }}
      >
        <TrendChart points={m.trend.points} showPrevious={compare} />
      </ChartCard>

      <section aria-labelledby="top-insights" className="rounded-3xl border bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="top-insights" className="font-semibold">Insights</h3>
          {m.insights.length > 3 ? (
            <button type="button" onClick={onSeeInsights} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              All {m.insights.length} <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <InsightList insights={m.insights} limit={3} />
      </section>

      <ChartCard title="Top categories" subtitle={compare ? `Change vs ${period.previous.label}` : undefined}>
        <BarList
          rows={m.categories.slice(0, 5).map((r) => ({
            key: r.key,
            label: r.key === "__other__" ? "Other" : getCategory(r.key).name,
            value: r.total,
            share: r.share,
            color: color(r.key),
            icon: r.key === "__other__" ? undefined : <CategoryIcon category={getCategory(r.key)} size="sm" />,
            change: compare ? r.change : undefined,
          }))}
        />
      </ChartCard>
    </div>
  );
}

export function SpendingSection({ model: m, period, compare }: SectionProps) {
  const { currency } = useSession();
  const { getCategory } = useCategories();
  const accounts = useAccounts();
  const color = useCategoryColor();
  const catName = (k: string) => (k === "__other__" ? "Other" : getCategory(k).name);
  const busiest = Math.max(...m.weekdays.map((w) => w.average));
  const latestBudget = [...m.budgets].reverse().find((b) => b.overall || b.overCategories.length);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Category breakdown"
        subtitle={compare ? `Change vs ${period.previous.label}` : period.label}
        className="lg:col-span-2"
        table={{ columns: ["Category", "Spent", "Share", ...(compare ? ["Previous", "Change"] : [])], rows: m.categories.map((r) => [catName(r.key), formatMoney(r.total, currency), pct(r.share), ...(compare ? [formatMoney(r.previous, currency), r.change.ratio === null ? "—" : `${r.change.delta >= 0 ? "+" : "−"}${pct(Math.abs(r.change.ratio))}`] : [])]) }}
      >
        {m.categories.length ? (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Donut total={m.current.total} slices={m.categories.map((r) => ({ key: r.key, label: catName(r.key), value: r.total, color: color(r.key) }))} />
            <div className="w-full flex-1">
              <BarList rows={m.categories.map((r) => ({ key: r.key, label: catName(r.key), value: r.total, share: r.share, color: color(r.key), change: compare ? r.change : undefined }))} />
            </div>
          </div>
        ) : (
          <Empty />
        )}
      </ChartCard>

      {!m.filtered && m.categoryTrend.keys.length ? (
        <ChartCard
          title="Category trends"
          subtitle="Top 5 categories by month (all spending)"
          className="lg:col-span-2"
          legend={[...m.categoryTrend.keys.map((k) => ({ label: catName(k), color: color(k) })), ...(m.categoryTrend.hasOther ? [{ label: "Other", color: OTHER_COLOR }] : [])]}
          table={{ columns: ["Month", ...m.categoryTrend.keys.map(catName), "Other"], rows: m.categoryTrend.rows.map((r) => [String(r.label), ...m.categoryTrend.keys.map((k) => formatMoney(Number(r[k] ?? 0), currency)), formatMoney(Number(r.__other__ ?? 0), currency)]) }}
        >
          <StackedCategoryBars rows={m.categoryTrend.rows} keys={[...m.categoryTrend.keys, ...(m.categoryTrend.hasOther ? ["__other__"] : [])]} colorOf={color} nameOf={catName} />
        </ChartCard>
      ) : null}

      <ChartCard title="Daily spending" subtitle={`${m.days.length} days`} table={{ columns: ["Day", "Spent"], rows: m.days.map((d) => [format(d.date, "EEE d MMM"), formatMoney(d.total, currency)]) }}>
        <SimpleBars data={m.days.slice(-62).map((d) => ({ key: d.key, label: format(d.date, "d"), title: format(d.date, "EEE d MMM"), value: d.total }))} />
      </ChartCard>

      <ChartCard title="Weekly spending" subtitle="Monday–Sunday weeks" table={{ columns: ["Week of", "Spent", "Days"], rows: m.weekly.map((w) => [format(w.weekStart, "d MMM"), formatMoney(w.total, currency), w.days]) }}>
        <SimpleBars data={m.weekly.map((w) => ({ key: w.weekStart.toISOString(), label: format(w.weekStart, "d MMM"), title: `Week of ${format(w.weekStart, "d MMM")}${w.days < 7 ? ` (${w.days} days)` : ""}`, value: w.total }))} />
      </ChartCard>

      <ChartCard title="Spending by weekday" subtitle="Average per day" table={{ columns: ["Weekday", "Average", "Total", "Days"], rows: m.weekdays.map((w) => [w.label, formatMoney(w.average, currency), formatMoney(w.total, currency), w.days]) }}>
        <SimpleBars emphasis valueName="Average" data={m.weekdays.map((w) => ({ label: w.label, value: w.average, highlight: w.average === busiest && busiest > 0 }))} />
      </ChartCard>

      <ChartCard title="Spending calendar" subtitle="Each square is a day">
        {m.heat.length ? <Heatmap weeks={m.heat} /> : <Empty />}
      </ChartCard>

      <ChartCard title="Payment methods" table={{ columns: ["Method", "Spent", "Share"], rows: m.methods.map((r) => [PAYMENT_METHOD_META[r.key as PaymentMethod]?.label ?? r.key, formatMoney(r.total, currency), pct(r.share)]) }}>
        {m.methods.length ? (
          <BarList rows={m.methods.map((r) => ({ key: r.key, label: PAYMENT_METHOD_META[r.key as PaymentMethod]?.label ?? r.key, value: r.total, share: r.share, color: METHOD_COLORS[r.key as PaymentMethod] ?? OTHER_COLOR, change: compare ? r.change : undefined }))} />
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="By account" subtitle="Expenses paid from each account">
        {m.accountsBreakdown.length ? (
          <BarList
            rows={m.accountsBreakdown.map((r) => {
              const a = accounts.get(r.key);
              const idx = accounts.all.findIndex((x) => x.id === r.key);
              return {
                key: r.key,
                label: r.key === NO_ACCOUNT ? "Not linked to an account" : r.key === "__other__" ? "Other" : a?.name ?? "Deleted account",
                value: r.total,
                share: r.share,
                color: idx >= 0 ? SERIES[idx % SERIES.length] : OTHER_COLOR,
                icon: a ? <AccountIcon type={a.type} size="sm" /> : undefined,
                change: compare ? r.change : undefined,
              };
            })}
          />
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Budget utilisation" subtitle="Per month in this period" className="lg:col-span-2">
        {m.budgets.some((b) => b.overall) ? (
          <ul className="space-y-3">
            {m.budgets.filter((b) => b.overall).map((b) => (
              <li key={b.month} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{formatMonth(b.month)}</span>
                  <span className={cn("tabular-nums", b.overall!.state === "over" && "font-medium text-destructive")}>
                    <Money amount={b.overall!.spent} /> / <Money amount={b.overall!.limit} /> · {b.overall!.percent}%
                  </span>
                </div>
                <ProgressBar value={b.overall!.ratio} tone={STATE_TONE[b.overall!.state]} size="sm" label={`${formatMonth(b.month)} budget used`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No budget set. <Link href="/budgets" className="font-medium text-foreground underline-offset-4 hover:underline">Set one</Link> to track utilisation.
          </p>
        )}
        {latestBudget?.overCategories.length ? (
          <div className="mt-4 space-y-2 border-t pt-3">
            <h4 className="text-sm font-medium">Over budget in {formatMonth(latestBudget.month)}</h4>
            <ul className="space-y-2">
              {latestBudget.overCategories.map((c) => (
                <li key={c.categoryId} className="flex items-center gap-3 text-sm">
                  <CategoryIcon category={getCategory(c.categoryId)} size="sm" />
                  <span className="flex-1">{getCategory(c.categoryId).name}</span>
                  <span className="font-medium text-destructive tabular-nums">
                    <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
                    <Money amount={-c.progress.remaining} /> over ({c.progress.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ChartCard>
    </div>
  );
}

export function CashFlowSection({ model: m }: SectionProps) {
  const { currency } = useSession();
  const { getCategory } = useCategories();
  const rate = m.months12.map((p) => ({ label: p.label, value: p.savingsRate }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Income vs expenses"
        subtitle="Last 12 months · all spending"
        className="lg:col-span-2"
        legend={[{ label: "Income", color: "var(--series-income)" }, { label: "Expenses", color: "var(--series-expense)" }]}
        table={{ columns: ["Month", "Income", "Expenses", "Savings", "Rate"], rows: m.months12.map((p) => [formatMonth(p.month), formatMoney(p.income, currency), formatMoney(p.expenses, currency), formatMoney(p.savings, currency), pct(p.savingsRate)]) }}
      >
        <IncomeExpenseBars points={m.months12} />
      </ChartCard>

      <ChartCard title="Savings rate" subtitle="(income − expenses) ÷ income, by month" table={{ columns: ["Month", "Savings", "Rate"], rows: m.months12.map((p) => [formatMonth(p.month), formatMoney(p.savings, currency), pct(p.savingsRate, 1)]) }}>
        <LineSeries points={rate} name="Savings rate" percent color="var(--series-income)" />
      </ChartCard>

      <ChartCard title="Debt & commitments" subtitle={m.avgIncome ? <>vs average income <Money amount={m.avgIncome} />/month</> : "Add income to see burden ratios"}>
        <dl className="space-y-4">
          {[
            { label: "EMI burden", burden: m.emi, href: "/emis", warn: 0.4 },
            { label: "Recurring payments", burden: m.recurring, href: "/recurring", warn: 0.25 },
          ].map(({ label, burden, href, warn }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <dt>
                  <Link href={href} className="hover:underline">{label}</Link>
                </dt>
                <dd className="tabular-nums">
                  <Money amount={burden.monthly} className="font-medium" />/mo{burden.ofIncome !== null ? ` · ${pct(burden.ofIncome)} of income` : ""}
                </dd>
              </div>
              {burden.ofIncome !== null ? (
                <ProgressBar value={burden.ofIncome} tone={burden.ofIncome >= warn ? "warning" : "ok"} size="sm" label={`${label} as share of income`} />
              ) : null}
            </div>
          ))}
        </dl>
      </ChartCard>

      <ChartCard
        title="Subscriptions & recurring"
        subtitle={<>Annualised: <Money amount={m.subscriptions.annual} className="font-medium text-foreground" /> a year</>}
        className="lg:col-span-2"
        table={{ columns: ["Payment", "Frequency", "Monthly", "Yearly"], rows: m.subscriptions.items.map((s) => [s.payment.name, frequencyLabel(s.payment.unit, s.payment.interval), formatMoney(s.monthly, currency), formatMoney(s.annual, currency)]) }}
      >
        {m.subscriptions.items.length ? (
          <ul className="divide-y">
            {m.subscriptions.items.map((s) => (
              <li key={s.payment.id} className="flex items-center gap-3 py-2.5">
                <CategoryIcon category={getCategory(s.payment.categoryId)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.payment.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <Money amount={s.payment.amount} /> · {frequencyLabel(s.payment.unit, s.payment.interval)}
                  </span>
                </span>
                <span className="text-right text-sm">
                  <Money amount={s.annual} className="block font-semibold" />
                  <span className="text-[11px] text-muted-foreground">per year</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recurring payments. <Link href="/recurring" className="font-medium text-foreground underline-offset-4 hover:underline">Add one</Link>.
          </p>
        )}
      </ChartCard>
    </div>
  );
}

export function WealthSection({ model: m, netWorth }: SectionProps & { netWorth: ReturnType<typeof useAnalyticsModel>["netWorth"] }) {
  const { currency } = useSession();
  const finance = useFinance();
  const history = useNetWorthHistory();
  const investments = finance.investments.data ?? [];
  const totals = portfolioTotals(investments);
  const byKind = INVESTMENT_KINDS.map((kind) => ({ kind, value: investments.filter((i) => i.status === "active" && i.kind === kind).reduce((s, i) => s + i.currentValue, 0) })).filter((k) => k.value > 0);
  const goals = (finance.goals.data ?? []).filter((g) => g.status === "active");
  const snapshots = history.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Net worth trend"
        subtitle={netWorth.netWorth ? <>Now <Money amount={netWorth.netWorth.netWorth} className="font-medium text-foreground" /></> : undefined}
        className="lg:col-span-2"
        table={{ columns: ["Month", "Assets", "Liabilities", "Net worth"], rows: snapshots.map((s) => [formatMonth(s.month), formatMoney(s.assets, currency), formatMoney(s.liabilities, currency), formatMoney(s.netWorth, currency)]) }}
      >
        {snapshots.length > 1 ? (
          <LineSeries points={snapshots.map((s) => ({ label: format(new Date(`${s.month}-01T00:00:00`), "MMM"), value: s.netWorth }))} name="Net worth" />
        ) : (
          <p className="text-sm text-muted-foreground">
            The trend builds from monthly snapshots saved when you open <Link href="/net-worth" className="font-medium text-foreground underline-offset-4 hover:underline">Net worth</Link>.
          </p>
        )}
      </ChartCard>

      <ChartCard title="Investments" subtitle={investments.length ? <>Value <Money amount={totals.current} className="font-medium text-foreground" /> · invested <Money amount={totals.invested} /></> : undefined}>
        {investments.length ? (
          <>
            <p className={cn("mb-3 text-sm font-medium", totals.absolute >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {totals.absolute >= 0 ? "+" : "−"}
              <Money amount={Math.abs(totals.absolute)} /> ({pct(totals.ratio, 1)}) unrealised
              {totals.realized ? <span className="font-normal text-muted-foreground"> · realised <Money amount={totals.realized} /></span> : null}
            </p>
            <BarList rows={byKind.map((k) => ({ key: k.kind, label: INVESTMENT_KIND_LABELS[k.kind], value: k.value, share: totals.current ? k.value / totals.current : 0, color: KIND_COLORS[k.kind] }))} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No investments tracked. <Link href="/investments" className="font-medium text-foreground underline-offset-4 hover:underline">Add one</Link>.
          </p>
        )}
      </ChartCard>

      <ChartCard title="Credit card utilisation" subtitle="Outstanding ÷ limit">
        {m.cards.length ? (
          <ul className="space-y-3">
            {m.cards.map((c) => {
              const u = cardUtilization(c);
              return (
                <li key={c.id} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <AccountIcon type="credit_card" size="sm" />
                      {c.name}
                    </span>
                    <span className="tabular-nums">
                      <Money amount={cardOutstanding(c)} /> · {pct(u)}
                    </span>
                  </div>
                  {u !== null ? <ProgressBar value={u} tone={utilizationTone(u)} size="sm" label={`${c.name} utilisation`} /> : null}
                  {availableCredit(c) !== null ? <p className="text-[11px] text-muted-foreground"><Money amount={availableCredit(c)!} /> available</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No credit cards added.</p>
        )}
      </ChartCard>

      <ChartCard title="Wishlist progress" className="lg:col-span-2">
        {goals.length ? (
          <ul className="space-y-3">
            {goals.map((g) => {
              const p = goalProgress(g);
              return (
                <li key={g.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Link href={`/wishlist/${g.id}`} className="truncate hover:underline">{g.name}</Link>
                    <span className="shrink-0 tabular-nums">
                      <Money amount={g.savedAmount} /> / <Money amount={g.targetAmount} /> · {p.percent}%
                    </span>
                  </div>
                  <ProgressBar value={p.ratio} colorClassName={p.achieved ? "bg-emerald-500" : CATEGORY_COLORS[g.color].solid} size="sm" label={`${g.name} saved`} />
                  {p.perMonth ? <p className="text-[11px] text-muted-foreground">Save <Money amount={p.perMonth} />/month to finish by {g.targetDate ? format(g.targetDate, "MMM yyyy") : "the target"}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active wishes.</p>
        )}
      </ChartCard>
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">No spending in this period.</p>;
}
