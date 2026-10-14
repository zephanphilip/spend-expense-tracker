"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { addDays, addMonthsKey, type DateKey, endOfMonthKey, fromDateKey, startOfWeekKey } from "@/lib/activities/dates";
import { type DayStatus, dayStatus, type DoneIndex } from "@/lib/activities/stats";
import { cn } from "@/lib/utils";
import type { TrackedActivity } from "@/types/activities";

const STATUS_LABEL: Record<DayStatus, string> = {
  done: "completed",
  extra: "completed (extra session)",
  missed: "not completed",
  pending: "due, not done yet",
  rest: "nothing due",
  upcoming: "scheduled",
  inactive: "not active",
};

interface MonthCalendarProps {
  activity: TrackedActivity;
  month: DateKey;
  index: DoneIndex;
  today: DateKey;
  loading?: boolean;
  onMonthChange: (month: DateKey) => void;
  onSelect: (date: DateKey, status: DayStatus) => void;
}

/** One activity's month: done / missed / rest days. Tap a day to add or edit its record. */
export function MonthCalendar({ activity, month, index, today, loading, onMonthChange, onSelect }: MonthCalendarProps) {
  const color = CATEGORY_COLORS[activity.color];
  const first = startOfWeekKey(month);
  const last = endOfMonthKey(month);
  const cells: DateKey[] = [];
  for (let d = first; d <= last || cells.length % 7; d = addDays(d, 1)) cells.push(d);
  const canGoNext = addMonthsKey(month, 1) <= today;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon-lg" onClick={() => onMonthChange(addMonthsKey(month, -1))} aria-label="Previous month">
          <ChevronLeft aria-hidden />
        </Button>
        <p aria-live="polite" className="text-sm font-semibold">
          {format(fromDateKey(month), "MMMM yyyy")}
        </p>
        <Button variant="ghost" size="icon-lg" onClick={() => onMonthChange(addMonthsKey(month, 1))} disabled={!canGoNext} aria-label="Next month">
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${activity.name}, ${format(fromDateKey(month), "MMMM yyyy")}`} aria-busy={loading || undefined}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} aria-hidden className="pb-1 text-[11px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          if (!inMonth) return <span key={d} aria-hidden />;
          const status = dayStatus(activity, d, index, today);
          const selectable = d <= today && status !== "inactive";
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              disabled={!selectable && !(status === "extra")}
              onClick={() => onSelect(d, status)}
              aria-label={`${format(fromDateKey(d), "EEEE d MMMM")}: ${STATUS_LABEL[status]}`}
              className={cn(
                "relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm tabular-nums outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 enabled:active:scale-90",
                status === "done" && cn(color.solid, "font-semibold text-white"),
                status === "extra" && cn(color.tile, "font-semibold"),
                status === "missed" && "bg-muted text-muted-foreground line-through decoration-destructive/60",
                status === "pending" && "border-2 border-dashed border-primary/60 font-semibold",
                status === "upcoming" && "border border-dashed border-border text-muted-foreground",
                status === "rest" && "text-muted-foreground/70",
                status === "inactive" && "text-muted-foreground/30",
                isToday && status !== "done" && "font-semibold text-primary",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", color.solid)} />
          Done
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-muted ring-1 ring-destructive/40" />
          Missed
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", color.tile)} />
          Extra
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border border-dashed border-muted-foreground" />
          Due
        </li>
      </ul>
    </div>
  );
}
