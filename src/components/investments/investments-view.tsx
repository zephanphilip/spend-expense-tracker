"use client";

import { Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { INVESTMENT_KIND_LABELS, INVESTMENT_KINDS } from "@/lib/constants/accounts";
import { investmentReturns, portfolioTotals } from "@/lib/finance/investments";
import { cn } from "@/lib/utils";
import { useFinance } from "@/providers/finance-provider";

import { InvestmentSheet } from "./investment-sheet";
import { Returns } from "./returns";
import { routes } from "@/lib/routes";

const KIND_COLORS = ["bg-indigo-500", "bg-sky-500", "bg-amber-500", "bg-yellow-400", "bg-violet-500", "bg-slate-400"];

export function InvestmentsView() {
  const { investments } = useFinance();
  const [adding, setAdding] = useState(false);
  const all = investments.data ?? [];
  const active = all.filter((i) => i.status === "active");
  const closed = all.filter((i) => i.status === "closed");
  const totals = portfolioTotals(all);
  const byKind = INVESTMENT_KINDS.map((kind, idx) => ({
    kind,
    color: KIND_COLORS[idx],
    value: active.filter((i) => i.kind === kind).reduce((s, i) => s + i.currentValue, 0),
  })).filter((k) => k.value > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investments"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setAdding(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Add
          </Button>
        }
      />

      {investments.status === "loading" ? (
        <Skeleton className="h-48 rounded-3xl" aria-label="Loading investments" />
      ) : investments.status === "error" ? (
        <ErrorState error={investments.error} onRetry={investments.retry} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Track your investments"
          description="Mutual funds, stocks, FDs, gold, crypto — see what you put in, what it's worth now and your returns."
          action={
            <Button onClick={() => setAdding(true)} className="mt-2 h-11 rounded-xl px-5">
              Add an investment
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Portfolio" className="space-y-3 rounded-3xl bg-primary p-6 text-primary-foreground">
            <p className="text-sm text-primary-foreground/70">Current value</p>
            <p className="text-4xl font-semibold tracking-tight">
              <Money amount={totals.current} />
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-primary-foreground/65">Invested</dt>
                <dd className="font-semibold"><Money amount={totals.invested} /></dd>
              </div>
              <div>
                <dt className="text-primary-foreground/65">Returns</dt>
                <dd className="font-semibold">
                  {totals.absolute >= 0 ? "+" : "−"}
                  <Money amount={Math.abs(totals.absolute)} />
                  {totals.ratio !== null ? ` (${(totals.ratio * 100).toFixed(1)}%)` : ""}
                </dd>
              </div>
            </dl>
            {totals.realized ? (
              <p className="text-xs text-primary-foreground/75">
                Realised from sales: {totals.realized >= 0 ? "+" : "−"}
                <Money amount={Math.abs(totals.realized)} />
              </p>
            ) : null}
          </section>

          {byKind.length > 1 ? (
            <SectionCard id="allocation" title="Allocation">
              <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {byKind.map((k) => (
                  <div key={k.kind} className={k.color} style={{ width: `${(k.value / totals.current) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {byKind.map((k) => (
                  <li key={k.kind} className="flex items-center gap-2">
                    <span aria-hidden className={cn("size-2.5 rounded-sm", k.color)} />
                    <span className="flex-1 truncate">{INVESTMENT_KIND_LABELS[k.kind]}</span>
                    <span className="text-muted-foreground tabular-nums">{Math.round((k.value / totals.current) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {[...active, ...closed].map((inv) => {
              const r = investmentReturns(inv);
              return (
                <li key={inv.id}>
                  <Link href={routes.investment(inv.id)} className={cn("flex items-center gap-3 p-4 outline-none hover:bg-muted/40 focus-visible:bg-muted/60", inv.status === "closed" && "opacity-60")}>
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                      <TrendingUp className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{inv.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[INVESTMENT_KIND_LABELS[inv.kind], inv.institution, inv.status === "closed" ? "Closed" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-right">
                      <Money amount={inv.currentValue} className="block font-semibold" />
                      {inv.status === "active" ? <Returns absolute={r.absolute} ratio={r.ratio} className="text-xs" /> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <InvestmentSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
