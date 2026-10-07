"use client";

import type { ComponentProps } from "react";

import { currencySymbol, fractionDigits, sanitizeAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

interface MoneyFieldProps extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
}

/** Compact money input: currency prefix, numeric keypad, sanitised as you type. */
export function MoneyField({ value, onValueChange, invalid, className, ...props }: MoneyFieldProps) {
  const { currency } = useSession();
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
      >
        {currencySymbol(currency)}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(e) => onValueChange(sanitizeAmountInput(e.target.value, fractionDigits(currency)))}
        aria-invalid={invalid || undefined}
        className="h-11 w-full rounded-xl border border-input bg-transparent pr-3 pl-8 text-base tabular-nums outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        {...props}
      />
    </div>
  );
}
