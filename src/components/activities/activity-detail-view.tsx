"use client";

import { format } from "date-fns";
import { Archive, ArchiveRestore, BellRing, Check, CloudUpload, FileQuestion, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityHistory, useActivityLogsRange } from "@/hooks/use-activity-queries";
import { settleQuickly } from "@/lib/async";
import type { ActivityStatus } from "@/lib/constants/activities";
import { addDays, endOfMonthKey, fromDateKey, startOfMonthKey, startOfWeekKey } from "@/lib/activities/dates";
import { formatTimeOfDay } from "@/lib/activities/reminders";
import { activityRoutes } from "@/lib/activities/routes";
import { currentSchedule, describeSchedule, isFlexibleOn, isScheduledOn } from "@/lib/activities/schedule";
import { activityStreak, isDone, periodSummary, scheduledCompletion } from "@/lib/activities/stats";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteActivity, setActivityStatus } from "@/lib/services/activity.service";
import { useSession } from "@/providers/auth-provider";
import { useActivityTracker } from "@/providers/activity-provider";
import type { TrackedActivity } from "@/types/activities";

import { ActivityIcon } from "./activity-icon";
import { ActivitySheet } from "./activity-sheet";
import { formatLogDetails } from "./day-plan-list";
import { type LogTarget, LogSheet } from "./log-sheet";
import { MonthCalendar } from "./month-calendar";
import { useActivityActions } from "./use-activity-actions";

const PAGE = 30;
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function ActivityDetailView({ activityId }: { activityId: string }) {
  const tracker = useActivityTracker();
  const activity = tracker.get(activityId);
  if (tracker.status === "loading") return <Skeleton className="h-96 rounded-3xl" aria-label="Loading" />;
  if (tracker.status === "error") return <ErrorState error={tracker.error} onRetry={tracker.retry} />;
  if (!activity) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Activity not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={() => history.back()}>
            Go back
          </Button>
        }
      />
    );
  }
  return <Detail activity={activity} />;
}

