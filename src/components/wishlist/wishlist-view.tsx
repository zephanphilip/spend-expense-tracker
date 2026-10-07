"use client";

import { Heart, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinance } from "@/providers/finance-provider";
import type { Goal } from "@/types";

import { ContributionSheet } from "./contribution-sheet";
import { GoalCard } from "./goal-card";
import { GoalSheet } from "./goal-sheet";

export function WishlistView() {
  const { goals } = useFinance();
  const [adding, setAdding] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const all = goals.data ?? [];
  const active = all.filter((g) => g.status === "active");
  const archived = all.filter((g) => g.status === "archived");
  const saved = active.reduce((s, g) => s + g.savedAmount, 0);
  const target = active.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wishlist"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setAdding(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            New wish
          </Button>
        }
      />

      {goals.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading wishlist">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      ) : goals.status === "error" ? (
        <ErrorState error={goals.error} onRetry={goals.retry} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Save for what you want"
          description="Add a wish with a target amount and date. Log money as you set it aside and watch it fill up."
          action={
            <Button onClick={() => setAdding(true)} className="mt-2 h-11 rounded-xl px-5">
              Add your first wish
            </Button>
          }
        />
      ) : (
        <>
          {active.length ? (
            <section aria-label="Total saved" className="rounded-3xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Saved across {active.length} {active.length === 1 ? "wish" : "wishes"}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                <Money amount={saved} />
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / <Money amount={target} />
                </span>
              </p>
              <ProgressBar value={target ? saved / target : 0} tone="ok" label="Total saved towards wishes" className="mt-3" />
            </section>
          ) : null}
          <ul className="space-y-3">
            {active.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onAdd={setContributing} />
            ))}
          </ul>
          {archived.length ? (
            <section aria-labelledby="archived-wishes" className="space-y-2">
              <h2 id="archived-wishes" className="px-1 text-sm font-medium text-muted-foreground">
                Archived
              </h2>
              <ul className="space-y-3 opacity-75">
                {archived.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} compact />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <GoalSheet open={adding} onOpenChange={setAdding} />
      <ContributionSheet goal={contributing} onOpenChange={(open) => !open && setContributing(null)} />
    </div>
  );
}
