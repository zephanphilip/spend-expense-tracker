"use client";

import { Loader2, Plus, ReceiptText, Search, SearchX, X } from "lucide-react";
import { type CSSProperties, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpenses } from "@/hooks/use-expenses";
import { sumAmounts } from "@/lib/analytics";
import { fromDateInputValue, getPeriodRange, PERIOD_LABELS } from "@/lib/dates";
import { searchExpenses } from "@/lib/filters";
import { useCategories } from "@/providers/categories-provider";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";

import {
  countActiveFilters,
  DEFAULT_FILTERS,
  type ExpenseFilterState,
  ExpenseFilters,
} from "./expense-filters";
import { ExpenseList } from "./expense-list";
import { ExpenseListSkeleton } from "./expense-list-skeleton";

const PAGE_SIZE = 100;

export function ExpensesView() {
  const { getCategory } = useCategories();
  const { openCreate } = useExpenseSheet();
  const [search, setSearch] = useState("");
  // "/" shortcut from another page lands here with ?focus=search. Checked after mount: during
  // a client-side navigation the URL only updates once the new page has committed.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("focus") !== "search") return;
    url.searchParams.delete("focus");
    window.history.replaceState(null, "", url.pathname + url.search);
    searchRef.current?.focus();
  }, []);
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<ExpenseFilterState>(DEFAULT_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const range = useMemo(
    () =>
      getPeriodRange(filters.period, {
        from: fromDateInputValue(filters.from),
        to: fromDateInputValue(filters.to),
      }),
    [filters.period, filters.from, filters.to],
  );

  const result = useExpenses({
    ...range,
    categoryId: filters.categoryId ?? undefined,
    paymentMethod: filters.paymentMethod ?? undefined,
    limit,
  });

  const visible = useMemo(
    () => searchExpenses(result.expenses, deferredSearch, getCategory),
    [result.expenses, deferredSearch, getCategory],
  );
  const isFiltered = countActiveFilters(filters) > 0 || deferredSearch.trim() !== "";

  function updateFilters(next: ExpenseFilterState) {
    setFilters(next);
    setLimit(PAGE_SIZE);
  }

  function clearAll() {
    setSearch("");
    updateFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="History"
        description={
          result.status === "success" ? (
            <>
              {visible.length} {visible.length === 1 ? "expense" : "expenses"} ·{" "}
              <Money amount={sumAmounts(visible)} className="font-medium text-foreground" />
              {filters.period !== "custom" ? ` · ${PERIOD_LABELS[filters.period]}` : null}
            </>
          ) : (
            PERIOD_LABELS[filters.period]
          )
        }
      />

      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 bg-background/90 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Search expenses"
            data-shortcut-search
            ref={searchRef}
            placeholder="Search notes, categories, amounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden />
              <span className="sr-only">Clear search</span>
            </button>
          ) : null}
        </div>
        <ExpenseFilters value={filters} onChange={updateFilters} />
      </div>

      <div aria-live="polite" className="sr-only">
        {result.status === "success" && isFiltered ? `${visible.length} matching expenses` : ""}
      </div>

      {result.status === "loading" ? <ExpenseListSkeleton rows={8} /> : null}

      {result.status === "error" ? <ErrorState error={result.error} onRetry={result.retry} /> : null}

      {result.status === "success" ? (
        visible.length === 0 ? (
          isFiltered ? (
            <EmptyState
              icon={SearchX}
              title="No matching expenses"
              description="Try a different search or widen the filters."
              action={
                <Button variant="outline" onClick={clearAll} className="h-10 rounded-xl">
                  Clear search & filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={`No expenses ${filters.period === "all" ? "yet" : "in this period"}`}
              description="Expenses you add will be listed here, grouped by day."
              action={
                <Button onClick={openCreate} className="h-10 rounded-xl">
                  <Plus aria-hidden />
                  Add expense
                </Button>
              }
            />
          )
        ) : (
          <div style={{ "--sticky-offset": "4.25rem" } as CSSProperties} className="md:[--sticky-offset:0px]">
            <ExpenseList expenses={visible} />
          </div>
        )
      ) : null}

      {result.status === "success" && result.hasMore ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          {deferredSearch.trim() ? (
            <p className="text-center text-xs text-muted-foreground">
              Search covers the {result.expenses.length} most recent expenses loaded so far.
            </p>
          ) : null}
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={result.isRefreshing}
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            {result.isRefreshing ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Load older expenses
          </Button>
        </div>
      ) : null}
    </div>
  );
}
