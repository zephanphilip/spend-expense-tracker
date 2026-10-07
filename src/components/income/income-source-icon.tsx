import { INCOME_SOURCE_META } from "@/lib/constants/income";
import { cn } from "@/lib/utils";
import type { IncomeSource } from "@/types";

export function IncomeSourceIcon({ source, className }: { source: IncomeSource; className?: string }) {
  const { icon: Icon, tile } = INCOME_SOURCE_META[source];
  return (
    <span aria-hidden className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-5", tile, className)}>
      <Icon />
    </span>
  );
}
