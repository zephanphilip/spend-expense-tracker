"use client";

import { Loader2 } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { type AnalyticsFilters, NO_FILTERS } from "@/lib/analytics/dataset";
import { type AnalyticsPeriod, resolvePeriod } from "@/lib/analytics/period";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { FilterButton, PeriodPicker } from "./analytics-controls";
import { CashFlowSection, InsightList, OverviewSection, SpendingSection, WealthSection } from "./sections";
import { RAW_LIMIT } from "./use-analytics";
import { useAnalyticsModel } from "./use-analytics-model";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "spending", label: "Spending" },
  { id: "cashflow", label: "Cash flow" },
  { id: "wealth", label: "Wealth" },
  { id: "insights", label: "Insights" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AnalyticsView() {
  const [preset, setPreset] = useState<AnalyticsPeriod>("this-month");
  const [custom, setCustom] = useState(() => {
    const now = new Date();
    return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(now) };
  });
  const [filters, setFilters] = useState<AnalyticsFilters>(NO_FILTERS);
  const [compare, setCompare] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const period = useMemo(
    () => resolvePeriod(preset, { from: fromDateInputValue(custom.from), to: fromDateInputValue(custom.to) }),
    [preset, custom.from, custom.to],
  );
  const { status, error, retry, model, rebuilding, truncated, usedAggregates, netWorth } = useAnalyticsModel(period, filters);

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  function onTabKey(event: KeyboardEvent, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" description={period.label} back={{ href: "/plan", label: "Plan" }} />

      <div className="space-y-3">
        <PeriodPicker value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton value={filters} onChange={setFilters} compare={compare} onCompareChange={setCompare} />
        </div>
      </div>

      <div role="tablist" aria-label="Analytics sections" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn(
              "relative h-10 shrink-0 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === t.id ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "insights" && status === "success" && model.insights.length ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{model.insights.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="outline-none">
        {status === "error" ? (
          <ErrorState error={error} onRetry={retry} />
        ) : status === "loading" ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading analytics">
            {rebuilding ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing monthly summaries (first time only)…
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {truncated ? (
              <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                This filtered view hit the {RAW_LIMIT.toLocaleString()} expense limit; totals may be incomplete. Narrow the period.
              </p>
            ) : null}
            {tab === "overview" ? <OverviewSection model={model} period={period} compare={compare} onSeeInsights={() => setTab("insights")} /> : null}
            {tab === "spending" ? <SpendingSection model={model} period={period} compare={compare} /> : null}
            {tab === "cashflow" ? <CashFlowSection model={model} period={period} compare={compare} /> : null}
            {tab === "wealth" ? <WealthSection model={model} period={period} compare={compare} netWorth={netWorth} /> : null}
            {tab === "insights" ? (
              <section aria-label="All insights" className="rounded-3xl border bg-card p-4 md:p-5">
                <InsightList insights={model.insights} />
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  Insights are rule-based: each one appears only when a fixed threshold is crossed, and explains the numbers behind it.
                </p>
              </section>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {usedAggregates ? "Computed from monthly summaries." : "Computed from individual expenses in this period."} Only expenses count as spending — transfers, card payments and investments don&apos;t.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
