"use client";

import { format } from "date-fns";

import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { type DateKey, fromDateKey } from "@/lib/activities/dates";
import type { ActivityHeatCell } from "@/lib/activities/stats";
import { cn } from "@/lib/utils";
import type { TrackedActivity } from "@/types/activities";

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function describe(cell: ActivityHeatCell, single: boolean): string {
  const day = format(fromDateKey(cell.date), "EEEE d MMMM");
  if (cell.future) return `${day}: upcoming`;
  if (single) {
    const s = cell.status;
    return `${day}: ${s === "done" ? "completed" : s === "extra" ? "completed (extra)" : s === "missed" ? "missed" : s === "pending" ? "due today" : "nothing due"}`;
  }
  if (!cell.scheduled && !cell.completed) return `${day}: nothing due`;
  return `${day}: ${cell.completed} of ${Math.max(cell.scheduled, cell.completed)} done`;
}

/**
 * GitHub-style consistency calendar. Overall view: darker = more of the day's activities
 * done. Single-activity view uses the activity's colour (done / extra) and marks misses.
 */
export function ActivityHeatmap({
  weeks,
  activity,
  selected,
  onSelect,
}: {
  weeks: ActivityHeatCell[][];
  activity?: TrackedActivity | null;
  selected?: DateKey | null;
  onSelect: (date: DateKey) => void;
}) {
  const single = Boolean(activity);
  const color = activity ? CATEGORY_COLORS[activity.color] : null;
  return (
    <div>
      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]" dir="rtl">
        {/* rtl keeps the most recent weeks in view on narrow screens */}
        <div className="inline-flex gap-1" dir="ltr" role="grid" aria-label={activity ? `${activity.name} calendar` : "Activity consistency calendar"}>
          <div className="flex flex-col gap-1 pr-1" aria-hidden>
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i} className="flex h-4 items-center text-[10px] text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].date} className="flex flex-col gap-1" role="row">
              {week.map((cell) => {
                if (!cell.inRange) return <span key={cell.date} className="size-4" aria-hidden />;
                const isSel = selected === cell.date;
                const status = cell.status;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    disabled={cell.future}
                    onClick={() => onSelect(cell.date)}
                    aria-label={describe(cell, single)}
                    aria-selected={isSel}
                    title={describe(cell, single)}
                    className={cn(
                      "size-4 rounded-[4px] outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring disabled:hover:scale-100",
                      isSel && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                      single && status === "done" && color?.solid,
                      single && status === "extra" && cn(color?.solid, "opacity-50"),
                      single && status === "missed" && "bg-destructive/25",
                      single && (status === "pending" || status === "upcoming") && "border border-dashed border-muted-foreground/50",
                      single && (status === "rest" || status === "inactive") && "bg-muted/60",
                      cell.future && "opacity-40",
                    )}
                    style={single ? undefined : { background: HEAT[cell.level] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground" aria-hidden>
        {single ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className={cn("size-3 rounded-[3px]", color?.solid)} /> Done
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-[3px] bg-destructive/25" /> Missed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-[3px] bg-muted/60" /> Nothing due
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            Less
            {HEAT.map((v) => (
              <span key={v} className="size-3 rounded-[3px]" style={{ background: v }} />
            ))}
            More done
          </span>
        )}
      </div>
    </div>
  );
}
