"use client";

import { Check } from "lucide-react";

import { CATEGORY_COLOR_KEYS, CATEGORY_COLORS } from "@/lib/constants/colors";
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS } from "@/lib/constants/icons";
import { cn } from "@/lib/utils";
import type { CategoryColorKey, CategoryIconKey } from "@/types";

const label = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

export function IconPicker({ name, value, onChange }: { name: string; value: CategoryIconKey; onChange: (v: CategoryIconKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
      {CATEGORY_ICON_KEYS.map((key) => {
        const Icon = CATEGORY_ICONS[key];
        const checked = value === key;
        return (
          <label
            key={key}
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              checked ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <input type="radio" name={name} value={key} checked={checked} onChange={() => onChange(key)} className="sr-only" aria-label={label(key)} />
            <Icon className="size-5" aria-hidden />
          </label>
        );
      })}
    </div>
  );
}

export function ColorPicker({ name, value, onChange }: { name: string; value: CategoryColorKey; onChange: (v: CategoryColorKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {CATEGORY_COLOR_KEYS.map((key) => {
        const checked = value === key;
        return (
          <label
            key={key}
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              CATEGORY_COLORS[key].solid,
              checked && "ring-2 ring-foreground",
            )}
          >
            <input type="radio" name={name} value={key} checked={checked} onChange={() => onChange(key)} className="sr-only" aria-label={CATEGORY_COLORS[key].label} />
            {checked ? <Check className="size-4" aria-hidden /> : null}
          </label>
        );
      })}
    </div>
  );
}
