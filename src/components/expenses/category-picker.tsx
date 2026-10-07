"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategoryIcon } from "@/components/categories/category-icon";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/categories-provider";

interface CategoryPickerProps {
  value: string;
  onChange: (categoryId: string) => void;
  name?: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * One-tap category grid built on native radio inputs, so arrow keys, screen readers and
 * form semantics work without extra code. Order is stable to build muscle memory.
 */
export function CategoryPicker({
  value,
  onChange,
  name = "categoryId",
  invalid,
  describedBy,
}: CategoryPickerProps) {
  const { categories, getCategory } = useCategories();
  const [creating, setCreating] = useState(false);

  // Keep showing an archived category if the expense being edited still uses it.
  const selected = value ? getCategory(value) : null;
  const options =
    selected && !categories.some((c) => c.id === selected.id) && selected.id === value
      ? [...categories, selected]
      : categories;

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Category"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="grid grid-cols-5 gap-1"
      >
        {options.map((category) => {
          const checked = category.id === value;
          return (
            <label
              key={category.id}
              className={cn(
                "relative flex min-h-[4.25rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-center transition-colors select-none",
                "hover:bg-muted/70 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                checked ? "bg-primary/8 ring-2 ring-primary dark:bg-primary/15" : "ring-0",
              )}
            >
              <input
                type="radio"
                name={name}
                value={category.id}
                checked={checked}
                onChange={() => onChange(category.id)}
                className="sr-only"
              />
              <CategoryIcon category={category} size="md" />
              <span className="w-full truncate text-[11px] font-medium sm:text-xs">{category.name}</span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-muted-foreground outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-10 items-center justify-center rounded-2xl border border-dashed">
            <Plus className="size-5" aria-hidden />
          </span>
          <span className="text-xs font-medium">New</span>
        </button>
      </div>
      <CategoryFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(id) => onChange(id)}
      />
    </>
  );
}
