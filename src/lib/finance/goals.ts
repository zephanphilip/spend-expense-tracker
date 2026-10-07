import { differenceInCalendarMonths, isBefore, startOfDay } from "date-fns";

import type { Goal } from "@/types";

export interface GoalProgress {
  remaining: number;
  /** 0..1, capped. */
  ratio: number;
  percent: number;
  achieved: boolean;
  /** Whole months left until the target date (min 1), or null without a date. */
  monthsLeft: number | null;
  /** Amount to save each month to hit the target date, or null. */
  perMonth: number | null;
  isPastDue: boolean;
}

export function goalProgress(goal: Goal, now: Date = new Date()): GoalProgress {
  const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
  const ratio = goal.targetAmount > 0 ? Math.min(goal.savedAmount / goal.targetAmount, 1) : 0;
  const achieved = goal.savedAmount >= goal.targetAmount;
  const isPastDue = Boolean(goal.targetDate && !achieved && isBefore(goal.targetDate, startOfDay(now)));
  const monthsLeft = goal.targetDate
    ? Math.max(differenceInCalendarMonths(goal.targetDate, now), 1)
    : null;
  return {
    remaining,
    ratio,
    percent: Math.floor(ratio * 100),
    achieved,
    monthsLeft,
    perMonth: monthsLeft && !achieved ? Math.ceil(remaining / monthsLeft) : null,
    isPastDue,
  };
}
