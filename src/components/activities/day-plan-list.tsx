"use client";

import { ChevronRight, CloudUpload, NotebookPen, Plus } from "lucide-react";
import Link from "next/link";

import { type DateKey } from "@/lib/activities/dates";
import { describeSchedule, currentSchedule } from "@/lib/activities/schedule";
import type { PlanItem } from "@/lib/activities/stats";
import { activityRoutes } from "@/lib/activities/routes";
import { cn } from "@/lib/utils";
import { useActivityTracker } from "@/providers/activity-provider";
import type { TrackedActivity, ActivityLog } from "@/types/activities";

import { ActivityIcon } from "./activity-icon";
import { CompletionButton } from "./completion-button";
import { useActivityActions, whenLabel } from "./use-activity-actions";

export function formatLogDetails(log: Pick<ActivityLog, "durationMin" | "quantity">, activity: Pick<TrackedActivity, "unit"> | null): string {
  const parts: string[] = [];
  if (log.durationMin) parts.push(`${log.durationMin} min`);
  if (log.quantity) parts.push(`${log.quantity.toLocaleString()}${activity?.unit ? ` ${activity.unit}` : ""}`);
  return parts.join(" · ");
}

function subtitle(item: PlanItem<TrackedActivity>, logs: readonly ActivityLog[]): string {
  const { activity } = item;
  const details = logs.map((l) => formatLogDetails(l, activity)).filter(Boolean);
  if (item.done && details.length) return details.join(", ");
  if (item.kind === "extra") return "Extra session — not scheduled this day";
  if (item.week) return `${item.week.done} of ${item.week.target} this week`;
  const target = [activity.targetDuration ? `${activity.targetDuration} min` : null, activity.targetQuantity ? `${activity.targetQuantity.toLocaleString()}${activity.unit ? ` ${activity.unit}` : ""}` : null]
    .filter(Boolean)
    .join(" · ");
  return target ? `Target ${target}` : describeSchedule(currentSchedule(activity));
}

interface DayPlanListProps {
  items: PlanItem<TrackedActivity>[];
  date: DateKey;
  highlight?: string | null;
  onDetails: (activity: TrackedActivity, log: ActivityLog | null) => void;
}

/** Each activity due on a day with its one-tap check. */
export function DayPlanList({ items, date, highlight, onDetails }: DayPlanListProps) {
  const { logsOn, pendingIds, today } = useActivityTracker();
  const { toggle } = useActivityActions();
  const future = date > today;
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const { activity } = item;
        const logs = logsOn(activity.id, date);
        const syncing = logs.some((l) => pendingIds.has(l.id));
        return (
          <li
            key={activity.id}
            id={`plan-${activity.id}`}
            className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", highlight === activity.id && "animate-pulse")}
          >
            <Link href={activityRoutes.activity(activity.id)} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <ActivityIcon activity={activity} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-medium transition-colors", item.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{activity.name}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  {syncing ? <CloudUpload className="size-3 shrink-0" aria-label="Waiting to sync" /> : null}
                  <span className="truncate">{subtitle(item, logs)}</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </Link>
            {item.done && !future ? (
              <button
                type="button"
                onClick={() => onDetails(activity, activity.multipleEntries ? null : logs[0] ?? null)}
                aria-label={activity.multipleEntries ? `Add ${activity.name} session with details` : `Add details to ${activity.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {activity.multipleEntries ? <Plus className="size-4" aria-hidden /> : <NotebookPen className="size-4" aria-hidden />}
              </button>
            ) : null}
            <CompletionButton
              activity={activity}
              done={item.done}
              sessions={item.sessions}
              disabled={future}
              when={whenLabel(date, today)}
              onToggle={() => void toggle(activity, date)}
            />
          </li>
        );
      })}
    </ul>
  );
}
