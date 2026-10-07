"use client";

import { format } from "date-fns";

import { Money } from "@/components/common/money";
import { ProgressBar } from "@/components/common/progress-bar";
import { availableCredit, cardCycle, cardOutstanding, cardUtilization } from "@/lib/finance/accounts";
import { isOverdue } from "@/lib/finance/recurrence";
import { cn } from "@/lib/utils";
import type { Account } from "@/types";

export function utilizationTone(ratio: number | null) {
  if (ratio === null) return "primary" as const;
  return ratio > 0.75 ? ("over" as const) : ratio > 0.3 ? ("warning" as const) : ("ok" as const);
}

/** Outstanding, available credit, utilisation and statement dates for a card. */
export function CardSummary({ card, compact = false }: { card: Account; compact?: boolean }) {
  const outstanding = cardOutstanding(card);
  const available = availableCredit(card);
  const utilization = cardUtilization(card);
  const cycle = card.statementDay && card.dueDay ? cardCycle(card.statementDay, card.dueDay) : null;
  const due = cycle && card.statementBalance ? cycle.dueDate : null;
  const overdue = due ? isOverdue(due) : false;

  return (
    <div className="space-y-2">
      {utilization !== null ? (
        <>
          <ProgressBar value={utilization} tone={utilizationTone(utilization)} size="sm" label={`${card.name} utilisation`} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {Math.round(utilization * 100)}% used{available !== null ? <> · <Money amount={available} /> available</> : null}
            </span>
            <span>
              limit <Money amount={card.creditLimit ?? 0} />
            </span>
          </div>
        </>
      ) : null}
      {!compact && cycle ? (
        <dl className="grid grid-cols-3 gap-2 pt-1 text-xs">
          <div>
            <dt className="text-muted-foreground">Statement</dt>
            <dd className="font-medium">{card.statementBalance ? <Money amount={card.statementBalance} /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Minimum due</dt>
            <dd className="font-medium">{card.minimumDue ? <Money amount={card.minimumDue} /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd className={cn("font-medium", overdue && "text-destructive")}>{due ? format(due, "d MMM") : `day ${card.dueDay}`}</dd>
          </div>
        </dl>
      ) : null}
      {compact && due && outstanding > 0 ? (
        <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {overdue ? "Overdue since" : "Due"} {format(due, "d MMM")}
          {card.minimumDue ? <> · min <Money amount={card.minimumDue} /></> : null}
        </p>
      ) : null}
    </div>
  );
}
