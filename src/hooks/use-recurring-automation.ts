"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

import { planRecurringIncomes, planRecurringPayments } from "@/lib/finance/automation";
import { formatMoney } from "@/lib/money";
import { monthKey, shiftMonth } from "@/lib/months";
import { getErrorMessage } from "@/lib/services/errors";
import { AlreadyRecordedError, fetchIncomesForMonths, recordRecurringIncome } from "@/lib/services/income.service";
import { AlreadyPaidError, payRecurring } from "@/lib/services/recurring-payment.service";
import { useSession } from "@/providers/auth-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";

const MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Records due occurrences of recurring payments/incomes marked "automatic" — on app open and
 * when the app returns to the foreground. Every step is a transaction keyed by a
 * deterministic id ((schedule, occurrence) / (template, month)), so re-runs, slow networks or
 * a second device can never create duplicates; a step another device already did is skipped.
 */
export function useRecurringAutomation() {
  const { user, currency } = useSession();
  const { recurringPayments, recurringIncomes } = useFinance();
  const { accountExists } = useAccounts();
  const running = useRef(false);
  const lastRun = useRef(0);
  const ready = recurringPayments.status === "success" && recurringIncomes.status === "success";

  const run = useEffectEvent(async () => {
    if (!ready || running.current || !navigator.onLine) return;
    if (Date.now() - lastRun.current < MIN_INTERVAL_MS) return;
    const payments = planRecurringPayments(recurringPayments.data ?? []);
    const hasIncomeAuto = (recurringIncomes.data ?? []).some((t) => t.active && t.autoRecord);
    if (!payments.length && !hasIncomeAuto) return;

    running.current = true;
    lastRun.current = Date.now();
    const done: string[] = [];
    try {
      for (const step of payments) {
        try {
          // Recorded on the occurrence's due date, not "now".
          const { amount } = await payRecurring(user.uid, step.payment.id, { paidAt: step.date, expectedCycle: step.cycle }, { accountExists });
          done.push(`${step.payment.name} ${formatMoney(amount, currency)}`);
        } catch (error) {
          if (!(error instanceof AlreadyPaidError)) throw error;
        }
      }
      if (hasIncomeAuto) {
        const now = new Date();
        const incomes = await fetchIncomesForMonths(user.uid, shiftMonth(monthKey(now), -2), monthKey(now));
        for (const step of planRecurringIncomes(recurringIncomes.data ?? [], incomes, now)) {
          try {
            await recordRecurringIncome(
              user.uid,
              step.template,
              step.month,
              { amount: step.template.amount, receivedAt: step.date, expectedAt: step.date },
              { accountExists },
            );
            done.push(`${step.template.name} +${formatMoney(step.template.amount, currency)}`);
          } catch (error) {
            if (!(error instanceof AlreadyRecordedError)) throw error;
          }
        }
      }
      if (done.length) {
        toast.success(`Recorded ${done.length} recurring ${done.length === 1 ? "entry" : "entries"} automatically`, {
          description: done.slice(0, 4).join(" · ") + (done.length > 4 ? " …" : ""),
        });
      }
    } catch (error) {
      toast.error("Couldn't record recurring entries", { description: getErrorMessage(error) });
    } finally {
      running.current = false;
    }
  });

  useEffect(() => {
    if (ready) void run();
  }, [ready]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);
}
