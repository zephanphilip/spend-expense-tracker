"use client";

import { FileQuestion } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AccountDetailView } from "@/components/accounts/account-detail-view";
import { EmptyState } from "@/components/common/empty-state";
import { EmiDetailView } from "@/components/emis/emi-detail-view";
import { InvestmentDetailView } from "@/components/investments/investment-detail-view";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalDetailView } from "@/components/wishlist/goal-detail-view";

const views = {
  emi: (id: string) => <EmiDetailView emiId={id} />,
  account: (id: string) => <AccountDetailView accountId={id} />,
  investment: (id: string) => <InvestmentDetailView investmentId={id} />,
  goal: (id: string) => <GoalDetailView goalId={id} />,
};

function Inner({ view }: { view: keyof typeof views }) {
  const id = useSearchParams().get("id");
  if (!id) return <EmptyState icon={FileQuestion} title="Nothing to show" description="This link is missing which item to open." />;
  return views[view](id);
}

/** Renders a detail screen for the `?id=` in the URL (static-export friendly — see lib/routes). */
export function DetailRoute({ view }: { view: keyof typeof views }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" aria-label="Loading" />}>
      <Inner view={view} />
    </Suspense>
  );
}
