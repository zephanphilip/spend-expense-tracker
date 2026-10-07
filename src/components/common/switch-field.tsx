"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SwitchFieldProps {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** Native checkbox styled as an iOS switch (role="switch"). */
export function SwitchField({ id, label, description, checked, onCheckedChange, className }: SwitchFieldProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-xl py-1", className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="h-7 w-12 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
        />
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
