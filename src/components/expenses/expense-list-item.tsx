"use client";

import { ChevronRight, Repeat } from "lucide-react";
import { memo } from "react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { PAYMENT_METHOD_META } from "@/lib/constants/payment-methods";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { useCategories } from "@/providers/categories-provider";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";
import type { Expense } from "@/types";

interface ExpenseListItemProps {
  expense: Expense;
  /** Show the date as well as the time (for lists not grouped by day). */
  showDate?: boolean;
}

/** Memoised: long history lists re-render only rows whose expense actually changed. */
export const ExpenseListItem = memo(function ExpenseListItem({ expense, showDate = false }: ExpenseListItemProps) {
  const { getCategory } = useCategories();
  const { openEdit } = useExpenseSheet();
  const category = getCategory(expense.categoryId);
  const method = PAYMENT_METHOD_META[expense.paymentMethod];
  const when = showDate
    ? `${formatDayLabel(expense.occurredAt)}, ${formatTime(expense.occurredAt)}`
    : formatTime(expense.occurredAt);

  return (
    <li>
      <button
        type="button"
        onClick={() => openEdit(expense)}
        className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
      >
        <CategoryIcon category={category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{expense.note || category.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {expense.recurringId ? <Repeat className="mr-1 inline size-3 -translate-y-px" aria-label="Recurring" /> : null}
            {expense.note ? `${category.name} · ` : ""}
            {method.label} · {when}
          </span>
        </span>
        <Money amount={expense.amount} className="font-semibold" />
        <span className="sr-only">, edit</span>
        <ChevronRight
          className="hidden size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block"
          aria-hidden
        />
      </button>
    </li>
  );
});
