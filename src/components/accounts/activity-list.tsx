"use client";

import { format } from "date-fns";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, Landmark, TrendingUp } from "lucide-react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { Money } from "@/components/common/money";
import { IncomeSourceIcon } from "@/components/income/income-source-icon";
import type { ActivityItem } from "@/lib/finance/activity";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants/transactions";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts } from "@/providers/finance-provider";

function Glyph({ icon: Icon, className }: { icon: typeof ArrowLeftRight; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-5", className)}>
      <Icon />
    </span>
  );
}

/** Ledger rows with the transaction type, counterparty and running balance. */
export function ActivityList({ items, onSelectExpense }: { items: ActivityItem[]; onSelectExpense?: (item: ActivityItem) => void }) {
  const { getCategory } = useCategories();
  const { name } = useAccounts();

  return (
    <ul className="divide-y">
      {items.map((item) => {
        let icon = <Glyph icon={ArrowLeftRight} />;
        let title = "";
        let detail = "";
        const s = item.source;
        if (s.kind === "expense") {
          const c = getCategory(s.expense.categoryId);
          icon = <CategoryIcon category={c} />;
          title = s.expense.note || c.name;
          detail = c.name;
        } else if (s.kind === "income") {
          icon = <IncomeSourceIcon source={s.income.source} />;
          title = s.income.note || "Income";
          detail = "Income";
        } else if (s.kind === "transfer") {
          const t = s.transfer;
          if (t.emiId) {
            icon = <Glyph icon={Landmark} className="bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" />;
            title = t.note || "EMI payment";
          } else if (item.type === "DEBT_PAYMENT") {
            icon = <Glyph icon={CreditCard} className="bg-rose-500/12 text-rose-700 dark:text-rose-300" />;
            title = s.direction === "out" ? `Paid ${name(t.toAccountId)}` : `Payment from ${name(t.fromAccountId)}`;
          } else {
            icon = <Glyph icon={s.direction === "out" ? ArrowUpRight : ArrowDownLeft} />;
            title = s.direction === "out" ? `To ${name(t.toAccountId)}` : `From ${name(t.fromAccountId)}`;
          }
          detail = t.note && !t.emiId ? t.note : "";
        } else {
          icon = <Glyph icon={TrendingUp} className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" />;
          title = s.tx.kind === "BUY" ? "Invested" : "Investment sold";
          detail = s.tx.note;
        }
        const clickable = s.kind === "expense" && onSelectExpense;
        const content = (
          <>
            {icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                <span className="mr-1 rounded bg-muted px-1 py-px text-[10px] font-semibold tracking-wide uppercase">{TRANSACTION_TYPE_LABELS[item.type]}</span>
                {format(item.date, "d MMM")}
                {detail ? ` · ${detail}` : ""}
              </span>
            </span>
            <span className="text-right">
              <span className={cn("block text-sm font-semibold tabular-nums", item.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "")}>
                {item.delta > 0 ? "+" : "−"}
                <Money amount={Math.abs(item.delta)} />
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                <Money amount={item.balanceAfter} />
              </span>
            </span>
          </>
        );
        return (
          <li key={item.id}>
            {clickable ? (
              <button type="button" onClick={() => onSelectExpense(item)} className="flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-3 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
