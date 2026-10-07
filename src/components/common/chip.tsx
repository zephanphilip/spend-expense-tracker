import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Toggle chip (aria-pressed) used by filter sheets and period pickers. */
export function Chip({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
