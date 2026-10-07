"use client";

import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Money } from "@/components/common/money";
import type { Change, HeatCell } from "@/lib/analytics/metrics";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

import { AXIS_PROPS, ChartTooltip } from "./chart-tooltip";

const compact = (currency: Parameters<typeof formatMoney>[1]) => (v: number) => formatMoney(v, currency, { compact: true });
const GRID = <CartesianGrid vertical={false} stroke="var(--chart-grid)" />;
const CURSOR = { fill: "var(--muted)", opacity: 0.6 };

export interface TrendPoint {
  /** Unique per point (labels like "7" repeat across months). */
  key: string;
  label: string;
  /** Full label for the tooltip. */
  title: string;
  current: number;
  previous?: number;
}

/** Spending over time: bars for this period, a thin grey line for the comparison period. */
export function TrendChart({ points, showPrevious, height = 220 }: { points: TrendPoint[]; showPrevious: boolean; height?: number }) {
  const { currency } = useSession();
  const titles = new Map(points.map((p) => [p.key, p.title]));
  const labels = new Map(points.map((p) => [p.key, p.label]));
  return (
    <div style={{ height }} role="img" aria-label="Spending over time chart. Use the table view for exact values.">
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          {GRID}
          <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={(k) => labels.get(String(k)) ?? String(k)} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={compact(currency)} />
          <Tooltip
            cursor={CURSOR}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} labelFormatter={(l) => titles.get(String(l)) ?? String(l)} />}
          />
          <Bar dataKey="current" name="This period" fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          {showPrevious ? (
            <Line dataKey="previous" name="Previous" stroke="var(--series-previous)" strokeWidth={2} dot={false} type="monotone" />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SimpleBar {
  /** Unique per bar; defaults to label. */
  key?: string;
  label: string;
  title?: string;
  value: number;
  /** Emphasise one bar (e.g. today, the busiest weekday); the rest are muted. */
  highlight?: boolean;
}

export function SimpleBars({ data, height = 180, valueName = "Spent", emphasis = false }: { data: SimpleBar[]; height?: number; valueName?: string; emphasis?: boolean }) {
  const { currency } = useSession();
  const rows = data.map((d) => ({ ...d, key: d.key ?? d.label }));
  const titles = new Map(rows.map((d) => [d.key, d.title ?? d.label]));
  const labels = new Map(rows.map((d) => [d.key, d.label]));
  return (
    <div style={{ height }} role="img" aria-label={`${valueName} bar chart. Use the table view for exact values.`}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
          {GRID}
          <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={(k) => labels.get(String(k)) ?? String(k)} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={compact(currency)} />
          <Tooltip cursor={CURSOR} content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} labelFormatter={(l) => titles.get(String(l)) ?? String(l)} />} />
          <Bar dataKey="value" name={valueName} radius={[4, 4, 0, 0]} maxBarSize={32}>
            {rows.map((d) => (
              <Cell key={d.key} fill={emphasis && !d.highlight ? "var(--series-previous)" : "var(--series-expense)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedCategoryBars({
  rows,
  keys,
  colorOf,
  nameOf,
  height = 240,
}: {
  rows: Record<string, number | string>[];
  keys: string[];
  colorOf: (key: string) => string;
  nameOf: (key: string) => string;
  height?: number;
}) {
  const { currency } = useSession();
  return (
    <div style={{ height }} role="img" aria-label="Category spending by month, stacked. Use the table view for exact values.">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          {GRID}
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={compact(currency)} />
          <Tooltip cursor={CURSOR} content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} />} />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={nameOf(k)}
              stackId="s"
              fill={colorOf(k)}
              // 2px surface gap between stacked segments.
              stroke="var(--card)"
              strokeWidth={2}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeExpenseBars({ points, height = 240 }: { points: { label: string; income: number; expenses: number }[]; height?: number }) {
  const { currency } = useSession();
  return (
    <div style={{ height }} role="img" aria-label="Income and expenses by month. Use the table view for exact values.">
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
          {GRID}
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={compact(currency)} />
          <Tooltip cursor={CURSOR} content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} />} />
          <Bar dataKey="income" name="Income" fill="var(--series-income)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenses" name="Expenses" fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series line on one axis (savings rate %, net worth). */
export function LineSeries({
  points,
  name,
  percent = false,
  height = 200,
  color = "var(--series-expense)",
}: {
  points: { label: string; value: number | null }[];
  name: string;
  percent?: boolean;
  height?: number;
  color?: string;
}) {
  const { currency } = useSession();
  const fmt = percent ? (v: number) => `${Math.round(v * 100)}%` : compact(currency);
  return (
    <div style={{ height }} role="img" aria-label={`${name} line chart. Use the table view for exact values.`}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={fmt} />
          <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.4} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeOpacity: 0.4 }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} valueFormatter={(v) => (percent ? `${(v * 100).toFixed(1)}%` : formatMoney(v, currency))} />}
          />
          <Line dataKey="value" name={name} stroke={color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: color }} activeDot={{ r: 5 }} connectNulls={false} type="linear" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Part-to-whole at a glance (≤ 7 slices incl. "Other"); the list beside it carries exact values. */
export function Donut({ slices, total, size = 168 }: { slices: DonutSlice[]; total: number; size?: number }) {
  const { currency } = useSession();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label="Share of spending by category. Exact values are listed alongside.">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} labelFormatter={() => "Spent"} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] text-muted-foreground">Total</span>
        <span className="text-sm font-semibold">
          <Money amount={total} compact />
        </span>
      </div>
    </div>
  );
}

