import { cn } from "@/lib/utils";

export type ProgressTone = "primary" | "ok" | "warning" | "over" | "muted";

const TONES: Record<ProgressTone, string> = {
  primary: "bg-primary",
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  over: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

interface ProgressBarProps {
  /** 0..1 (values above 1 render full). */
  value: number;
  tone?: ProgressTone;
  /** Overrides tone with a solid color class (e.g. category color). */
  colorClassName?: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, tone = "primary", colorClassName, label, className, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 1, 0), 1);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", colorClassName ?? TONES[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
