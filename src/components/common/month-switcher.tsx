"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMonth, shiftMonth } from "@/lib/months";
import type { MonthKey } from "@/types";

interface MonthSwitcherProps {
  value: MonthKey;
  onChange: (month: MonthKey) => void;
  /** Latest selectable month (defaults to unlimited). */
  max?: MonthKey;
}

export function MonthSwitcher({ value, onChange, max }: MonthSwitcherProps) {
  const next = shiftMonth(value, 1);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <Button variant="ghost" size="icon-lg" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <ChevronLeft aria-hidden />
      </Button>
      <span aria-live="polite" className="min-w-28 text-center text-sm font-semibold">
        {formatMonth(value)}
      </span>
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => onChange(next)}
        disabled={max !== undefined && next > max}
        aria-label="Next month"
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
