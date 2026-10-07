"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  name: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  className?: string;
}

/** Segmented control on native radios (keyboard arrows + screen readers for free). */
export function Segmented<T extends string>({ name, label, value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-2xl bg-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <label
            key={option.value}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-1 text-sm font-medium transition-all select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              checked ? "bg-background text-foreground shadow-sm dark:bg-input/60" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            <span className="truncate">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
