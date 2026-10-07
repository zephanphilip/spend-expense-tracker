"use client";

import { Repeat } from "lucide-react";

import { Money } from "@/components/common/money";
import { INCOME_SOURCE_META } from "@/lib/constants/income";
import { formatDayLabel } from "@/lib/dates";
import { formatMonth } from "@/lib/months";
import { monthKey } from "@/lib/months";
import type { Income } from "@/types";

import { IncomeSourceIcon } from "./income-source-icon";

export function IncomeListItem({ income, onSelect }: { income: Income; onSelect: (income: Income) => void }) {
  const meta = INCOME_SOURCE_META[income.source];
  const forOtherMonth = income.forMonth !== monthKey(income.receivedAt);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(income)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
      >
        <IncomeSourceIcon source={income.source} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate font-medium">
            {income.note || meta.label}
            {income.recurringId ? <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Recurring" /> : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {income.note ? `${meta.label} · ` : ""}
            {formatDayLabel(income.receivedAt)}
            {forOtherMonth ? ` · for ${formatMonth(income.forMonth)}` : ""}
          </span>
        </span>
        <Money amount={income.amount} className="font-semibold text-emerald-600 dark:text-emerald-400" />
        <span className="sr-only">, edit</span>
      </button>
    </li>
  );
}
