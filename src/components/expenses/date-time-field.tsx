"use client";

import { CalendarClock, RotateCcw } from "lucide-react";

import { formatDateTimeLabel, fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
  /** Offer a one-tap reset to the current time (e.g. after the user changed it). */
  showResetToNow?: boolean;
}

/**
 * A compact "Today · 2:30 PM" chip. The real control is a transparent native
 * datetime-local input layered on top, so iOS shows its wheel picker and assistive
 * tech gets a proper labelled field.
 */
export function DateTimeField({
  value,
  onChange,
  id = "occurredAt",
  invalid,
  showResetToNow = false,
}: DateTimeFieldProps) {
  const date = fromDateTimeLocalValue(value);

  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={cn(
          "relative inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3.5 text-sm font-medium transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted",
          invalid && "border-destructive text-destructive",
        )}
      >
        <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
        <span aria-hidden>{date ? formatDateTimeLabel(date) : "Pick date & time"}</span>
        <input
          id={id}
          type="datetime-local"
          aria-label="Date and time"
          value={value}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker?.();
            } catch {
              // showPicker can throw if not triggered by a user gesture; the native
              // input still opens on tap.
            }
          }}
          className="absolute inset-0 min-h-0 cursor-pointer appearance-none opacity-0"
        />
      </div>
      {showResetToNow ? (
        <button
          type="button"
          onClick={() => onChange(toDateTimeLocalValue(new Date()))}
          className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Now
        </button>
      ) : null}
    </div>
  );
}
