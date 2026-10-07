"use client";

import { Ban } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAccounts } from "@/providers/finance-provider";
import type { AccountType } from "@/types";

import { AccountIcon } from "./account-icon";

interface AccountPickerProps {
  name: string;
  label: string;
  /** "" = not linked to an account. */
  value: string;
  onChange: (accountId: string) => void;
  /** Offer "None" (untracked). */
  allowNone?: boolean;
  /** Restrict to these account types. */
  types?: readonly AccountType[];
  /** Hide this account (e.g. the other side of a transfer). */
  exclude?: string;
  className?: string;
}

/**
 * Horizontally scrolling chips over native radios. Renders nothing when the user has no
 * accounts, so Phase 1/2 flows look exactly as before until accounts are set up.
 */
export function AccountPicker({ name, label, value, onChange, allowNone = true, types, exclude, className }: AccountPickerProps) {
  const { active, get } = useAccounts();
  let options = active.filter((a) => (!types || types.includes(a.type)) && a.id !== exclude);
  // Keep showing an inactive/filtered account that's currently selected (editing old records).
  const selected = get(value);
  if (selected && !options.some((a) => a.id === selected.id)) options = [...options, selected];
  if (options.length === 0 && !allowNone) return null;
  if (active.length === 0) return null;

  const chip = (checked: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-medium transition-colors select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
      checked ? "border-primary bg-primary/8 text-foreground ring-1 ring-primary dark:bg-primary/15" : "bg-background text-muted-foreground hover:bg-muted",
    );

  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-muted-foreground">{label}</legend>
      <div role="radiogroup" aria-label={label} className="-mx-4 -my-1 flex scroll-px-4 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6">
        {allowNone ? (
          <label className={cn(chip(value === ""), "pl-3")}>
            <input type="radio" name={name} value="" checked={value === ""} onChange={() => onChange("")} className="sr-only" />
            <Ban className="size-4" aria-hidden />
            None
          </label>
        ) : null}
        {options.map((account) => (
          <label key={account.id} className={chip(value === account.id)}>
            <input
              type="radio"
              name={name}
              value={account.id}
              checked={value === account.id}
              onChange={() => onChange(account.id)}
              className="sr-only"
            />
            <AccountIcon type={account.type} size="sm" />
            <span className="max-w-32 truncate">{account.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
