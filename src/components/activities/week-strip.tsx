"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addDays, type DateKey, fromDateKey, startOfWeekKey } from "@/lib/activities/dates";
import { dayPlan, type DoneIndex, planProgress } from "@/lib/activities/stats";
import { cn } from "@/lib/utils";
import type { TrackedActivity } from "@/types/activities";

import { ProgressRing } from "./progress-ring";

interface WeekStripProps {
  activities: readonly TrackedActivity[];
  index: DoneIndex;
  selected: DateKey;
  today: DateKey;
  onSelect: (date: DateKey) => void;
}

/** A week of days to inspect or back-fill, each with its completion ring. */
export function WeekStrip({ activities, index, selected, today, onSelect }: WeekStripProps) {
  const weekStart = startOfWeekKey(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const maxWeek = addDays(startOfWeekKey(today), 28);
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onSelect(addDays(selected, -7))} aria-label="Previous week">
        <ChevronLeft aria-hidden />
      </Button>
      <div role="group" aria-label={`Week of ${format(fromDateKey(weekStart), "d MMMM")}`} className="grid min-w-0 flex-1 grid-cols-7">
        {days.map((d) => {
          const progress = planProgress(dayPlan(activities, index, d, today));
          const isSelected = d === selected;
          const isToday = d === today;
          const future = d > today;
          const label = `${format(fromDateKey(d), "EEEE d MMMM")}${isToday ? " (today)" : ""}${progress.total ? `: ${progress.completed} of ${progress.total} done` : ": nothing due"}`;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSelected}
              aria-label={label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl py-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-muted",
              )}
            >
              <span className={cn("text-[11px] font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{format(fromDateKey(d), "EEEEE")}</span>
              <ProgressRing value={progress.rate ?? 0} size={30} stroke={3} color={future ? "var(--muted-foreground)" : progress.rate === 1 ? "var(--series-income)" : "var(--primary)"}>
                <span className={cn("text-xs font-semibold tabular-nums", isToday && "text-primary", future && "text-muted-foreground")}>{Number(d.slice(8))}</span>
              </ProgressRing>
            </button>
          );
        })}
      </div>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onSelect(addDays(selected, 7))} disabled={addDays(weekStart, 7) > maxWeek} aria-label="Next week">
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
