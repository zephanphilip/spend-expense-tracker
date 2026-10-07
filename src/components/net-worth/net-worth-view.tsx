"use client";

import { Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNetWorthHistory } from "@/hooks/use-finance-queries";
import type { NetWorth } from "@/lib/finance/net-worth";
import { formatMoney } from "@/lib/money";
import { formatMonth, monthKey } from "@/lib/months";
import { saveNetWorthSnapshot } from "@/lib/services/net-worth.service";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

import { useNetWorth } from "./use-net-worth";

function Row({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  if (!amount) return null;
  return (
    <li className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <Money amount={amount} className="font-medium" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${total > 0 ? Math.max((Math.abs(amount) / total) * 100, 2) : 0}%` }} />
      </div>
    </li>
  );
}

export function NetWorthView() {
  const { user, currency } = useSession();
  const { netWorth, hasData, error } = useNetWorth();
  const history = useNetWorthHistory();
  const [month] = useState(() => monthKey(new Date()));
  const saved = useRef<string | null>(null);

  // Keep this month's snapshot current so the trend builds up over time.
  useEffect(() => {
    if (!netWorth || !hasData || history.status !== "success") return;
    const current = history.data.find((s) => s.month === month);
    const signature = `${netWorth.assets.total}:${netWorth.liabilities.total}`;
    if (saved.current === signature) return;
    if (current && current.assets === netWorth.assets.total && current.liabilities === netWorth.liabilities.total) return;
    saved.current = signature;
    saveNetWorthSnapshot(user.uid, month, netWorth).catch(() => {
      saved.current = null;
    });
  }, [netWorth, hasData, history.status, history.data, month, user.uid]);

  if (error) return <ErrorState error={error} />;
  if (!netWorth) return <Skeleton className="h-80 rounded-3xl" aria-label="Loading net worth" />;

  const snapshots = history.data ?? [];
  const max = Math.max(...snapshots.map((s) => Math.abs(s.netWorth)), 1);

  return (
    <div className="space-y-5">
      <PageHeader title="Net worth" back={{ href: "/plan", label: "Plan" }} />
      {!hasData ? (
        <EmptyState
          icon={Scale}
          title="Your net worth starts here"
          description="Add accounts, credit cards, investments and loans — net worth is what you own minus what you owe."
        />
      ) : (
        <>
          <section aria-label="Net worth" className="space-y-1 rounded-3xl bg-primary p-6 text-primary-foreground">
            <p className="text-sm text-primary-foreground/70">Net worth</p>
            <p className="text-4xl font-semibold tracking-tight">
              {netWorth.netWorth < 0 ? "−" : ""}
              <Money amount={Math.abs(netWorth.netWorth)} />
            </p>
            <p className="text-sm text-primary-foreground/80">
              <Money amount={netWorth.assets.total} /> assets − <Money amount={netWorth.liabilities.total} /> liabilities
            </p>
          </section>
          <Breakdown nw={netWorth} />
          {snapshots.length > 1 ? (
            <SectionCard id="networth-trend" title="Trend">
              <ol className="grid h-36 items-end gap-2" style={{ gridTemplateColumns: `repeat(${snapshots.length}, minmax(0, 1fr))` }}>
                {snapshots.map((s) => (
                  <li key={s.month} className="flex h-full flex-col items-center gap-1.5">
                    <span className="sr-only">
                      {formatMonth(s.month)}: {formatMoney(s.netWorth, currency)}
                    </span>
                    <div aria-hidden className="flex w-full flex-1 items-end justify-center">
                      <div
                        className={cn("w-full max-w-8 rounded-md", s.netWorth >= 0 ? "bg-primary/70" : "bg-destructive/70")}
                        style={{ height: `${Math.max((Math.abs(s.netWorth) / max) * 100, 4)}%` }}
                      />
                    </div>
                    <span aria-hidden className="text-[10px] text-muted-foreground">
                      {formatMonth(s.month, "short")}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">A snapshot is saved each month you visit, building your net worth trend.</p>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Wishlist savings aren&apos;t added separately — that money already sits in your accounts.
          </p>
        </>
      )}
    </div>
  );
}

function Breakdown({ nw }: { nw: NetWorth }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard id="nw-assets" title="Assets">
        <ul className="space-y-3">
          <Row label="Bank accounts" amount={nw.assets.bank} total={nw.assets.total} color="bg-blue-500" />
          <Row label="Cash" amount={nw.assets.cash} total={nw.assets.total} color="bg-emerald-500" />
          <Row label="UPI / wallets" amount={nw.assets.wallet} total={nw.assets.total} color="bg-violet-500" />
          <Row label="Investments" amount={nw.assets.investments} total={nw.assets.total} color="bg-teal-500" />
          <Row label="Card credit" amount={nw.assets.cardCredit} total={nw.assets.total} color="bg-slate-400" />
        </ul>
        {nw.assets.total === 0 ? <p className="text-sm text-muted-foreground">No assets tracked yet.</p> : null}
      </SectionCard>
      <SectionCard id="nw-liabilities" title="Liabilities">
        <ul className="space-y-3">
          <Row label="Credit cards" amount={nw.liabilities.creditCards} total={nw.liabilities.total} color="bg-rose-500" />
          <Row label="Loans / EMIs" amount={nw.liabilities.loans} total={nw.liabilities.total} color="bg-indigo-500" />
        </ul>
        {nw.liabilities.total === 0 ? <p className="text-sm text-muted-foreground">No debt — nice.</p> : null}
      </SectionCard>
    </div>
  );
}
