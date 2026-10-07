"use client";

import { Landmark, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { obligationsForMonth } from "@/lib/finance/emi";
import { monthKey } from "@/lib/months";
import { useFinance } from "@/providers/finance-provider";
import type { Emi } from "@/types";

import { EmiCard } from "./emi-card";
import { EmiPaymentSheet } from "./emi-payment-sheet";
import { EmiSheet } from "./emi-sheet";

export function EmisView() {
  const { emis } = useFinance();
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Emi | null>(null);
  const [month] = useState(() => monthKey(new Date()));

  const all = emis.data ?? [];
  const active = all.filter((e) => e.status === "active");
  const closed = all.filter((e) => e.status === "closed");
  const obligations = obligationsForMonth(all, month);

  return (
    <div className="space-y-5">
      <PageHeader
        title="EMIs"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setAdding(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Add loan
          </Button>
        }
      />

      {emis.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading loans">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : emis.status === "error" ? (
        <ErrorState error={emis.error} onRetry={emis.retry} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans tracked"
          description="Add home, car or personal loans to see what you owe, when the next EMI is due and how much interest you'll pay."
          action={
            <Button onClick={() => setAdding(true)} className="mt-2 h-11 rounded-xl px-5">
              Add a loan
            </Button>
          }
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Total outstanding" value={<Money amount={active.reduce((s, e) => s + e.outstanding, 0)} />} hint={`${active.length} active`} />
            <Stat
              label="Due this month"
              value={<Money amount={obligations.pending} />}
              hint={
                <>
                  <Money amount={obligations.paid} /> of <Money amount={obligations.total} /> paid
                </>
              }
            />
          </dl>
          {active.length ? (
            <ul className="space-y-3">
              {active.map((emi) => (
                <EmiCard key={emi.id} emi={emi} onPay={setPaying} />
              ))}
            </ul>
          ) : null}
          {closed.length ? (
            <section aria-labelledby="closed-loans" className="space-y-2">
              <h2 id="closed-loans" className="px-1 text-sm font-medium text-muted-foreground">
                Closed
              </h2>
              <ul className="space-y-3 opacity-80">
                {closed.map((emi) => (
                  <EmiCard key={emi.id} emi={emi} onPay={setPaying} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <EmiSheet open={adding} onOpenChange={setAdding} />
      <EmiPaymentSheet emi={paying} onOpenChange={(open) => !open && setPaying(null)} />
    </div>
  );
}
