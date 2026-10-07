"use client";

import { useMemo } from "react";

import { Money } from "@/components/common/money";
import { groupByDay } from "@/lib/analytics";
import { formatDayLabel } from "@/lib/dates";
import type { Expense } from "@/types";

import { ExpenseListItem } from "./expense-list-item";

/** Expenses grouped under sticky day headers with each day's total. */
export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  const groups = useMemo(() => groupByDay(expenses), [expenses]);
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`day-${group.key}`}>
          <div className="sticky top-[var(--sticky-offset,0px)] z-10 flex items-center justify-between bg-background/90 px-3 py-2 text-sm backdrop-blur supports-backdrop-filter:bg-background/75">
            <h2 id={`day-${group.key}`} className="font-medium text-muted-foreground">
              {formatDayLabel(group.date)}
            </h2>
            <Money amount={group.total} className="text-muted-foreground" />
          </div>
          <ul className="space-y-0.5">
            {group.items.map((expense) => (
              <ExpenseListItem key={expense.id} expense={expense} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
