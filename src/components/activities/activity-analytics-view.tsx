"use client";

import { format } from "date-fns";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { ChartCard } from "@/components/analytics/chart-card";
import { Chip } from "@/components/common/chip";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityLogsRange } from "@/hooks/use-activity-queries";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import {
  addDays,
  addMonthsKey,
  type DateKey,
  diffDays,
  endOfMonthKey,
  fromDateKey,
  isDateKey,
  maxKey,
  minKey,
  startOfMonthKey,
  startOfWeekKey,
} from "@/lib/activities/dates";
import { activityInsights } from "@/lib/activities/insights";
import { activityTotals, categoriesOf, formatMinutes, totalsByCategory } from "@/lib/activities/totals";
import {
  activeDays,
  activityStreak,
  dailyCompletion,
  dayPlan,
  type DoneIndex,
  heatmap,
  overallStreak,
  type PeriodSummary,
  periodSummary,
  planProgress,
  scheduledCompletion,
  weeklyCompletion,
} from "@/lib/activities/stats";
import { cn } from "@/lib/utils";
import { useActivityTracker } from "@/providers/activity-provider";
import type { TrackedActivity } from "@/types/activities";

import { ActivityIcon } from "./activity-icon";
import { DaySheet } from "./day-sheet";
import { CountBars, type ActivityBar, RateBars } from "./activity-charts";
import { ActivityHeatmap } from "./activity-heatmap";
import { ActivityTabs } from "./activity-tabs";

type PeriodKind = "week" | "month" | "quarter" | "year" | "custom";
const PERIODS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "3 months" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

interface Range {
  from: DateKey;
  to: DateKey;
}

function periodRange(kind: PeriodKind, anchor: DateKey, custom: Range): Range {
  switch (kind) {
    case "week":
      return { from: startOfWeekKey(anchor), to: addDays(startOfWeekKey(anchor), 6) };
    case "month":
      return { from: startOfMonthKey(anchor), to: endOfMonthKey(anchor) };
    case "quarter":
      return { from: addMonthsKey(anchor, -2), to: endOfMonthKey(anchor) };
    case "year":
      return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
    default:
      return custom;
  }
}

function previousRange(kind: PeriodKind, r: Range): Range {
  switch (kind) {
    case "week":
      return { from: addDays(r.from, -7), to: addDays(r.to, -7) };
    case "month":
      return { from: addMonthsKey(r.from, -1), to: endOfMonthKey(addMonthsKey(r.from, -1)) };
    case "quarter":
      return { from: addMonthsKey(r.from, -3), to: endOfMonthKey(addMonthsKey(r.from, -1)) };
    case "year":
      return { from: addMonthsKey(r.from, -12), to: addDays(r.from, -1) };
    default: {
      const len = diffDays(r.from, r.to) + 1;
      return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
    }
  }
}

function shiftAnchor(kind: PeriodKind, anchor: DateKey, dir: 1 | -1): DateKey {
  if (kind === "week") return addDays(anchor, 7 * dir);
  if (kind === "month") return addMonthsKey(anchor, dir);
  if (kind === "quarter") return addMonthsKey(anchor, 3 * dir);
  return addMonthsKey(anchor, 12 * dir);
}

