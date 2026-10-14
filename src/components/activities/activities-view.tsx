"use client";

import { format } from "date-fns";
import { Activity, BellRing, CalendarPlus, ChevronRight, Clock, Flame, ListChecks, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVITY_TEMPLATES } from "@/lib/constants/activities";
import { addDays, type DateKey, fromDateKey, isDateKey, startOfWeekKey } from "@/lib/activities/dates";
import { dueReminders } from "@/lib/activities/reminders";
import { activityRoutes } from "@/lib/activities/routes";
import { currentSchedule, describeSchedule } from "@/lib/activities/schedule";
import { activeDays, activityStreak, dayPlan, overallStreak, planProgress } from "@/lib/activities/stats";
import { categoriesOf, completions, formatMinutes, minutesInvested } from "@/lib/activities/totals";
import { cn } from "@/lib/utils";
import { useActivityTracker } from "@/providers/activity-provider";
import type { TrackedActivity, ActivityLog } from "@/types/activities";

import { ActivityIcon } from "./activity-icon";
import { ActivitySheet } from "./activity-sheet";
import { DayPlanList, formatLogDetails } from "./day-plan-list";
import { ActivityTabs } from "./activity-tabs";
import { type LogTarget, LogSheet } from "./log-sheet";
import { ProgressRing } from "./progress-ring";
import { ReminderBanner } from "./reminder-banner";
import { RemindersSheet } from "./reminders-sheet";
import { useActivityActions, whenLabel } from "./use-activity-actions";
import { WeekStrip } from "./week-strip";

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function ActivitiesView() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" aria-label="Loading" />}>
      <ActivitiesDashboard />
    </Suspense>
  );
}

