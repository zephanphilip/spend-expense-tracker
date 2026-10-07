"use client";

import { useLiveQuery } from "@/hooks/use-live-query";
import { subscribeEmiPayments } from "@/lib/services/emi.service";
import { subscribeAccountExpenses } from "@/lib/services/expense.service";
import { subscribeInvestmentHistory } from "@/lib/services/investment.service";
import { subscribeNetWorthHistory } from "@/lib/services/net-worth.service";
import { subscribeAccountTransfers } from "@/lib/services/transfer.service";
import { subscribeContributions } from "@/lib/services/goal.service";
import { subscribeAccountIncomes, subscribeIncomeHistory, subscribeIncomesForMonths } from "@/lib/services/income.service";
import { useSession } from "@/providers/auth-provider";
import type {
  EmiPayment,
  Expense,
  GoalContribution,
  Income,
  IncomeSource,
  InvestmentTransaction,
  MonthKey,
  NetWorthSnapshot,
  Transfer,
} from "@/types";

export function useIncomesForMonths(fromMonth: MonthKey, toMonth: MonthKey) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<Income[]>(`incomes:${uid}:${fromMonth}:${toMonth}`, (ok, fail) =>
    subscribeIncomesForMonths(uid, fromMonth, toMonth, ok, fail),
  );
}

export function useIncomeHistory(limit: number, source?: IncomeSource) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<{ items: Income[]; hasMore: boolean }>(`income-history:${uid}:${source ?? "all"}:${limit}`, (ok, fail) =>
    subscribeIncomeHistory(uid, { source, limit }, (items, hasMore) => ok({ items, hasMore }), fail),
  );
}

export function useEmiPayments(emiId: string) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<EmiPayment[]>(`emi-payments:${uid}:${emiId}`, (ok, fail) =>
    subscribeEmiPayments(uid, emiId, ok, fail),
  );
}

export function useGoalContributions(goalId: string) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<GoalContribution[]>(`contributions:${uid}:${goalId}`, (ok, fail) =>
    subscribeContributions(uid, goalId, ok, fail),
  );
}

export function useAccountLedger(accountId: string) {
  const { user } = useSession();
  const uid = user.uid;
  const expenses = useLiveQuery<Expense[]>(`acct-exp:${uid}:${accountId}`, (ok, fail) => subscribeAccountExpenses(uid, accountId, ok, fail));
  const incomes = useLiveQuery<Income[]>(`acct-inc:${uid}:${accountId}`, (ok, fail) => subscribeAccountIncomes(uid, accountId, ok, fail));
  const transfers = useLiveQuery<Transfer[]>(`acct-tr:${uid}:${accountId}`, (ok, fail) => subscribeAccountTransfers(uid, accountId, ok, fail));
  const investmentTxs = useLiveQuery<InvestmentTransaction[]>(`acct-inv:${uid}:${accountId}`, (ok, fail) =>
    subscribeInvestmentHistory(uid, { accountId }, ok, fail),
  );
  const parts = [expenses, incomes, transfers, investmentTxs];
  const error = parts.find((p) => p.error)?.error ?? null;
  return {
    status: error ? ("error" as const) : parts.every((p) => p.status === "success") ? ("success" as const) : ("loading" as const),
    error,
    retry: () => parts.forEach((p) => p.error && p.retry()),
    expenses: expenses.data ?? [],
    incomes: incomes.data ?? [],
    transfers: transfers.data ?? [],
    investmentTxs: investmentTxs.data ?? [],
  };
}

export function useInvestmentHistory(investmentId: string) {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<InvestmentTransaction[]>(`inv-hist:${uid}:${investmentId}`, (ok, fail) =>
    subscribeInvestmentHistory(uid, { investmentId }, ok, fail),
  );
}

export function useNetWorthHistory() {
  const { user } = useSession();
  const uid = user.uid;
  return useLiveQuery<NetWorthSnapshot[]>(`networth:${uid}`, (ok, fail) => subscribeNetWorthHistory(uid, ok, fail));
}