function periodLabel(kind: PeriodKind, r: Range, today: DateKey): string {
  const f = (d: DateKey, p: string) => format(fromDateKey(d), p);
  if (kind === "week") return r.from === startOfWeekKey(today) ? "This week" : `Week of ${f(r.from, "d MMM")}`;
  if (kind === "month") return r.from === startOfMonthKey(today) ? "This month" : f(r.from, "MMMM yyyy");
  if (kind === "quarter") return `${f(r.from, "MMM")} – ${f(r.to, "MMM yyyy")}`;
  if (kind === "year") return r.from.slice(0, 4);
  return `${f(r.from, "d MMM")} – ${f(r.to, "d MMM yyyy")}`;
}

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function ActivityAnalyticsView() {
  const tracker = useActivityTracker();
  const { today, activities, live } = tracker;
  const [selectedId, setSelectedId] = useState<string>("all");
  const [kind, setKind] = useState<PeriodKind>("month");
  const [anchor, setAnchor] = useState<DateKey>(today);
  const [custom, setCustom] = useState<Range>({ from: addDays(today, -29), to: today });
  const [day, setDay] = useState<DateKey | null>(null);

  // "all", an activity id, or "cat:<name>" ("cat:" = activities without a category).
  const categoryFilter = selectedId.startsWith("cat:") ? selectedId.slice(4) : null;
  const selected = selectedId === "all" || categoryFilter !== null ? null : tracker.get(selectedId);
  const categories = useMemo(() => categoriesOf(activities), [activities]);
  const range = periodRange(kind, anchor, custom);
  const prev = previousRange(kind, range);
  const heatTo = minKey(range.to, maxKey(today, range.from));
  const heatFrom = diffDays(range.from, range.to) >= 83 ? range.from : startOfWeekKey(addDays(heatTo, -83));
  const data = useActivityLogsRange(minKey(prev.from, heatFrom), maxKey(range.to, heatTo));

  // Archived activities stay in analytics: their history still counts.
  const scope = useMemo(
    () =>
      selected
        ? [selected]
        : activities.filter((a) => a.startDate <= range.to && (categoryFilter === null || (categoryFilter === "" ? !a.category : a.category === categoryFilter))),
    [selected, activities, range.to, categoryFilter],
  );

  if (tracker.status === "loading") {
    return (
      <Shell>
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </Shell>
    );
  }
  if (tracker.status === "error") {
    return (
      <Shell>
        <ErrorState error={tracker.error} onRetry={tracker.retry} />
      </Shell>
    );
  }
  if (!activities.length) {
    return (
      <Shell>
        <EmptyState icon={Activity} title="No activities yet" description="Add an activity on the Today tab — your consistency charts will appear here." />
      </Shell>
    );
  }

  const canGoNext = kind !== "custom" && shiftAnchor(kind, anchor, 1) <= today && periodRange(kind, shiftAnchor(kind, anchor, 1), custom).from <= today;

  return (
    <Shell>
      <section aria-label="Filters" className="space-y-3">
        <div className="relative">
          <label htmlFor="activity-filter" className="sr-only">
            Activity
          </label>
          <select
            id="activity-filter"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-input bg-card pr-10 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="all">All activities</option>
            {categories.length ? (
              <optgroup label="Categories">
                {categories.map((c) => (
                  <option key={c} value={`cat:${c}`}>
                    {c}
                  </option>
                ))}
                {activities.some((a) => !a.category) ? <option value="cat:">No category</option> : null}
              </optgroup>
            ) : null}
            {live.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {activities.some((a) => a.status === "archived") ? (
              <optgroup label="Archived">
                {activities
                  .filter((a) => a.status === "archived")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <div role="group" aria-label="Period" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {PERIODS.map((p) => (
            <Chip
              key={p.value}
              selected={kind === p.value}
              onClick={() => {
                setKind(p.value);
                setAnchor(today);
              }}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        {kind === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="fit-from" className="text-sm font-medium">
                From
              </label>
              <Input
                id="fit-from"
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => isDateKey(e.target.value) && e.target.value <= custom.to && setCustom({ ...custom, from: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fit-to" className="text-sm font-medium">
                To
              </label>
              <Input
                id="fit-to"
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(e) => isDateKey(e.target.value) && e.target.value >= custom.from && setCustom({ ...custom, to: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon-lg" onClick={() => setAnchor(shiftAnchor(kind, anchor, -1))} aria-label="Previous period">
              <ChevronLeft aria-hidden />
            </Button>
            <p aria-live="polite" className="text-sm font-semibold">
              {periodLabel(kind, range, today)}
            </p>
            <Button variant="ghost" size="icon-lg" onClick={() => setAnchor(shiftAnchor(kind, anchor, 1))} disabled={!canGoNext} aria-label="Next period">
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </section>

      {data.status === "error" ? (
        <ErrorState error={data.error} onRetry={data.retry} />
      ) : data.status === "loading" ? (
        <Skeleton className="h-64 rounded-3xl" aria-label="Loading" />
      ) : (
        <Report
          scope={scope}
          selected={selected}
          index={data.index}
          range={range}
          prev={prev}
          heatFrom={heatFrom}
          heatTo={heatTo}
          kind={kind}
          day={day}
          onDay={setDay}
          onPickActivity={setSelectedId}
        />
      )}

      <DaySheet date={day} activities={selected ? [selected] : live.filter((a) => a.status === "active")} onOpenChange={(open) => !open && setDay(null)} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">Activities</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Analytics</h1>
      </header>
      <ActivityTabs />
      {children}
    </div>
  );
}

interface ReportProps {
  scope: TrackedActivity[];
  selected: TrackedActivity | null;
  index: DoneIndex;
  range: Range;
  prev: Range;
  heatFrom: DateKey;
  heatTo: DateKey;
  kind: PeriodKind;
  day: DateKey | null;
  onDay: (date: DateKey) => void;
  onPickActivity: (id: string) => void;
}

function Report({ scope, selected, index, range, prev, heatFrom, heatTo, kind, day, onDay, onPickActivity }: ReportProps) {
  const tracker = useActivityTracker();
  const { today, since } = tracker;
  const live = tracker.index;

  const m = useMemo(() => {
    const current = periodSummary(scope, index, range.from, range.to, today);
    const previous = periodSummary(scope, index, prev.from, prev.to, today);
    const days = diffDays(range.from, minKey(range.to, today)) + 1;
    const weekly = days > 62;
    const trend: ActivityBar[] = weekly
      ? weeklyCompletion(scope, index, range.from, range.to, today).map((w) => ({
          key: w.week,
          label: format(fromDateKey(w.week), "d MMM"),
          title: `Week of ${format(fromDateKey(w.week), "d MMM")}: ${w.completed} of ${w.scheduled}`,
          value: w.rate,
        }))
      : dailyCompletion(scope, index, range.from, range.to, today).map((p) => ({
          key: p.date,
          label: format(fromDateKey(p.date), days > 10 ? "d" : "EEE"),
          title: `${format(fromDateKey(p.date), "EEE d MMM")}: ${p.completed} of ${p.scheduled}`,
          value: p.rate,
        }));
    // Provider data (13 months) for "now" figures that don't depend on the chosen period.
    const scopeIds = new Set(scope.map((a) => a.id));
    const scopedIndex: DoneIndex = new Map([...live].filter(([id]) => scopeIds.has(id)));
    const todayPlan = planProgress(dayPlan(scope.filter((a) => a.status === "active"), live, today, today));
    const week = periodSummary(scope, live, startOfWeekKey(today), today, today);
    const streak = selected ? activityStreak(selected, live, today, since) : { ...overallStreak(activeDays(scopedIndex), today), unit: "day" as const };
    return { current, previous, trend, weekly, todayPlan, week, streak };
  }, [scope, index, range, prev, today, live, selected, since]);

  const heat = useMemo(() => heatmap(scope, index, heatFrom, heatTo, today, selected ?? undefined), [scope, index, heatFrom, heatTo, today, selected]);
  const insights = useMemo(() => activityInsights(selected ? [selected] : tracker.live, live, today), [selected, tracker.live, live, today]);
  const elapsed = Math.max(m.current.elapsedDays, 0);
  const prevLabel = kind === "week" ? "last week" : kind === "month" ? "last month" : kind === "year" ? "last year" : "previous period";

  return (
    <>
      <section aria-label="Overview">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Today" value={m.todayPlan.total ? `${m.todayPlan.completed}/${m.todayPlan.total}` : "—"} hint={m.todayPlan.total ? "scheduled done" : "nothing due"} />
          <Tile label="This week" value={`${m.week.completed}/${m.week.scheduled}`} hint="scheduled done" />
          <Tile label="Completion" value={pct(m.current.rate)} hint={`${m.current.completed} of ${m.current.scheduled} scheduled`} accent />
          <Tile label="Active days" value={`${m.current.activeDays}`} hint={`of ${elapsed} day${elapsed === 1 ? "" : "s"}`} />
          <Tile label="Current streak" value={`${m.streak.current}`} hint={m.streak.unit === "week" ? "weeks" : selected ? "scheduled days" : "days in a row"} />
          <Tile label="Best streak" value={`${m.streak.best}`} hint="last 13 months" />
          <Tile label="Sessions" value={`${m.current.sessions}`} hint={`${m.current.activeDays} active day${m.current.activeDays === 1 ? "" : "s"}`} />
          <Tile label="Time invested" value={m.current.duration ? formatMinutes(m.current.duration) : "—"} hint={m.current.duration ? "recorded minutes" : "no minutes recorded"} />
        </dl>
      </section>

      <ChartCard
        title={selected ? `${selected.name} calendar` : "Consistency"}
        subtitle={`${format(fromDateKey(heatFrom), "d MMM")} – ${format(fromDateKey(heatTo), "d MMM yyyy")} · tap a day to view or edit`}
      >
        <ActivityHeatmap weeks={heat} activity={selected} selected={day} onSelect={onDay} />
      </ChartCard>

      <ChartCard
        title="Completion rate"
        subtitle={`${m.weekly ? "Per week" : "Per day"} · dashed line = period average`}
        table={{ columns: [m.weekly ? "Week" : "Day", "Done"], rows: m.trend.map((t) => [t.title.split(":")[0], t.value === null ? "—" : `${Math.round(t.value * 100)}%`]) }}
      >
        {m.trend.some((t) => t.value !== null) ? (
          <RateBars data={m.trend} average={m.current.rate} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing was scheduled in this period.</p>
        )}
      </ChartCard>

      <Comparison current={m.current} previous={m.previous} label={prevLabel} unit={selected?.unit ?? null} />

      {selected ? <ActivityBreakdown activity={selected} index={index} range={range} /> : <ActivityList scope={scope} index={index} range={range} onPick={onPickActivity} />}

      {selected ? null : <TimeAndAmounts scope={scope} index={index} range={range} onPick={onPickActivity} />}

      {insights.length ? (
        <section aria-labelledby="fit-insights" className="rounded-3xl border bg-card p-5">
          <h2 id="fit-insights" className="mb-3 font-semibold">
            Insights
          </h2>
          <ul className="space-y-3">
            {insights.map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    i.tone === "positive" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : i.tone === "warning" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary",
                  )}
                >
                  <Lightbulb className="size-4" />
                </span>
                <span className="pt-1.5">{i.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Calculated from your records: a day counts once per activity; today counts only once it&apos;s done.</p>
        </section>
      ) : null}
    </>
  );
}

function Comparison({ current, previous, label, unit }: { current: PeriodSummary; previous: PeriodSummary; label: string; unit: string | null }) {
  const rows: { name: string; now: number | null; before: number | null; format: (n: number) => string }[] = [
    { name: "Completion rate", now: current.rate, before: previous.rate, format: (n) => `${Math.round(n * 100)}%` },
    { name: "Active days", now: current.activeDays, before: previous.activeDays, format: String },
    { name: "Sessions", now: current.sessions, before: previous.sessions, format: String },
  ];
  if (current.duration || previous.duration) rows.push({ name: "Time invested", now: current.duration, before: previous.duration, format: formatMinutes });
  if (unit && (current.quantity || previous.quantity)) rows.push({ name: unit.charAt(0).toUpperCase() + unit.slice(1), now: current.quantity, before: previous.quantity, format: (n) => n.toLocaleString() });
  return (
    <section aria-labelledby="fit-compare" className="rounded-3xl border bg-card p-5">
      <h2 id="fit-compare" className="font-semibold">
        Compared with {label}
      </h2>
      <table className="mt-3 w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">This period</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const diff = r.now !== null && r.before !== null ? r.now - r.before : null;
            return (
              <tr key={r.name}>
                <th scope="row" className="py-2.5 text-left font-normal text-muted-foreground">
                  {r.name}
                </th>
                <td className="py-2.5 text-right font-semibold tabular-nums">{r.now === null ? "—" : r.format(r.now)}</td>
                <td className="w-28 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                  {diff !== null && diff !== 0 ? (
                    <span className={cn("inline-flex items-center gap-0.5", diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                      {diff > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
                      {r.name === "Completion rate" ? `${Math.abs(Math.round(diff * 100))} pts` : r.name === "Time invested" ? formatMinutes(Math.abs(diff)) : Math.abs(diff).toLocaleString()}
                    </span>
                  ) : null}
                  <span className="block">was {r.before === null ? "—" : r.format(r.before)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ActivityList({ scope, index, range, onPick }: { scope: TrackedActivity[]; index: DoneIndex; range: Range; onPick: (id: string) => void }) {
  const { today, since } = useActivityTracker();
  const live = useActivityTracker().index;
  const rows = scope
    .map((a) => ({ a, c: scheduledCompletion(a, index, range.from, range.to, today), s: activityStreak(a, live, today, since) }))
    .sort((x, y) => (y.c.rate ?? -1) - (x.c.rate ?? -1));
  return (
    <section aria-labelledby="fit-by-activity" className="rounded-3xl border bg-card p-5">
      <h2 id="fit-by-activity" className="mb-3 font-semibold">
        By activity
      </h2>
      <ul className="space-y-1">
        {rows.map(({ a, c, s }) => (
          <li key={a.id}>
            <button type="button" onClick={() => onPick(a.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
              <ActivityIcon activity={a} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    {a.name}
                    {a.status === "archived" ? <span className="ml-1 text-xs font-normal text-muted-foreground">(archived)</span> : null}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{pct(c.rate)}</span>
                </span>
                <ProgressBar value={c.rate ?? 0} size="sm" colorClassName={CATEGORY_COLORS[a.color].solid} label={`${a.name} completion`} className="mt-1.5" />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {c.completed} of {c.scheduled} scheduled · streak {s.current} {s.unit === "week" ? "wk" : "d"} · best {s.best}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityBreakdown({ activity, index, range }: { activity: TrackedActivity; index: DoneIndex; range: Range }) {
  const { today, index: live } = useActivityTracker();
  const summary = periodSummary([activity], index, range.from, range.to, today);
  const week = scheduledCompletion(activity, live, startOfWeekKey(today), today, today);
  const month = scheduledCompletion(activity, live, startOfMonthKey(today), today, today);
  const span = diffDays(range.from, minKey(range.to, today)) + 1;
  const byMonth = span > 120;
  const bars: ActivityBar[] = [];
  if (byMonth) {
    for (let mo = startOfMonthKey(range.from); mo <= minKey(range.to, today); mo = addMonthsKey(mo, 1)) {
      const s = periodSummary([activity], index, mo, endOfMonthKey(mo), today);
      bars.push({ key: mo, label: format(fromDateKey(mo), "MMM"), title: `${format(fromDateKey(mo), "MMMM yyyy")}: ${s.activeDays} days`, value: s.activeDays });
    }
  } else {
    for (let w = startOfWeekKey(range.from); w <= minKey(range.to, today); w = addDays(w, 7)) {
      const s = periodSummary([activity], index, maxKey(w, range.from), minKey(addDays(w, 6), range.to), today);
      bars.push({ key: w, label: format(fromDateKey(w), "d MMM"), title: `Week of ${format(fromDateKey(w), "d MMM")}: ${s.activeDays} days`, value: s.activeDays });
    }
  }
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Completions" value={`${summary.activeDays}`} hint={summary.sessions !== summary.activeDays ? `${summary.sessions} sessions` : "days done"} />
        <Tile label="Scheduled rate" value={pct(summary.rate)} hint={`${summary.completed} of ${summary.scheduled}`} />
        <Tile label="Weekly consistency" value={pct(week.rate)} hint="this week" />
        <Tile label="Monthly consistency" value={pct(month.rate)} hint="this month" />
        {summary.duration ? <Tile label="Time invested" value={formatMinutes(summary.duration)} hint={`${summary.sessions} session${summary.sessions === 1 ? "" : "s"}`} /> : null}
        {summary.quantity ? <Tile label={`Total ${activity.unit ?? "amount"}`} value={summary.quantity.toLocaleString()} hint="recorded" /> : null}
      </dl>
      <ChartCard
        title={byMonth ? "Days done per month" : "Days done per week"}
        table={{ columns: [byMonth ? "Month" : "Week", "Days"], rows: bars.map((b) => [b.title.split(":")[0], b.value ?? 0]) }}
      >
        <CountBars data={bars} color={CATEGORY_COLORS[activity.color].hex} />
      </ChartCard>
    </>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-3.5", accent ? "border-transparent bg-primary text-primary-foreground" : "bg-card")}>
      <dt className={cn("text-xs", accent ? "text-primary-foreground/75" : "text-muted-foreground")}>{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint ? <dd className={cn("mt-0.5 truncate text-[11px]", accent ? "text-primary-foreground/75" : "text-muted-foreground")}>{hint}</dd> : null}
    </div>
  );
}

/**
 * Time invested and amounts per activity, plus time by category. Each measure is separate:
 * days done, sessions, minutes (only from records with a duration) and quantity in the
 * activity's own unit (never summed across units).
 */
function TimeAndAmounts({ scope, index, range, onPick }: { scope: TrackedActivity[]; index: DoneIndex; range: Range; onPick: (id: string) => void }) {
  const { today } = useActivityTracker();
  const rows = scope
    .map((a) => ({ a, t: activityTotals(index, a.id, range.from, range.to, today) }))
    .filter((r) => r.t.sessions > 0)
    .sort((x, y) => y.t.minutes - x.t.minutes || y.t.daysDone - x.t.daysDone);
  const byCategory = totalsByCategory(scope, index, range.from, range.to, today);
  const showCategories = byCategory.some((c) => c.category !== null) && byCategory.some((c) => c.minutes > 0);
  const maxMinutes = Math.max(1, ...byCategory.map((c) => c.minutes));
  if (!rows.length) return null;
  return (
    <section aria-labelledby="act-time" className="rounded-3xl border bg-card p-5">
      <h2 id="act-time" className="font-semibold">
        Time &amp; amounts
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">From what you recorded — check-ins without minutes or amounts add none.</p>
      <ul className="divide-y">
        {rows.map(({ a, t }) => (
          <li key={a.id}>
            <button type="button" onClick={() => onPick(a.id)} className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
              <ActivityIcon activity={a} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t.daysDone} day{t.daysDone === 1 ? "" : "s"} done{t.sessions !== t.daysDone ? ` · ${t.sessions} sessions` : ""}
                  {a.category ? ` · ${a.category}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <span className="block font-semibold">{t.minutes ? formatMinutes(t.minutes) : "—"}</span>
                {t.quantity ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {t.quantity.toLocaleString()} {a.unit ?? ""}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {showCategories ? (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-medium">Time by category</h3>
          <ul className="space-y-2.5">
            {byCategory
              .filter((c) => c.minutes > 0)
              .map((c) => (
                <li key={c.category ?? "none"} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.category ?? "No category"}</span>
                    <span className="font-medium tabular-nums">{formatMinutes(c.minutes)}</span>
                  </div>
                  <ProgressBar value={c.minutes / maxMinutes} size="sm" label={`${c.category ?? "No category"} time`} />
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