function ActivitiesDashboard() {
  const tracker = useActivityTracker();
  const { live, index, today, status } = tracker;
  const params = useSearchParams();
  const router = useRouter();
  // Notification taps open /activities?check=<id>&date=<day>[&do=complete] (old /fitness links redirect here).
  const [link] = useState(() => {
    const date = params.get("date");
    return { id: params.get("check"), date: isDateKey(date) && date <= today ? date : today, complete: params.get("do") === "complete" };
  });
  const [selected, setSelected] = useState<DateKey>(link.date);
  const [adding, setAdding] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [highlight, setHighlight] = useState<string | null>(link.id);
  const { complete } = useActivityActions();
  const handled = useRef(false);

  // Follow the calendar day when the app is left open past midnight.
  const [lastToday, setLastToday] = useState(today);
  if (lastToday !== today) {
    setLastToday(today);
    if (selected === lastToday) setSelected(today);
  }

  useEffect(() => {
    if (!link.id) return;
    router.replace(activityRoutes.home);
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [link, router]);

  useEffect(() => {
    if (handled.current || !link.id || !link.complete || status !== "success") return;
    handled.current = true;
    const activity = tracker.get(link.id);
    if (activity) void complete(activity, link.date);
  }, [link, status, tracker, complete]);

  // Optional category filter ("all" until categories are in use).
  const categories = useMemo(() => categoriesOf(live), [live]);
  const [category, setCategory] = useState<string>("all");
  const shown = useMemo(() => live.filter((a) => category === "all" || (category === "none" ? !a.category : a.category === category)), [live, category]);
  const active = useMemo(() => shown.filter((a) => a.status === "active"), [shown]);
  const plan = useMemo(() => dayPlan(active, index, selected, today), [active, index, selected, today]);
  const progress = planProgress(plan);
  const streak = useMemo(() => overallStreak(activeDays(index), today), [index, today]);
  const week = useMemo(() => {
    const start = startOfWeekKey(today);
    return { completions: completions(shown, index, start, today, today), minutes: minutesInvested(shown, index, start, today, today) };
  }, [shown, index, today]);
  const due = useMemo(() => (selected === today ? dueReminders(active, index, new Date()) : []), [active, index, selected, today]);
  const recent = useMemo(() => [...tracker.logs].sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.getTime() - a.completedAt.getTime()).slice(0, 6), [tracker.logs]);

  const openDetails = (activity: TrackedActivity, log: ActivityLog | null) => setLogTarget(log ? { log } : { activityId: activity.id, date: selected });
  const isToday = selected === today;
  const dayTitle = isToday ? "Today's progress" : selected === addDays(today, -1) ? "Yesterday" : format(fromDateKey(selected), "EEEE d MMMM");

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting(new Date())}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Activities</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live.length ? (
            <Button variant="outline" size="icon-lg" className="size-10 rounded-full" onClick={() => setReminders(true)} aria-label="Reminders">
              <BellRing aria-hidden />
            </Button>
          ) : null}
          <Button onClick={() => setAdding(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Activity
          </Button>
        </div>
      </header>

      <ActivityTabs />

      {status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading activities">
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
      ) : status === "error" ? (
        <ErrorState error={tracker.error} onRetry={tracker.retry} />
      ) : live.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Build a habit, one tap a day"
          description="Anything you want to do regularly — solve LeetCode, study C#, freelance work, a side project, reading, a jog. Check it off each day, log time or amounts, and watch your streak grow."
          className="py-14"
          action={
            <div className="mt-2 flex max-w-sm flex-wrap justify-center gap-2">
              {ACTIVITY_TEMPLATES.slice(0, 4).map((t) => (
                <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                  <ActivityIcon activity={t} size="sm" className="size-5 rounded-full [&_svg]:size-3" />
                  {t.name}
                </span>
              ))}
              <Button onClick={() => setAdding(true)} className="mt-2 h-11 w-full rounded-xl">
                <Plus aria-hidden />
                Add your first activity
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {categories.length ? (
            <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <Chip selected={category === "all"} onClick={() => setCategory("all")}>
                All
              </Chip>
              {categories.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
              {live.some((a) => !a.category) ? (
                <Chip selected={category === "none"} onClick={() => setCategory("none")}>
                  No category
                </Chip>
              ) : null}
            </div>
          ) : null}

          <WeekStrip activities={active} index={index} selected={selected} today={today} onSelect={setSelected} />

          <ReminderBanner due={due} today={today} />

          <section aria-labelledby="day-title" className="rounded-3xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="day-title" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {dayTitle}
                </h2>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {progress.total
                    ? progress.completed === progress.total
                      ? isToday
                        ? "All done today 🎉"
                        : "All done"
                      : `${progress.completed} of ${progress.total} completed`
                    : selected > today
                      ? "Nothing scheduled"
                      : "Rest day"}
                </p>
              </div>
              {progress.total ? (
                <ProgressRing value={progress.rate ?? 0} size={56} stroke={6} color={progress.rate === 1 ? "var(--series-income)" : "var(--primary)"} label={`${Math.round((progress.rate ?? 0) * 100)}% of ${isToday ? "today's" : "the day's"} activities done`}>
                  <span className="text-xs font-semibold tabular-nums">{Math.round((progress.rate ?? 0) * 100)}%</span>
                </ProgressRing>
              ) : null}
            </div>
            {plan.length ? (
              <DayPlanList items={plan} date={selected} highlight={highlight} onDetails={openDetails} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {selected > today ? "Nothing is due this day." : "Nothing was due this day. Logged something anyway? Add it below."}
              </p>
            )}
            {selected <= today ? (
              <Button variant="outline" className="mt-4 h-11 w-full rounded-xl" onClick={() => setLogTarget({ date: selected })}>
                <CalendarPlus aria-hidden />
                {isToday ? "Log an activity" : `Log for ${whenLabel(selected, today).replace(/^on /, "")}`}
              </Button>
            ) : null}
          </section>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile icon={<Flame className="size-4 text-orange-500" aria-hidden />} label="Current streak" value={String(streak.current)} unit={streak.current === 1 ? "day" : "days"} />
            <StatTile icon={<Trophy className="size-4 text-amber-500" aria-hidden />} label="Best streak" value={String(streak.best)} unit={streak.best === 1 ? "day" : "days"} />
            <StatTile icon={<ListChecks className="size-4 text-primary" aria-hidden />} label="This week" value={String(week.completions)} unit={week.completions === 1 ? "completion" : "completions"} />
            <StatTile icon={<Clock className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />} label="Time invested" value={week.minutes ? formatMinutes(week.minutes) : "—"} unit={week.minutes ? "this week" : "log minutes to track"} />
          </dl>
          <p className="-mt-3 px-1 text-[11px] text-muted-foreground">
            Streaks count days in a row with at least one activity done (last 13 months). Completions count each activity once per day; time adds up the minutes you recorded.
          </p>

          <section aria-labelledby="activities-title" className="space-y-2">
            <h2 id="activities-title" className="px-1 text-sm font-medium text-muted-foreground">
              Your activities
            </h2>
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {shown.map((a) => {
                const s = activityStreak(a, index, today, tracker.since);
                return (
                  <li key={a.id}>
                    <Link href={activityRoutes.activity(a.id)} className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 active:bg-muted">
                      <ActivityIcon activity={a} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[a.category, a.status === "paused" ? "Paused" : describeSchedule(currentSchedule(a))].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {s.current > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 tabular-nums dark:text-orange-400">
                          <Flame className="size-3.5" aria-hidden />
                          {s.current}
                          <span className="sr-only">{s.unit === "week" ? "week" : "day"} streak</span>
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {recent.length ? (
            <section aria-labelledby="recent-title" className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 id="recent-title" className="text-sm font-medium text-muted-foreground">
                  Recent
                </h2>
                <Link href={activityRoutes.analytics} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Analytics
                </Link>
              </div>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {recent.map((log) => {
                  const a = tracker.get(log.activityId);
                  const details = formatLogDetails(log, a);
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        onClick={() => setLogTarget({ log })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 active:bg-muted"
                      >
                        {a ? <ActivityIcon activity={a} size="sm" /> : <span className="size-8 rounded-xl bg-muted" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a?.name ?? "Deleted activity"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {log.date === today ? "Today" : log.date === addDays(today, -1) ? "Yesterday" : format(fromDateKey(log.date), "EEE d MMM")}, {format(log.completedAt, "p")}
                            {details ? ` · ${details}` : ""}
                            {log.note ? ` · ${log.note}` : ""}
                          </span>
                        </span>
                        <span className="sr-only">, edit</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <ActivitySheet open={adding} onOpenChange={setAdding} />
      <RemindersSheet open={reminders} onOpenChange={setReminders} />
      <LogSheet target={logTarget} onOpenChange={(open) => !open && setLogTarget(null)} />
    </div>
  );
}

function StatTile({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-3")}>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">
        {value}
        <span className="ml-1 block truncate text-xs font-normal text-muted-foreground sm:inline">{unit}</span>
      </dd>
    </div>
  );
}
