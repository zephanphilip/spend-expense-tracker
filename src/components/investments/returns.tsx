import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";

export function Returns({ absolute, ratio, className }: { absolute: number; ratio: number | null; className?: string }) {
  const up = absolute >= 0;
  return (
    <span className={cn("tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", className)}>
      {up ? "+" : "−"}
      <Money amount={Math.abs(absolute)} />
      {ratio !== null ? ` (${up ? "+" : "−"}${Math.abs(ratio * 100).toFixed(1)}%)` : ""}
    </span>
  );
}
