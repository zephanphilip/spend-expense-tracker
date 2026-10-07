"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { AccountIcon } from "@/components/accounts/account-icon";
import { CategoryIcon } from "@/components/categories/category-icon";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AnalyticsFilters, hasFilters, NO_FILTERS } from "@/lib/analytics/dataset";
import { ANALYTICS_PERIOD_LABELS, ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/analytics/period";
import { PAYMENT_METHOD_META, PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { NO_ACCOUNT } from "@/lib/stats/monthly";
import { Chip } from "@/components/common/chip";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts } from "@/providers/finance-provider";


interface PeriodPickerProps {
  value: AnalyticsPeriod;
  onChange: (value: AnalyticsPeriod) => void;
  custom: { from: string; to: string };
  onCustomChange: (value: { from: string; to: string }) => void;
}

export function PeriodPicker({ value, onChange, custom, onCustomChange }: PeriodPickerProps) {
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Period" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {ANALYTICS_PERIODS.map((p) => (
          <Chip key={p} selected={value === p} onClick={() => onChange(p)}>
            {ANALYTICS_PERIOD_LABELS[p]}
          </Chip>
        ))}
      </div>
      {value === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="an-from">From</Label>
            <Input id="an-from" type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => onCustomChange({ ...custom, from: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="an-to">To</Label>
            <Input id="an-to" type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => onCustomChange({ ...custom, to: e.target.value })} className="h-11 rounded-xl" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function FilterButton({
  value,
  onChange,
  compare,
  onCompareChange,
}: {
  value: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void;
  compare: boolean;
  onCompareChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { categories, getCategory } = useCategories();
  const accounts = useAccounts();
  const { name } = accounts;
  const count = value.categoryIds.length + value.accountIds.length + value.paymentMethods.length;

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...value.categoryIds.map((id) => ({ key: `c-${id}`, label: getCategory(id).name, clear: () => onChange({ ...value, categoryIds: value.categoryIds.filter((x) => x !== id) }) })),
    ...value.accountIds.map((id) => ({ key: `a-${id}`, label: id === NO_ACCOUNT ? "No account" : name(id) ?? id, clear: () => onChange({ ...value, accountIds: value.accountIds.filter((x) => x !== id) }) })),
    ...value.paymentMethods.map((m) => ({ key: `m-${m}`, label: PAYMENT_METHOD_META[m].label, clear: () => onChange({ ...value, paymentMethods: value.paymentMethods.filter((x) => x !== m) }) })),
  ];

  return (
    <>
      <Button variant="outline" className="relative h-9 rounded-full px-3.5" onClick={() => setOpen(true)} aria-label={count ? `Filters, ${count} active` : "Filters"}>
        <SlidersHorizontal aria-hidden />
        Filters
        {count ? <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{count}</span> : null}
      </Button>
      {chips.length ? (
        <ul aria-label="Active filters" className="order-last flex w-full flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={c.clear} className="inline-flex h-8 items-center gap-1 rounded-full bg-muted pr-2 pl-3 text-xs font-medium hover:bg-muted/70">
                {c.label}
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => onChange(NO_FILTERS)} className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </li>
        </ul>
      ) : null}
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Analytics filters" preventAutoFocus>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-4 md:px-6">
          <SwitchField id="an-compare" label="Compare with previous period" checked={compare} onCheckedChange={onCompareChange} />
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} selected={value.categoryIds.includes(c.id)} onClick={() => onChange({ ...value, categoryIds: toggle(value.categoryIds, c.id) })} className="pl-1.5">
                  <CategoryIcon category={c} size="sm" className="size-6 rounded-full [&_svg]:size-3.5" />
                  {c.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Paid with</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const { label, icon: Icon } = PAYMENT_METHOD_META[m];
                return (
                  <Chip key={m} selected={value.paymentMethods.includes(m)} onClick={() => onChange({ ...value, paymentMethods: toggle(value.paymentMethods, m) })}>
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          {accounts.all.length ? (
            <fieldset>
              <legend className="mb-2.5 text-sm font-medium text-muted-foreground">Accounts</legend>
              <div className="flex flex-wrap gap-2">
                {accounts.all.map((a) => (
                  <Chip key={a.id} selected={value.accountIds.includes(a.id)} onClick={() => onChange({ ...value, accountIds: toggle(value.accountIds, a.id) })} className="pl-1.5">
                    <AccountIcon type={a.type} size="sm" className="size-6 rounded-full" />
                    {a.name}
                  </Chip>
                ))}
                <Chip selected={value.accountIds.includes(NO_ACCOUNT)} onClick={() => onChange({ ...value, accountIds: toggle(value.accountIds, NO_ACCOUNT) })}>
                  No account
                </Chip>
              </div>
            </fieldset>
          ) : null}
          <p className="text-xs text-muted-foreground">Filters combine (e.g. Food AND Credit). Filtered views read individual expenses for the period only.</p>
        </div>
        <div className="flex gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] keyboard:pb-3 md:px-6 md:pb-6">
          <Button variant="outline" className="h-12 flex-1 rounded-xl text-base" onClick={() => onChange(NO_FILTERS)} disabled={!hasFilters(value)}>
            Reset
          </Button>
          <Button className="h-12 flex-1 rounded-xl text-base" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </ResponsiveModal>
    </>
  );
}
