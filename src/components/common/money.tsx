"use client";

import { formatMoney, type FormatMoneyOptions } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

interface MoneyProps extends FormatMoneyOptions {
  amount: number;
  className?: string;
}

/** Formats minor units in the signed-in user's currency with tabular figures. */
export function Money({ amount, className, ...options }: MoneyProps) {
  const { currency } = useSession();
  return <span className={cn("tabular-nums", className)}>{formatMoney(amount, currency, options)}</span>;
}
