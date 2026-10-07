import { cardUtilization } from "@/lib/finance/accounts";
import { formatMoney } from "@/lib/money";
import { formatMonth } from "@/lib/months";
import type { Account, CurrencyCode } from "@/types";

import type { SpendData } from "./dataset";
import type { BudgetMonth, Burden, Change, MonthPoint, WeekdayStat } from "./metrics";
import { routes } from "@/lib/routes";

export type InsightTone = "positive" | "neutral" | "warning";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** Plain-language explanation of how it was computed. */
  detail: string;
  /** Higher sorts first. */
  priority: number;
  href?: string;
}

export interface InsightInput {
  currency: CurrencyCode;
  /** In-sentence name of the period, e.g. "this month", "August 2025". */
  periodLabel: string;
  previousLabel: string;
  spending: Change;
  current: SpendData;
  /** Each category's average spend per month over the comparison months before the period. */
  categoryBaseline: { months: number; perMonth: Record<string, number> };
  /** Months in the current period (to scale the baseline). */
  periodMonths: number;
  categoryName: (id: string) => string;
  budgets: BudgetMonth[];
  /** Savings rates for the latest complete months, oldest first. */
  months: MonthPoint[];
  recurring: Burden;
  emi: Burden;
  cards: readonly Account[];
  weekdays: WeekdayStat[];
}

/** Thresholds are explicit so every insight can be explained. */
export const THRESHOLDS = {
  spendingChange: 0.15,
  spendingChangeMinMinor: 100000, // ₹1,000
  categorySpike: 1.5,
  categorySpikeMinMinor: 100000,
  recurringOfIncome: 0.25,
  emiOfIncome: 0.4,
  savingsRateShift: 0.05,
  cardWarning: 0.3,
  cardHigh: 0.75,
  weekdaySkew: 1.4,
} as const;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pct = (r: number) => `${Math.round(Math.abs(r) * 100)}%`;

/**
 * Deterministic, rule-based observations. Each rule documents its threshold in `detail`
 * so the user can see exactly why it appeared — no model, no guessing.
 */
