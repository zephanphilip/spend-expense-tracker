"use client";

import { AlertTriangle, Check, ChevronRight, CloudOff, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";

import { CategoryIcon } from "@/components/categories/category-icon";
import { ProgressBar } from "@/components/common/progress-bar";
import { AmountInput } from "@/components/expenses/amount-input";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_META, type PaymentMethod } from "@/lib/constants/payment-methods";
import { type ExpenseUsage, rankByUsage, rankPaymentMethods, recentIds } from "@/lib/expense-preferences";
import { formatMonth, monthKey } from "@/lib/months";
import type { BudgetOutcome, QuickAddDraft, SavedExpense } from "@/lib/quick-add/machine";
import { cn } from "@/lib/utils";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import type { Category } from "@/types";

/** Large primary action, thumb-height. */
function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn("h-14 w-full rounded-2xl text-base font-semibold", className)} {...props} />;
}

export function StepTitle({ id, children, hint }: { id: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1 text-center">
      {/* Focused on each step change so VoiceOver announces where the user is. */}
      <h1 id={id} tabIndex={-1} className="text-lg font-semibold outline-none">
        {children}
      </h1>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Bottom action area: sits above the home indicator, or right above the keyboard. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 space-y-2 px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] keyboard:pb-3">
      {children}
    </div>
  );
}

// ── Amount ──────────────────────────────────────────────────────────────────────────────

export function AmountStep({
  value,
  symbol,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  symbol: string;
  error: string | null;
  onChange: (raw: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* Tapping anywhere in this area focuses the field (iOS only opens the keyboard on a tap). */}
      <label htmlFor="amount" className="flex min-h-0 flex-1 cursor-text flex-col items-center justify-center gap-6 px-4">
        <span id="step-title" className="text-lg font-semibold">
          Add expense
        </span>
        <AmountInput
          value={value}
          onValueChange={onChange}
          currencySymbol={symbol}
          invalid={Boolean(error)}
          aria-label="Amount"
          aria-describedby={error ? "amount-error" : undefined}
          enterKeyHint="next"
          autoFocus
          className="[&_input]:text-6xl"
        />
        <p id="amount-error" role="alert" className="min-h-5 text-sm text-destructive">
          {error}
        </p>
      </label>
      <ActionBar>
        <PrimaryButton type="submit">Continue</PrimaryButton>
      </ActionBar>
    </form>
  );
}

// ── Category ────────────────────────────────────────────────────────────────────────────

