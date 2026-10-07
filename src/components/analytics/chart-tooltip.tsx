"use client";

import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";

interface Item {
  name?: unknown;
  value?: unknown;
  color?: string;
}

/** Minimal tooltip: title + one row per series, values in text ink (colour only on the swatch). */
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly Item[];
  label?: unknown;
  currency: CurrencyCode;
  labelFormatter?: (label: unknown) => string;
  valueFormatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-32 rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{labelFormatter ? labelFormatter(label) : String(label ?? "")}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => {
          const value = Number(Array.isArray(p.value) ? p.value[0] : (p.value ?? 0));
          const name = String(p.name ?? "");
          return (
            <li key={`${name}`} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden className="size-2 rounded-sm" style={{ background: p.color }} />
                {name}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {valueFormatter ? valueFormatter(value, name) : formatMoney(value, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const AXIS_PROPS = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
