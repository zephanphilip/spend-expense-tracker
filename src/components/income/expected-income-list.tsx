"use client";

import { format, isBefore, startOfDay } from "date-fns";

import { Money } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import type { ExpectedIncome } from "@/lib/finance/income";
import { cn } from "@/lib/utils";

import { IncomeSourceIcon } from "./income-source-icon";

export function ExpectedIncomeList({
  items,
  onRecord,
}: {
  items: ExpectedIncome[];
  onRecord: (item: ExpectedIncome) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const late = isBefore(item.expectedAt, startOfDay(new Date()));
        return (
          <li key={`${item.template.id}-${item.month}`} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
            <IncomeSourceIcon source={item.template.source} className="opacity-70" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.template.name}</p>
              <p className={cn("text-xs", late ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                {late ? "Expected " : "Due "}
                {format(item.expectedAt, "d MMM")} · <Money amount={item.template.amount} />
              </p>
            </div>
            <Button size="lg" variant="outline" className="rounded-xl" onClick={() => onRecord(item)}>
              Received
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
