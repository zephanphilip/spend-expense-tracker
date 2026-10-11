"use client";

import { format } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useState } from "react";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody } from "@/components/common/sheet-layout";
import { Button } from "@/components/ui/button";
import { type DateKey, fromDateKey } from "@/lib/fitness/dates";
import { dayPlan, planProgress } from "@/lib/fitness/stats";
import { useFitness } from "@/providers/fitness-provider";
import type { FitnessActivity, FitnessLog } from "@/types/fitness";

import { DayPlanList } from "./day-plan-list";
import { type LogTarget, LogSheet } from "./log-sheet";

/** A day picked on the analytics calendar: what was due, what was done — editable. */
export function DaySheet({ date, activities, onOpenChange }: { date: DateKey | null; activities: readonly FitnessActivity[]; onOpenChange: (open: boolean) => void }) {
  const { index, today } = useFitness();
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const plan = date ? dayPlan(activities, index, date, today) : [];
  const progress = planProgress(plan);
  return (
    <>
      <ResponsiveModal
        open={date !== null && logTarget === null}
        onOpenChange={onOpenChange}
        title={date ? format(fromDateKey(date), "EEEE d MMMM yyyy") : ""}
        description={progress.total ? `${progress.completed} of ${progress.total} done` : "Nothing was due"}
        preventAutoFocus
      >
        {date ? (
          <SheetBody className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {plan.length ? (
              <DayPlanList items={plan} date={date} onDetails={(a: FitnessActivity, log: FitnessLog | null) => setLogTarget(log ? { log } : { activityId: a.id, date })} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing was scheduled or logged this day.</p>
            )}
            {date <= today ? (
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setLogTarget({ date })}>
                <CalendarPlus aria-hidden />
                Add a record for this day
              </Button>
            ) : null}
          </SheetBody>
        ) : null}
      </ResponsiveModal>
      <LogSheet target={logTarget} onOpenChange={(open) => !open && setLogTarget(null)} />
    </>
  );
}