export function buildInsights(input: InsightInput): Insight[] {
  const m = (v: number) => formatMoney(v, input.currency);
  const out: Insight[] = [];
  const s = input.spending;

  // 1. Spending vs previous period.
  if (s.ratio !== null && Math.abs(s.ratio) >= THRESHOLDS.spendingChange && Math.abs(s.delta) >= THRESHOLDS.spendingChangeMinMinor) {
    const up = s.delta > 0;
    out.push({
      id: "spending-change",
      tone: up ? "warning" : "positive",
      title: `Spending ${up ? "up" : "down"} ${pct(s.ratio)} vs ${input.previousLabel}`,
      detail: `${m(s.current)} in ${input.periodLabel} against ${m(s.previous)} — a change of ${m(Math.abs(s.delta))}. Flagged when the change is at least ${pct(THRESHOLDS.spendingChange)} and ${m(THRESHOLDS.spendingChangeMinMinor)}.`,
      priority: up ? 90 : 60,
    });
  }

  // 2. Unusual category increases vs the category's own baseline.
  const baselineMonths = input.categoryBaseline.months;
  if (baselineMonths > 0) {
    for (const [id, total] of Object.entries(input.current.byCategory)) {
      const avg = (input.categoryBaseline.perMonth[id] ?? 0) * input.periodMonths;
      if (avg <= 0) continue;
      if (total >= avg * THRESHOLDS.categorySpike && total - avg >= THRESHOLDS.categorySpikeMinMinor) {
        out.push({
          id: `category-spike-${id}`,
          tone: "warning",
          title: `${input.categoryName(id)} is ${pct(total / avg - 1)} above usual`,
          detail: `${m(total)} this period vs a typical ${m(Math.round(avg / 100) * 100)} (average of the previous ${baselineMonths} months). Flagged at ${THRESHOLDS.categorySpike}× the average and at least ${m(THRESHOLDS.categorySpikeMinMinor)} more.`,
          priority: 80 + Math.min(total / avg, 5),
        });
      }
    }
  }

  // 3. Category overspending against budgets (latest month in the period with a budget).
  const latestBudget = [...input.budgets].reverse().find((b) => b.overall || b.overCategories.length);
  if (latestBudget) {
    for (const over of latestBudget.overCategories.slice(0, 3)) {
      out.push({
        id: `over-budget-${latestBudget.month}-${over.categoryId}`,
        tone: "warning",
        title: `${input.categoryName(over.categoryId)} over budget in ${formatMonth(latestBudget.month)}`,
        detail: `${m(over.progress.spent)} spent against a ${m(over.progress.limit)} limit (${over.progress.percent}%).`,
        priority: 85,
        href: "/budgets",
      });
    }
    if (latestBudget.overall?.state === "over") {
      out.push({
        id: `overall-over-${latestBudget.month}`,
        tone: "warning",
        title: `Over your ${formatMonth(latestBudget.month)} budget`,
        detail: `${m(latestBudget.overall.spent)} spent of ${m(latestBudget.overall.limit)} (${latestBudget.overall.percent}%).`,
        priority: 88,
        href: "/budgets",
      });
    }
  }

  // 4. Recurring and EMI burden relative to income.
  if (input.recurring.ofIncome !== null && input.recurring.ofIncome >= THRESHOLDS.recurringOfIncome) {
    out.push({
      id: "recurring-burden",
      tone: "warning",
      title: `Recurring payments take ${pct(input.recurring.ofIncome)} of income`,
      detail: `${m(input.recurring.monthly)}/month in active recurring payments vs your average monthly income. Flagged above ${pct(THRESHOLDS.recurringOfIncome)}.`,
      priority: 70,
      href: "/recurring",
    });
  } else if (input.recurring.monthly > 0) {
    out.push({
      id: "recurring-total",
      tone: "neutral",
      title: `${m(input.recurring.monthly * 12)} a year in recurring payments`,
      detail: `Active recurring payments add up to about ${m(input.recurring.monthly)} a month${input.recurring.ofIncome !== null ? ` (${pct(input.recurring.ofIncome)} of income)` : ""}.`,
      priority: 30,
      href: "/recurring",
    });
  }
  if (input.emi.ofIncome !== null && input.emi.ofIncome >= THRESHOLDS.emiOfIncome) {
    out.push({
      id: "emi-burden",
      tone: "warning",
      title: `EMIs are ${pct(input.emi.ofIncome)} of income`,
      detail: `${m(input.emi.monthly)} due this month. Lenders generally consider above ${pct(THRESHOLDS.emiOfIncome)} a stretched debt-to-income ratio.`,
      priority: 75,
      href: "/emis",
    });
  }

  // 5. Savings-rate shift between the last two months with income.
  const withRate = input.months.filter((x) => x.savingsRate !== null);
  if (withRate.length >= 2) {
    const [prev, last] = withRate.slice(-2);
    const shift = (last.savingsRate ?? 0) - (prev.savingsRate ?? 0);
    if (Math.abs(shift) >= THRESHOLDS.savingsRateShift) {
      out.push({
        id: "savings-rate-shift",
        tone: shift > 0 ? "positive" : "warning",
        title: `Savings rate ${shift > 0 ? "rose" : "fell"} to ${pct(last.savingsRate ?? 0)}`,
        detail: `${formatMonth(last.month)}: ${pct(last.savingsRate ?? 0)} vs ${pct(prev.savingsRate ?? 0)} in ${formatMonth(prev.month)} (${shift > 0 ? "+" : "−"}${Math.round(Math.abs(shift) * 100)} points). Savings rate = (income − expenses) ÷ income.`,
        priority: 65,
      });
    }
  }

  // 6. Credit utilisation.
  for (const card of input.cards) {
    const u = cardUtilization(card);
    if (u === null || u < THRESHOLDS.cardWarning) continue;
    out.push({
      id: `card-util-${card.id}`,
      tone: "warning",
      title: `${card.name} is ${pct(u)} utilised`,
      detail: `Outstanding vs limit. Keeping utilisation under ${pct(THRESHOLDS.cardWarning)} is generally better for your credit score${u >= THRESHOLDS.cardHigh ? "; above " + pct(THRESHOLDS.cardHigh) + " is high" : ""}.`,
      priority: u >= THRESHOLDS.cardHigh ? 87 : 55,
      href: routes.account(card.id),
    });
  }

  // 7. Largest categories.
  const top = Object.entries(input.current.byCategory).sort((a, b) => b[1] - a[1])[0];
  if (top && input.current.total > 0) {
    out.push({
      id: "largest-category",
      tone: "neutral",
      title: `${input.categoryName(top[0])} is your biggest category`,
      detail: `${m(top[1])} — ${pct(top[1] / input.current.total)} of everything you spent in ${input.periodLabel}.`,
      priority: 40,
    });
  }

  // 8. Spending-day pattern.
  const totalDays = input.weekdays.reduce((s, d) => s + d.days, 0);
  const overallAvg = totalDays ? input.weekdays.reduce((s, d) => s + d.total, 0) / totalDays : 0;
  const busiest = [...input.weekdays].filter((d) => d.days > 0).sort((a, b) => b.average - a.average)[0];
  if (busiest && overallAvg > 0 && totalDays >= 14 && busiest.average >= overallAvg * THRESHOLDS.weekdaySkew) {
    out.push({
      id: "weekday-pattern",
      tone: "neutral",
      title: `You spend most on ${WEEKDAY_NAMES[busiest.weekday]}s`,
      detail: `${busiest.label}: ${m(busiest.average)} on average vs ${m(Math.round(overallAvg / 100) * 100)} across all days (${(busiest.average / overallAvg).toFixed(1)}×). Shown when one weekday is at least ${THRESHOLDS.weekdaySkew}× the daily average over 2+ weeks.`,
      priority: 35,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
