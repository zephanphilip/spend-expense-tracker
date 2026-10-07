"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_META, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants/payment-methods";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/dates";
import { Chip } from "@/components/common/chip";
import { useCategories } from "@/providers/categories-provider";

export interface ExpenseFilterState {
  period: PeriodPreset;
  /** yyyy-MM-dd, only for the "custom" period. */
  from: string;
  to: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
}

export const DEFAULT_FILTERS: ExpenseFilterState = {
  period: "this-month",
  from: "",
  to: "",
  categoryId: null,
  paymentMethod: null,
};

export function countActiveFilters(f: ExpenseFilterState): number {
  return (
    Number(f.period !== DEFAULT_FILTERS.period) + Number(f.categoryId !== null) + Number(f.paymentMethod !== null)
  );
}


interface ExpenseFiltersProps {
  value: ExpenseFilterState;
  onChange: (value: ExpenseFilterState) => void;
}

export function ExpenseFilters({ value, onChange }: ExpenseFiltersProps) {
  const [open, setOpen] = useState(false);
  const { categories, getCategory } = useCategories();
  const active = countActiveFilters(value);
  const set = (patch: Partial<ExpenseFilterState>) => onChange({ ...value, ...patch });

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (value.period !== DEFAULT_FILTERS.period) {
    const label =
      value.period === "custom"
        ? [value.from || "…", value.to || "…"].join(" → ")
        : PERIOD_LABELS[value.period];
    activeChips.push({ key: "period", label, clear: () => set({ period: DEFAULT_FILTERS.period }) });
  }
  if (value.categoryId) {
    activeChips.push({
      key: "category",
      label: getCategory(value.categoryId).name,
      clear: () => set({ categoryId: null }),
    });
  }
  if (value.paymentMethod) {
    activeChips.push({
      key: "method",
      label: PAYMENT_METHOD_META[value.paymentMethod].label,
      clear: () => set({ paymentMethod: null }),
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-11 shrink-0 rounded-xl px-3.5"
        aria-label={active ? `Filters, ${active} active` : "Filters"}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        <span className="hidden sm:inline">Filters</span>
        {active ? (
          <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {active}
          </span>
        ) : null}
      </Button>

      {activeChips.length > 0 ? (
        <ul aria-label="Active filters" className="order-last flex w-full flex-wrap gap-2">
          {activeChips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.clear}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-muted pr-2 pl-3 text-xs font-medium outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chip.label}
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </li>
        </ul>
      ) : null}

      <ResponsiveModal open={open} onOpenChange={setOpen} title="Filters" preventAutoFocus>
        <div className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-5 pt-2 pb-4 md:px-6">
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Period</legend>
            <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map((preset) => (
                <Chip key={preset} selected={value.period === preset} onClick={() => set({ period: preset })}>
                  {PERIOD_LABELS[preset]}
                </Chip>
              ))}
            </div>
            {value.period === "custom" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-from">From</Label>
                  <Input
                    id="filter-from"
                    type="date"
                    value={value.from}
                    max={value.to || undefined}
                    onChange={(e) => set({ from: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-to">To</Label>
                  <Input
                    id="filter-to"
                    type="date"
                    value={value.to}
                    min={value.from || undefined}
                    onChange={(e) => set({ to: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Paid with</legend>
            <div className="flex flex-wrap gap-2">
              <Chip selected={value.paymentMethod === null} onClick={() => set({ paymentMethod: null })}>
                Any
              </Chip>
              {PAYMENT_METHODS.map((method) => {
                const { label, icon: Icon } = PAYMENT_METHOD_META[method];
                return (
                  <Chip
                    key={method}
                    selected={value.paymentMethod === method}
                    onClick={() => set({ paymentMethod: method })}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Chip>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Category</legend>
            <div className="flex flex-wrap gap-2">
              <Chip selected={value.categoryId === null} onClick={() => set({ categoryId: null })}>
                All
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  selected={value.categoryId === category.id}
                  onClick={() => set({ categoryId: category.id })}
                  className="pl-1.5"
                >
                  <CategoryIcon category={category} size="sm" className="size-6 rounded-full [&_svg]:size-3.5" />
                  {category.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] keyboard:pb-3 md:px-6 md:pb-6">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl text-base"
            onClick={() => onChange(DEFAULT_FILTERS)}
            disabled={active === 0}
          >
            Reset
          </Button>
          <Button type="button" className="h-12 flex-1 rounded-xl text-base" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </ResponsiveModal>
    </>
  );
}