export function ChangeChip({ change, invert = false, className }: { change: Change; invert?: boolean; className?: string }) {
  if (change.ratio === null || change.delta === 0) return <span className={cn("text-xs text-muted-foreground", className)}>{change.previous === 0 && change.current > 0 ? "new" : "—"}</span>;
  const up = change.delta > 0;
  // For spending, up is bad; `invert` for metrics where up is good (income, savings).
  const good = invert ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", className)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.round(Math.abs(change.ratio) * 100)}%
    </span>
  );
}

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
  icon?: ReactNode;
  change?: Change;
  hint?: ReactNode;
}

/** Ranked horizontal bars as plain HTML — readable on phones, exact values always visible. */
export function BarList({ rows }: { rows: BarListRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3">
          {r.icon ?? <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                {r.change ? <ChangeChip change={r.change} /> : null}
                <Money amount={r.value} className="font-medium" />
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${Math.max(r.share * 100, 1.5)}%`, background: r.color }} />
              </div>
              <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">{Math.round(r.share * 100)}%</span>
            </div>
            {r.hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{r.hint}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

const HEAT_VARS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

/** Calendar heatmap (sequential single-hue ramp, light → dark = less → more). */
export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  const { currency } = useSession();
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-1" role="grid" aria-label="Daily spending calendar">
        <div className="flex flex-col gap-1 pr-1" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="flex h-4 items-center text-[10px] text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].key} className="flex flex-col gap-1" role="row">
            {week.map((cell) => (
              <span
                key={cell.key}
                role="gridcell"
                title={cell.inRange ? `${format(cell.date, "EEE d MMM")}: ${formatMoney(cell.total, currency)}` : undefined}
                aria-label={cell.inRange ? `${format(cell.date, "EEEE d MMMM")}: ${formatMoney(cell.total, currency)}` : undefined}
                className={cn("size-4 rounded-[4px]", !cell.inRange && "opacity-0")}
                style={{ background: HEAT_VARS[cell.level] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground" aria-hidden>
        Less
        {HEAT_VARS.map((v) => (
          <span key={v} className="size-3 rounded-[3px]" style={{ background: v }} />
        ))}
        More
      </div>
    </div>
  );
}
