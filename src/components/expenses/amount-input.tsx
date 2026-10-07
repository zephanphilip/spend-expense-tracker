"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface AmountInputProps extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  currencySymbol: string;
  invalid?: boolean;
}

/**
 * Large, centered amount field. `inputMode="decimal"` brings up the numeric keypad with a
 * decimal point on iOS/Android; the input grows with its content so the symbol stays snug.
 */
export function AmountInput({
  value,
  onValueChange,
  currencySymbol,
  invalid,
  className,
  id = "amount",
  ref,
  ...props
}: AmountInputProps) {
  // Left-aligned so slack from narrow glyphs (".") falls on the right, not after the symbol.
  const width = `${Math.max(value.length, 1) + 0.25}ch`;
  return (
    <div
      className={cn(
        "flex items-baseline justify-center gap-1 text-foreground",
        invalid && "text-destructive",
        className,
      )}
    >
      <span className="text-3xl font-medium text-muted-foreground" aria-hidden>
        {currencySymbol}
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder="0"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={invalid || undefined}
        style={{ width }}
        className="min-w-[1.5ch] max-w-full bg-transparent text-left text-5xl font-semibold tracking-tight tabular-nums caret-primary outline-none placeholder:text-muted-foreground/40"
        {...props}
      />
    </div>
  );
}
