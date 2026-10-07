"use client";

import { PAYMENT_METHOD_META, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants/payment-methods";
import { cn } from "@/lib/utils";

interface PaymentMethodPickerProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  name?: string;
  className?: string;
}

/** Segmented control on native radios: tap targets ≥ 44px, keyboard arrows for free. */
export function PaymentMethodPicker({
  value,
  onChange,
  name = "paymentMethod",
  className,
}: PaymentMethodPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Payment method"
      className={cn("grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1", className)}
    >
      {PAYMENT_METHODS.map((method) => {
        const { label, icon: Icon } = PAYMENT_METHOD_META[method];
        const checked = method === value;
        return (
          <label
            key={method}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all select-none",
              "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              checked
                ? "bg-background text-foreground shadow-sm dark:bg-input/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={method}
              checked={checked}
              onChange={() => onChange(method)}
              className="sr-only"
            />
            <Icon className="size-4" aria-hidden />
            {label}
          </label>
        );
      })}
    </div>
  );
}
