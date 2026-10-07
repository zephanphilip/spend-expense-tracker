"use client";

import { addDays } from "date-fns";
import { useMemo, useState } from "react";

import { useIncomesForMonths } from "@/hooks/use-finance-queries";
import { buildUpcoming } from "@/lib/finance/upcoming";
import { monthKey } from "@/lib/months";
import { useFinance } from "@/providers/finance-provider";

/** Live upcoming payments/income for the next `days` days, plus overdue items. */
export function useUpcoming(days = 30) {
  const [now] = useState(() => new Date());
  const fromMonth = monthKey(now);
  const toMonth = monthKey(addDays(now, days));
  const incomes = useIncomesForMonths(fromMonth, toMonth);
  const { recurringPayments, emis, accounts, recurringIncomes } = useFinance();
  const parts = [incomes, recurringPayments, emis, accounts, recurringIncomes];
  const ready = parts.every((p) => p.status === "success");
  const items = useMemo(
    () =>
      ready
        ? buildUpcoming({
            now,
            days,
            recurringPayments: recurringPayments.data ?? [],
            emis: emis.data ?? [],
            accounts: accounts.data ?? [],
            recurringIncomes: recurringIncomes.data ?? [],
            incomes: incomes.data ?? [],
          })
        : [],
    [ready, now, days, recurringPayments.data, emis.data, accounts.data, recurringIncomes.data, incomes.data],
  );
  const error = parts.find((p) => p.error)?.error ?? null;
  return { status: error ? ("error" as const) : ready ? ("success" as const) : ("loading" as const), error, items, now };
}
