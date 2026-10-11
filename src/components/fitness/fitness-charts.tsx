"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS_PROPS, ChartTooltip } from "@/components/analytics/chart-tooltip";
import { useSession } from "@/providers/auth-provider";

export interface FitnessBar {
  key: string;
  label: string;
  title: string;
  /** 0..1 for rates, counts otherwise; null = nothing was due. */
  value: number | null;
  highlight?: boolean;
}

const GRID = <CartesianGrid vertical={false} stroke="var(--chart-grid)" />;
const CURSOR = { fill: "var(--muted)", opacity: 0.6 };

/** Completion rate (0–100%) per day or week. Days with nothing due show no bar. */
export function RateBars({ data, height = 200, color = "var(--series-income)", average }: { data: FitnessBar[]; height?: number; color?: string; average?: number | null }) {
  const { currency } = useSession();
  const titles = new Map(data.map((d) => [d.key, d.title]));
  const labels = new Map(data.map((d) => [d.key, d.label]));
  return (
    <div style={{ height }} role="img" aria-label="Completion rate chart. Use the table view for exact values.">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
          {GRID}
          <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={(k) => labels.get(String(k)) ?? String(k)} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...AXIS_PROPS} width={40} domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          {average !== null && average !== undefined ? <ReferenceLine y={average} stroke="var(--chart-axis)" strokeDasharray="4 4" strokeOpacity={0.6} /> : null}
          <Tooltip
            cursor={CURSOR}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                payload={p.payload as never}
                label={p.label}
                currency={currency}
                labelFormatter={(l) => titles.get(String(l)) ?? String(l)}
                valueFormatter={(v) => `${Math.round(v * 100)}% done`}
              />
            )}
          />
          <Bar dataKey="value" name="Completed" radius={[4, 4, 0, 0]} maxBarSize={28} minPointSize={2}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.highlight === false ? "var(--series-previous)" : color} fillOpacity={d.value === 0 ? 0.35 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Plain counts (sessions or days done) per period. */
export function CountBars({ data, height = 180, color = "var(--series-expense)", name = "Days done" }: { data: FitnessBar[]; height?: number; color?: string; name?: string }) {
  const { currency } = useSession();
  const titles = new Map(data.map((d) => [d.key, d.title]));
  const labels = new Map(data.map((d) => [d.key, d.label]));
  return (
    <div style={{ height }} role="img" aria-label={`${name} chart. Use the table view for exact values.`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          {GRID}
          <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={(k) => labels.get(String(k)) ?? String(k)} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
          <Tooltip
            cursor={CURSOR}
            content={(p) => (
              <ChartTooltip active={p.active} payload={p.payload as never} label={p.label} currency={currency} labelFormatter={(l) => titles.get(String(l)) ?? String(l)} valueFormatter={(v) => String(v)} />
            )}
          />
          <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
