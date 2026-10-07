"use client";

import { format } from "date-fns";
import { Plus, Repeat } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { frequencyLabel, isOverdue, monthlyEquivalent, nextOccurrence } from "@/lib/finance/recurrence";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";
import type { RecurringPayment } from "@/types";

import { PayRecurringSheet } from "./pay-recurring-sheet";
import { RecurringPaymentSheet } from "./recurring-payment-sheet";

export function RecurringView() {
  const { recurringPayments } = useFinance();
  const { getCategory } = useCategories();
  const { name } = useAccounts();
  const [editing, setEditing] = useState<{ open: boolean; payment: RecurringPayment | null }>({ open: false, payment: null });
  const [paying, setPaying] = useState<RecurringPayment | null>(null);

  const all = recurringPayments.data ?? [];
  const withNext = all
    .map((p) => ({ p, next: nextOccurrence(p) }))
    .sort((a, b) => (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity));
  const monthly = all.filter((p) => p.active).reduce((s, p) => s + monthlyEquivalent(p), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recurring payments"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setEditing({ open: true, payment: null })} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Add
          </Button>
        }
      />
      {recurringPayments.status === "loading" ? (
        <Skeleton className="h-40 rounded-3xl" aria-label="Loading recurring payments" />
      ) : recurringPayments.status === "error" ? (
        <ErrorState error={recurringPayments.error} onRetry={recurringPayments.retry} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring payments"
          description="Rent, subscriptions, insurance — add them once and pay each one in a tap when it's due."
          action={
            <Button onClick={() => setEditing({ open: true, payment: null })} className="mt-2 h-11 rounded-xl px-5">
              Add a payment
            </Button>
          }
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Per month (approx.)" value={<Money amount={monthly} />} />
            <Stat label="Active" value={all.filter((p) => p.active).length} hint={`of ${all.length}`} />
          </dl>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {withNext.map(({ p, next }) => {
              const overdue = next ? isOverdue(next) : false;
              return (
                <li key={p.id} className={cn("flex items-center gap-3 p-4", !p.active && "opacity-60")}>
                  <button
                    type="button"
                    onClick={() => setEditing({ open: true, payment: p })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <CategoryIcon category={getCategory(p.categoryId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className={cn("block truncate text-xs", overdue ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                        <Money amount={p.amount} /> · {frequencyLabel(p.unit, p.interval)}
                        {next ? ` · ${overdue ? "overdue since" : "next"} ${format(next, "d MMM")}` : p.active ? " · ended" : " · paused"}
                        {p.accountId ? ` · ${name(p.accountId)}` : ""}
                      </span>
                    </span>
                  </button>
                  {next ? (
                    <Button size="lg" variant="outline" className="rounded-xl" onClick={() => setPaying(p)}>
                      Pay
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <RecurringPaymentSheet open={editing.open} onOpenChange={(open) => setEditing((s) => ({ ...s, open }))} payment={editing.payment} />
      <PayRecurringSheet payment={paying} onOpenChange={(open) => !open && setPaying(null)} />
    </div>
  );
}