function Detail({ activity }: { activity: TrackedActivity }) {
  const router = useRouter();
  const { user } = useSession();
  const tracker = useActivityTracker();
  const { index, today, since } = tracker;
  const { complete, undo } = useActivityActions();
  const [month, setMonth] = useState(() => startOfMonthKey(today));
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState<"edit" | "delete" | "archive" | null>(null);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const monthLogs = useActivityLogsRange(month, endOfMonthKey(month));
  const history = useActivityHistory(activity.id, limit);

  const stats = useMemo(() => {
    const from30 = addDays(today, -29);
    return {
      streak: activityStreak(activity, index, today, since),
      rate30: scheduledCompletion(activity, index, from30, today, today),
      week: scheduledCompletion(activity, index, startOfWeekKey(today), today, today),
      month: scheduledCompletion(activity, index, startOfMonthKey(today), today, today),
      totals: periodSummary([activity], index, since, today, today),
    };
  }, [activity, index, today, since]);

  const dueToday = activity.status === "active" && (isScheduledOn(activity, today) || isFlexibleOn(activity, today));
  const doneToday = isDone(index, activity.id, today);
  const schedule = activity.status === "paused" ? "Paused" : activity.status === "archived" ? "Archived" : describeSchedule(currentSchedule(activity));

  async function changeStatus(status: ActivityStatus, message: string) {
    try {
      await settleQuickly(setActivityStatus(user.uid, activity, status, today));
      toast.success(message);
      setSheet(null);
    } catch (error) {
      toast.error("Couldn't update the activity", { description: getErrorMessage(error) });
    }
  }

  async function onDelete() {
    try {
      await deleteActivity(user.uid, activity.id);
      toast.success(`${activity.name} deleted`);
      router.replace(activityRoutes.home);
    } catch (error) {
      toast.error("Couldn't delete", { description: getErrorMessage(error) });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={activity.name}
        back={{ href: activityRoutes.home, label: "Activities" }}
        action={
          <Button variant="outline" onClick={() => setSheet("edit")} className="h-10 rounded-xl">
            <Pencil aria-hidden />
            Edit
          </Button>
        }
      />

      <section aria-label="About" className="flex items-center gap-4 rounded-3xl border bg-card p-5">
        <ActivityIcon activity={activity} size="lg" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold">{schedule}</p>
          {activity.description ? <p className="text-sm text-muted-foreground">{activity.description}</p> : null}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {activity.reminderEnabled && activity.reminderTime ? (
              <span className="inline-flex items-center gap-1">
                <BellRing className="size-3" aria-hidden />
                {formatTimeOfDay(activity.reminderTime)}
              </span>
            ) : null}
            {activity.category ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{activity.category}</span> : null}
            {activity.targetDuration ? <span>Target {activity.targetDuration} min</span> : null}
            {activity.targetQuantity ? <span>Target {activity.targetQuantity.toLocaleString()} {activity.unit ?? ""}</span> : null}
            <span>Since {format(fromDateKey(activity.startDate), "d MMM yyyy")}</span>
            {activity.endDate ? <span>Until {format(fromDateKey(activity.endDate), "d MMM yyyy")}</span> : null}
          </p>
        </div>
      </section>

      {dueToday && !(dismissed && !doneToday) ? (
        <section aria-labelledby="today-check" className="rounded-3xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs font-semibold tracking-wide text-primary-foreground/70 uppercase">{activity.name}</p>
          <h2 id="today-check" className="mt-1 text-lg font-semibold">
            {doneToday ? (activity.multipleEntries ? "Done today — add another session?" : "Completed today") : `Did you do ${activity.name.toLowerCase()} today?`}
          </h2>
          <div className="mt-4 flex gap-2">
            {doneToday && !activity.multipleEntries ? (
              <Button variant="secondary" className="h-11 flex-1 rounded-xl" onClick={() => void undo(activity, today)}>
                Undo
              </Button>
            ) : (
              <>
                <Button variant="secondary" className="h-11 flex-1 rounded-xl" onClick={() => void complete(activity, today)}>
                  <Check aria-hidden />
                  {doneToday ? "Add session" : "Yes, completed"}
                </Button>
                {!doneToday ? (
                  <Button variant="ghost" className="h-11 rounded-xl text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDismissed(true)}>
                    Not yet
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Current streak" value={`${stats.streak.current}`} hint={stats.streak.unit === "week" ? "weeks on target" : "scheduled days"} />
        <Tile label="Best streak" value={`${stats.streak.best}`} hint={`${stats.streak.unit === "week" ? "weeks" : "days"} · last 13 months`} />
        <Tile label="Completion rate" value={pct(stats.rate30.rate)} hint={`${stats.rate30.completed} of ${stats.rate30.scheduled} · 30 days`} />
        <Tile label="This week" value={pct(stats.week.rate)} hint={`${stats.week.completed} of ${stats.week.scheduled} done`} />
        <Tile label="This month" value={pct(stats.month.rate)} hint={`${stats.month.completed} of ${stats.month.scheduled} done`} />
        <Tile
          label="Total"
          value={`${stats.totals.activeDays}`}
          hint={[
            "days",
            stats.totals.duration ? `${Math.round(stats.totals.duration / 60 * 10) / 10} h` : null,
            stats.totals.quantity ? `${stats.totals.quantity.toLocaleString()} ${activity.unit ?? ""}`.trim() : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </dl>

      <section aria-labelledby="calendar-title" className="rounded-3xl border bg-card p-4 md:p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="calendar-title" className="font-semibold">
            Calendar
          </h2>
          <Button variant="ghost" className="h-9 rounded-lg px-2 text-sm" onClick={() => setLogTarget({ activityId: activity.id, date: today })}>
            <Plus aria-hidden />
            Add past record
          </Button>
        </div>
        {monthLogs.status === "error" ? (
          <ErrorState error={monthLogs.error} onRetry={monthLogs.retry} />
        ) : (
          <MonthCalendar
            activity={activity}
            month={month}
            index={monthLogs.index}
            today={today}
            loading={monthLogs.status === "loading"}
            onMonthChange={setMonth}
            onSelect={(date) => {
              const logs = monthLogs.logs.filter((l) => l.activityId === activity.id && l.date === date);
              setLogTarget(logs.length && !activity.multipleEntries ? { log: logs[0] } : { activityId: activity.id, date });
            }}
          />
        )}
        <p className="mt-2 text-xs text-muted-foreground">Tap a day to add a record or correct one.</p>
      </section>

      <section aria-labelledby="history-title" className="space-y-2">
        <h2 id="history-title" className="px-1 text-sm font-medium text-muted-foreground">
          History
        </h2>
        {history.status === "loading" ? (
          <Skeleton className="h-40 rounded-3xl" />
        ) : history.status === "error" ? (
          <ErrorState error={history.error} onRetry={history.retry} />
        ) : history.data.items.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">No records yet. Check it off on the Activities tab, or add a past record.</p>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {history.data.items.map((log) => {
                const details = formatLogDetails(log, activity);
                return (
                  <li key={log.id}>
                    <button
                      type="button"
                      onClick={() => setLogTarget({ log })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 active:bg-muted"
                    >
                      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{format(fromDateKey(log.date), "EEE d MMM yyyy")}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {format(log.completedAt, "p")}
                          {details ? ` · ${details}` : ""}
                          {log.note ? ` · ${log.note}` : ""}
                        </span>
                      </span>
                      {tracker.pendingIds.has(log.id) ? <CloudUpload className="size-4 text-muted-foreground" aria-label="Waiting to sync" /> : null}
                      <span className="sr-only">, edit</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {history.data.hasMore ? (
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setLimit((l) => l + PAGE)}>
                Load more
              </Button>
            ) : null}
          </>
        )}
      </section>

      <section aria-label="Manage" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {activity.status === "active" ? (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => void changeStatus("paused", `${activity.name} paused — nothing is due until you resume`)}>
            <Pause aria-hidden />
            Pause
          </Button>
        ) : (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => void changeStatus("active", `${activity.name} resumed`)}>
            {activity.status === "archived" ? <ArchiveRestore aria-hidden /> : <Play aria-hidden />}
            {activity.status === "archived" ? "Restore" : "Resume"}
          </Button>
        )}
        {activity.status !== "archived" ? (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setSheet("archive")}>
            <Archive aria-hidden />
            Archive
          </Button>
        ) : null}
        <Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => setSheet("delete")}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </section>

      <ActivitySheet open={sheet === "edit"} onOpenChange={(open) => setSheet(open ? "edit" : null)} activity={activity} />
      <LogSheet target={logTarget} onOpenChange={(open) => !open && setLogTarget(null)} />
      <ConfirmDialog
        open={sheet === "archive"}
        onOpenChange={(open) => setSheet(open ? "archive" : null)}
        title={`Archive ${activity.name}?`}
        description="It leaves your daily list and reminders stop. Its history stays in analytics, and you can restore it any time."
        confirmLabel="Archive"
        icon={Archive}
        destructive={false}
        onConfirm={() => changeStatus("archived", `${activity.name} archived`)}
      />
      <ConfirmDialog
        open={sheet === "delete"}
        onOpenChange={(open) => setSheet(open ? "delete" : null)}
        title={`Delete ${activity.name}?`}
        description="This permanently deletes the activity and every record of it. To keep the history, archive it instead."
        confirmLabel="Delete everything"
        onConfirm={onDelete}
      />
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
