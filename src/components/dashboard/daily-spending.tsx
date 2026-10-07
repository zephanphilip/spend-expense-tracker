"use client";

import { format, isToday } from "date-fns";

import { Money } from "@/components/common/money";
import type { DailyTotal } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

/** Seven-day bar chart built from plain elements; every bar is labelled for screen readers. */
export function DailySpending({ days }: { days: DailyTotal[] }) {
  const { currency } = useSession();
  const max = Math.max(...days.map((d) => d.total), 1);
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);

  return (
    <section aria-labelledby="daily-title" className="rounded-3xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="daily-title" className="font-semibold">
          Last 7 days
        </h2>
        <Money amount={weekTotal} className="text-sm text-muted-foreground" />
      </div>
      <ol className="mt-5 grid h-40 grid-cols-7 items-end gap-2">
        {days.map((day) => {
          const today = isToday(day.date);
          const height = day.total > 0 ? Math.max((day.total / max) * 100, 4) : 0;
          return (
            <li key={day.date.toISOString()} className="group flex h-full flex-col items-center gap-2">
              <span className="sr-only">
                {format(day.date, "EEEE d MMMM")}: {formatMoney(day.total, currency)}
              </span>
              <div aria-hidden className="relative flex w-full flex-1 items-end justify-center">
                <span className="pointer-events-none absolute -top-1 hidden -translate-y-full rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background group-hover:block">
                  {formatMoney(day.total, currency, { compact: true })}
                </span>
                <div
                  className={cn(
                    "w-full max-w-9 rounded-lg transition-[height] duration-500",
                    day.total === 0 && "h-1 bg-muted",
                    day.total > 0 && (today ? "bg-primary" : "bg-primary/25 dark:bg-primary/35"),
                  )}
                  style={day.total > 0 ? { height: `${height}%` } : undefined}
                />
              </div>
              <span
                aria-hidden
                className={cn("text-xs", today ? "font-semibold text-foreground" : "text-muted-foreground")}
              >
                {format(day.date, "EEEEE")}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
