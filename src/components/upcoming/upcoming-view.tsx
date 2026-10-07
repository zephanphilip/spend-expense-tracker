"use client";

import { addDays, isBefore, startOfDay } from "date-fns";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Stat } from "@/components/common/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { upcomingOutflow } from "@/lib/finance/upcoming";
import { useAccounts } from "@/providers/finance-provider";

import { UpcomingList } from "./upcoming-list";
import { useUpcoming } from "./use-upcoming";

export function UpcomingView() {
  const { status, error, items, now } = useUpcoming(30);
  const accounts = useAccounts();
  const liquid = accounts.active.filter((a) => a.type !== "credit_card").reduce((s, a) => s + a.balance, 0);
  const weekEnd = addDays(startOfDay(now), 7);
  const overdue = items.filter((i) => i.overdue);
  const thisWeek = items.filter((i) => !i.overdue && isBefore(i.date, weekEnd));
  const later = items.filter((i) => !i.overdue && !isBefore(i.date, weekEnd));
  const outflow = upcomingOutflow(items);
  const inflow = items.filter((i) => i.kind === "income").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Upcoming" description="Next 30 days" back={{ href: "/plan", label: "Plan" }} />
      {status === "loading" ? (
        <Skeleton className="h-60 rounded-3xl" aria-label="Loading upcoming payments" />
      ) : status === "error" ? (
        <ErrorState error={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing due"
          description="Recurring payments, EMIs, card bills and expected income show up here as they come due."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Going out" value={<Money amount={outflow} />} hint={inflow > 0 ? <>+<Money amount={inflow} /> expected in</> : undefined} />
            {accounts.active.length ? (
              <Stat
                label="In your accounts"
                value={<Money amount={liquid} className={liquid < outflow ? "text-destructive" : undefined} />}
                hint={liquid < outflow ? "Less than what's due" : "Covers what's due"}
              />
            ) : (
              <Stat label="Items" value={items.length} />
            )}
          </dl>
          {overdue.length ? (
            <SectionCard id="upcoming-overdue" title="Overdue" className="border-amber-500/40">
              <UpcomingList items={overdue} />
            </SectionCard>
          ) : null}
          {thisWeek.length ? (
            <SectionCard id="upcoming-week" title="Next 7 days">
              <UpcomingList items={thisWeek} />
            </SectionCard>
          ) : null}
          {later.length ? (
            <SectionCard id="upcoming-later" title="Later">
              <UpcomingList items={later} />
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}
