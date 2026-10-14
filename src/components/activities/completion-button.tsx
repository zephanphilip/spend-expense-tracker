"use client";

import { Check, Plus } from "lucide-react";

import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import type { TrackedActivity } from "@/types/activities";

interface CompletionButtonProps {
  activity: Pick<TrackedActivity, "name" | "color" | "multipleEntries">;
  done: boolean;
  sessions?: number;
  disabled?: boolean;
  /** e.g. "today", "on Mon 5 Oct" — completes the accessible name. */
  when: string;
  onToggle: () => void;
}

/**
 * The one-tap check. Daily check-ins toggle (tap again to undo); multi-session activities
 * add a session per tap and show the count.
 */
export function CompletionButton({ activity, done, sessions = 0, disabled, when, onToggle }: CompletionButtonProps) {
  const multi = activity.multipleEntries;
  const label = multi
    ? `Add a ${activity.name} session ${when}${sessions ? ` (${sessions} so far)` : ""}`
    : done
      ? `${activity.name} done ${when}. Tap to undo`
      : `Mark ${activity.name} done ${when}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={multi ? undefined : done}
      aria-label={label}
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-all duration-200 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        done ? cn("border-transparent text-white shadow-sm", CATEGORY_COLORS[activity.color].solid) : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {multi && !done ? <Plus className="size-5" aria-hidden /> : <Check className={cn("size-5 transition-transform duration-200", done ? "scale-100" : "scale-75 opacity-40")} strokeWidth={3} aria-hidden />}
      {multi && sessions > 1 ? (
        <span aria-hidden className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
          {sessions}
        </span>
      ) : null}
    </button>
  );
}
