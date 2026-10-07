"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";

import { AccountIcon } from "@/components/accounts/account-icon";
import { TransferSheet } from "@/components/accounts/transfer-sheet";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { EmiPaymentSheet } from "@/components/emis/emi-payment-sheet";
import { IncomeSourceIcon } from "@/components/income/income-source-icon";
import { RecordRecurringSheet } from "@/components/income/record-recurring-sheet";
import { PayRecurringSheet } from "@/components/recurring/pay-recurring-sheet";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/dates";
import type { UpcomingItem } from "@/lib/finance/upcoming";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";
import type { ExpectedIncome } from "@/lib/finance/income";
import type { Account, Emi, RecurringPayment } from "@/types";

/** Upcoming items with one-tap actions; owns the sheets those actions open. */
export function UpcomingList({ items }: { items: UpcomingItem[] }) {
  const { getCategory } = useCategories();
  const [paying, setPaying] = useState<RecurringPayment | null>(null);
  const [payingEmi, setPayingEmi] = useState<Emi | null>(null);
  const [payingCard, setPayingCard] = useState<Account | null>(null);
  const [receiving, setReceiving] = useState<ExpectedIncome | null>(null);

  return (
    <>
      <ul className="space-y-1">
        {items.map((item) => {
          let icon;
          let title: string;
          let detail: string;
          let action: { label: string; onClick: () => void } | null;
          // Only the next unpaid occurrence of a recurring payment is actionable.
          switch (item.kind) {
            case "recurring":
              icon = <CategoryIcon category={getCategory(item.payment.categoryId)} />;
              title = item.payment.name;
              detail = "Recurring";
              action = item.cycle === item.payment.cycle ? { label: "Pay", onClick: () => setPaying(item.payment) } : null;
              break;
            case "emi":
              icon = (
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/12 text-indigo-700 dark:text-indigo-300">
                  <Landmark className="size-5" />
                </span>
              );
              title = `${item.emi.name} EMI`;
              detail = `Installment ${item.emi.paidCount + 1}/${item.emi.tenureMonths}`;
              action = { label: "Pay", onClick: () => setPayingEmi(item.emi) };
              break;
            case "card":
              icon = <AccountIcon type="credit_card" />;
              title = `${item.card.name} bill`;
              detail = "Card bill";
              action = { label: "Pay", onClick: () => setPayingCard(item.card) };
              break;
            case "income":
              icon = <IncomeSourceIcon source={item.template.source} />;
              title = item.template.name;
              detail = "Expected income";
              action = { label: "Received", onClick: () => setReceiving({ template: item.template, month: item.month, expectedAt: item.date }) };
              break;
          }
          return (
            <li key={item.id} className="flex items-center gap-3 py-1.5">
              {icon}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className={cn("truncate text-xs", item.overdue ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {item.overdue ? "Overdue · " : ""}
                  {formatDayLabel(item.date)} · {item.kind === "card" && item.minimumDue ? <>min <Money amount={item.minimumDue} /> · </> : null}
                  {detail}
                </p>
              </div>
              <span className={cn("text-sm font-semibold tabular-nums", item.kind === "income" && "text-emerald-600 dark:text-emerald-400")}>
                {item.kind === "income" ? "+" : ""}
                <Money amount={item.amount} />
              </span>
              {action ? (
                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={action.onClick}>
                  {action.label}
                </Button>
              ) : (
                <span className="w-[3.25rem]" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      <PayRecurringSheet payment={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <EmiPaymentSheet emi={payingEmi} onOpenChange={(o) => !o && setPayingEmi(null)} />
      <TransferSheet open={payingCard !== null} onOpenChange={(o) => !o && setPayingCard(null)} payCard={payingCard} />
      <RecordRecurringSheet expected={receiving} onOpenChange={(o) => !o && setReceiving(null)} />
    </>
  );
}