function CategoryTile({
  category,
  remaining,
  formatAmount,
  selected,
  onPick,
}: {
  category: Category;
  remaining: number | undefined;
  formatAmount: (minor: number) => string;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  const hint =
    remaining === undefined ? null : remaining >= 0 ? `${formatAmount(remaining)} left` : `${formatAmount(-remaining)} over`;
  return (
    <button
      type="button"
      onClick={() => onPick(category.id)}
      aria-pressed={selected}
      aria-label={hint ? `${category.name}, ${hint}` : category.name}
      className={cn(
        "flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/50 px-1 py-2 text-center outline-none transition-transform active:scale-95",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-primary",
      )}
    >
      <CategoryIcon category={category} size="md" />
      <span className="w-full truncate text-sm font-medium">{category.name}</span>
      {hint ? (
        <span className={cn("w-full truncate text-[11px] tabular-nums", remaining! < 0 ? "text-destructive" : "text-muted-foreground")}>
          {hint}
        </span>
      ) : null}
    </button>
  );
}

export function CategoryStep({
  categories,
  usage,
  selectedId,
  remainingByCategory,
  formatAmount,
  onPick,
}: {
  categories: readonly Category[];
  usage: ExpenseUsage;
  selectedId: string | null;
  remainingByCategory: Map<string, number>;
  formatAmount: (minor: number) => string;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());
  const ranked = useMemo(() => rankByUsage(categories, (c) => c.id, usage.categories, now), [categories, usage, now]);
  const recent = useMemo(
    () =>
      recentIds(usage.categories, 4)
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is Category => Boolean(c)),
    [categories, usage],
  );
  const needle = search.trim().toLowerCase();
  const results = needle ? ranked.filter((c) => c.name.toLowerCase().includes(needle)) : ranked;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-[max(1rem,env(safe-area-inset-left))] pb-3">
        <StepTitle id="step-title">Category</StepTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) {
                e.preventDefault();
                onPick(results[0].id);
              }
            }}
            placeholder="Search categories"
            aria-label="Search categories"
            enterKeyHint="go"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-input bg-transparent pr-3 pl-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!needle && recent.length > 0 ? (
          <section aria-labelledby="recent-title" className="space-y-2 short:hidden">
            <h2 id="recent-title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Recent
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recent.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPick(c.id)}
                  aria-label={`${c.name}, recent`}
                  className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-muted/60 pr-4 pl-1.5 text-sm font-medium outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CategoryIcon category={c} size="sm" />
                  {c.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section aria-labelledby="all-title" className="space-y-2">
          <h2 id="all-title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {needle ? `${results.length} found` : Object.keys(usage.categories).length ? "Most used first" : "All categories"}
          </h2>
          {results.length ? (
            <div className="grid grid-cols-3 gap-2 landscape:grid-cols-5">
              {results.map((c) => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  remaining={remainingByCategory.get(c.id)}
                  formatAmount={formatAmount}
                  selected={c.id === selectedId}
                  onPick={onPick}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No category matches “{search.trim()}”.</p>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Note ────────────────────────────────────────────────────────────────────────────────

export function NoteStep({
  value,
  category,
  onChange,
  onSubmit,
  onSkip,
}: {
  value: string;
  category: Category;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const hasText = value.trim().length > 0;
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (hasText) onSubmit();
        else onSkip();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 px-[max(1rem,env(safe-area-inset-left))]">
        <div className="flex flex-col items-center gap-2">
          <CategoryIcon category={category} size="lg" />
          <StepTitle id="step-title" hint="Optional — skip if you don't need one.">
            Add a note?
          </StepTitle>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="What was it for?"
          aria-label="Note (optional)"
          autoComplete="off"
          enterKeyHint="next"
          className="h-14 w-full rounded-2xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      <ActionBar>
        <div className="flex gap-2">
          <Button type="button" variant={hasText ? "outline" : "default"} onClick={onSkip} className="h-14 flex-1 rounded-2xl text-base font-semibold">
            Skip
          </Button>
          <Button type="submit" variant={hasText ? "default" : "outline"} disabled={!hasText} className="h-14 flex-1 rounded-2xl text-base font-semibold">
            Continue
          </Button>
        </div>
      </ActionBar>
    </form>
  );
}

// ── Payment ─────────────────────────────────────────────────────────────────────────────

export function PaymentStep({
  usage,
  selected,
  oneTapSave,
  onPick,
}: {
  usage: ExpenseUsage;
  selected: PaymentMethod | null;
  oneTapSave: boolean;
  onPick: (method: PaymentMethod) => void;
}) {
  const [now] = useState(() => Date.now());
  const methods = useMemo(() => rankPaymentMethods(usage, now), [usage, now]);
  const hasHistory = Object.keys(usage.methods).length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <StepTitle id="step-title" hint={oneTapSave ? "Tap to save" : undefined}>
        Paid with
      </StepTitle>
      <div role="group" aria-labelledby="step-title" className="grid gap-2 landscape:grid-cols-2">
        {methods.map((method, index) => {
          const { label, icon: Icon } = PAYMENT_METHOD_META[method];
          return (
            <button
              key={method}
              type="button"
              onClick={() => onPick(method)}
              aria-pressed={selected === method}
              className={cn(
                "flex h-16 items-center gap-4 rounded-2xl bg-muted/50 px-4 text-left text-base font-medium outline-none transition-transform active:scale-[0.98]",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                selected === method && "ring-2 ring-primary",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-background">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1">{label}</span>
              {hasHistory && index === 0 ? <span className="text-xs text-muted-foreground">Most used</span> : null}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Confirm ─────────────────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, onEdit }: { label: string; value: ReactNode; onEdit?: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={!onEdit}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left outline-none enabled:active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <span className="truncate">{value}</span>
        {onEdit ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </span>
    </button>
  );
}

export function ConfirmStep({
  draft,
  amountLabel,
  category,
  askNote,
  saving,
  error,
  offline,
  onEdit,
  onSave,
}: {
  draft: QuickAddDraft;
  amountLabel: string;
  category: Category;
  askNote: boolean;
  saving: boolean;
  error: string | null;
  offline: boolean;
  onEdit: (step: "AMOUNT" | "CATEGORY" | "NOTE" | "PAYMENT") => void;
  onSave: () => void;
}) {
  const method = draft.paymentMethod ? PAYMENT_METHOD_META[draft.paymentMethod].label : "";
  const edit = saving ? undefined : onEdit;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto px-[max(1rem,env(safe-area-inset-left))]">
        <button
          type="button"
          onClick={edit ? () => edit("AMOUNT") : undefined}
          disabled={!edit}
          aria-label={`Amount ${amountLabel}, change`}
          className="mx-auto rounded-2xl px-3 text-5xl font-semibold tracking-tight tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {amountLabel}
        </button>
        <h1 id="step-title" tabIndex={-1} className="sr-only">
          Confirm expense
        </h1>
        <div className="divide-y rounded-2xl border bg-card">
          <SummaryRow
            label="Category"
            value={
              <span className="flex items-center gap-2">
                <CategoryIcon category={category} size="sm" />
                {category.name}
              </span>
            }
            onEdit={edit ? () => edit("CATEGORY") : undefined}
          />
          <SummaryRow label="Paid with" value={method} onEdit={edit ? () => edit("PAYMENT") : undefined} />
          {askNote || draft.note ? (
            <SummaryRow
              label="Note"
              value={draft.note || <span className="text-muted-foreground">None</span>}
              onEdit={edit && askNote ? () => edit("NOTE") : undefined}
            />
          ) : null}
        </div>
        {offline ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            Offline — it&apos;ll be saved on this iPhone and synced later.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <ActionBar>
        <PrimaryButton type="button" onClick={onSave} disabled={saving} aria-busy={saving || undefined}>
          {saving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {saving ? "Adding…" : "Add expense"}
        </PrimaryButton>
      </ActionBar>
    </div>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────────────────

export function ResultStep({
  saved,
  amountLabel,
  category,
  budget,
  formatAmount,
  onAddAnother,
  onDone,
}: {
  saved: SavedExpense;
  amountLabel: string;
  category: Category;
  /** null while still being calculated. */
  budget: BudgetOutcome | null;
  formatAmount: (minor: number) => string;
  onAddAnother: () => void;
  onDone: () => void;
}) {
  const progress = budget?.status === "ready" ? budget.budget.progress : null;
  const over = progress?.state === "over";
  const month = monthKey(saved.occurredAt);
  const otherMonth = month !== monthKey(new Date());
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-[max(1rem,env(safe-area-inset-left))] text-center">
        <div className="flex flex-col items-center gap-3">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full animate-in zoom-in-50 duration-300",
              over ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {over ? <AlertTriangle className="size-7" aria-hidden /> : <Check className="size-7" aria-hidden />}
          </span>
          <h1 id="step-title" tabIndex={-1} className="text-lg font-semibold outline-none">
            {over ? "Added — budget exceeded" : "Added"}
          </h1>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{amountLabel}</p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CategoryIcon category={category} size="sm" />
            {category.name}
          </p>
          {saved.pending ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CloudOff className="size-3.5" aria-hidden />
              Saved on this device — will sync when you&apos;re back online.
            </p>
          ) : null}
        </div>

        <section aria-live="polite" aria-busy={budget === null} className="w-full max-w-sm rounded-2xl border bg-card p-4 text-left">
          {budget === null ? (
            <div className="space-y-3" aria-label="Checking budget">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
            </div>
          ) : budget.status === "error" ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t check the {category.name} budget right now.</p>
          ) : progress ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {category.name} budget{otherMonth ? ` · ${formatMonth(month)}` : ""}
              </p>
              <p className={cn("text-2xl font-semibold tabular-nums", over && "text-destructive")}>
                {over ? `${formatAmount(-progress.remaining)} over budget` : `${formatAmount(progress.remaining)} remaining`}
              </p>
              <ProgressBar
                value={progress.ratio}
                tone={progress.state === "over" ? "over" : progress.state === "warning" ? "warning" : "ok"}
                label={`${category.name} budget used`}
              />
              <p className="text-sm text-muted-foreground tabular-nums">
                {progress.percent}% used · {formatAmount(progress.spent)} of {formatAmount(progress.limit)}
              </p>
              {budget.fromCache ? (
                <p className="text-xs text-muted-foreground">From this device&apos;s data — may not include changes made elsewhere.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No {category.name} budget{otherMonth ? ` for ${formatMonth(month)}` : ""} ·{" "}
                {formatAmount(budget.budget.spent)} spent{otherMonth ? "" : " this month"}
              </p>
              <Button asChild variant="outline" className="h-11 w-full rounded-xl">
                <Link href="/budgets">Set {category.name} budget</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
      <ActionBar>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onAddAnother} className="h-14 flex-1 rounded-2xl text-base font-semibold">
            Add another
          </Button>
          <PrimaryButton type="button" onClick={onDone} className="flex-1">
            Done
          </PrimaryButton>
        </div>
      </ActionBar>
    </div>
  );
}
