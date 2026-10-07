"use client";

import { format } from "date-fns";
import { Landmark } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import { emiOverview } from "@/lib/finance/emi";
import { cn } from "@/lib/utils";
import type { Emi } from "@/types";
import { routes } from "@/lib/routes";

export function EmiCard({ emi, onPay }: { emi: Emi; onPay: (emi: Emi) => void }) {
  const o = emiOverview(emi);
  return (
    <li className="rounded-3xl border bg-card p-4">
      <Link href={routes.emi(emi.id)} className="flex items-start gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
          <Landmark className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{emi.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {emi.lender ? `${emi.lender} · ` : ""}
            <Money amount={emi.monthlyAmount} />/month
          </span>
        </span>
        <span className="text-right">
          <Money amount={emi.outstanding} className="block font-semibold" />
          <span className="text-xs text-muted-foreground">outstanding</span>
        </span>
      </Link>
      <div className="mt-4 space-y-1.5">
        <ProgressBar value={o.progress} tone={o.isClosed ? "ok" : "primary"} size="sm" label={`${emi.name} repaid`} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {emi.paidCount} of {emi.tenureMonths} paid
          </span>
          <span>{o.remainingTenure} left</span>
        </div>
      </div>
      {!o.isClosed && o.nextDueDate ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
          <p className={cn("text-sm", o.isOverdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            {o.isOverdue ? "Overdue since " : "Next due "}
            {format(o.nextDueDate, "d MMM")}
          </p>
          <Button size="lg" className="rounded-xl" onClick={() => onPay(emi)}>
            Pay EMI
          </Button>
        </div>
      ) : null}
    </li>
  );
}
