import { cn } from "@/lib/utils";

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 5v14h10" />
          <path d="M11 9h6" />
          <path d="M11 13h4" />
        </svg>
      </span>
      {withWordmark ? <span className="text-lg">Ledger</span> : <span className="sr-only">Ledger</span>}
    </span>
  );
}
