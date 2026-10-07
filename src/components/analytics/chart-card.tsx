"use client";

import { Table2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  /** Legend items (shown for ≥ 2 series). */
  legend?: { label: string; color: string; dashed?: boolean }[];
  /** Accessible table alternative to the chart. */
  table?: TableData;
  className?: string;
  children: ReactNode;
}

/** Card wrapper for every chart: title, legend, the chart, and a "View as table" toggle. */
export function ChartCard({ title, subtitle, legend, table, className, children }: ChartCardProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  return (
    <section aria-labelledby={`${id}-title`} className={cn("rounded-3xl border bg-card p-4 md:p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="font-semibold">
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {table ? (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            aria-label={showTable ? "Show chart" : "View as table"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground"
          >
            <Table2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {legend && legend.length > 1 && !showTable ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block h-2.5 w-2.5 rounded-sm", l.dashed && "h-0.5 w-3 rounded-none")}
                style={{ background: l.color }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      {showTable && table ? (
        <div className="max-h-72 overflow-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={cn("px-2 py-1.5 tabular-nums", j > 0 && "text-right")}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
