"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

import { type LiveResult, useLiveQuery } from "@/hooks/use-live-query";
import { subscribeAccounts } from "@/lib/services/account.service";
import { subscribeBudgets } from "@/lib/services/budget.service";
import { subscribeEmis } from "@/lib/services/emi.service";
import { subscribeGoals } from "@/lib/services/goal.service";
import { subscribeRecurringIncomes } from "@/lib/services/income.service";
import { subscribeInvestments } from "@/lib/services/investment.service";
import { subscribeRecurringPayments } from "@/lib/services/recurring-payment.service";
import type { Account, Budget, Emi, Goal, Investment, RecurringIncome, RecurringPayment } from "@/types";

import { useSession } from "./auth-provider";

type Live<T> = LiveResult<T> & { retry: () => void };

interface FinanceContextValue {
  budgets: Live<Budget[]>;
  emis: Live<Emi[]>;
  goals: Live<Goal[]>;
  recurringIncomes: Live<RecurringIncome[]>;
  accounts: Live<Account[]>;
  investments: Live<Investment[]>;
  recurringPayments: Live<RecurringPayment[]>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

/**
 * Small, frequently-used collections are subscribed once for the whole app so the
 * dashboard, plan hub and detail screens share one listener each.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid = user.uid;
  const budgets = useLiveQuery<Budget[]>(`budgets:${uid}`, (ok, fail) => subscribeBudgets(uid, ok, fail));
  const emis = useLiveQuery<Emi[]>(`emis:${uid}`, (ok, fail) => subscribeEmis(uid, ok, fail));
  const goals = useLiveQuery<Goal[]>(`goals:${uid}`, (ok, fail) => subscribeGoals(uid, ok, fail));
  const recurringIncomes = useLiveQuery<RecurringIncome[]>(`recurring:${uid}`, (ok, fail) =>
    subscribeRecurringIncomes(uid, ok, fail),
  );
  const accounts = useLiveQuery<Account[]>(`accounts:${uid}`, (ok, fail) => subscribeAccounts(uid, ok, fail));
  const investments = useLiveQuery<Investment[]>(`investments:${uid}`, (ok, fail) => subscribeInvestments(uid, ok, fail));
  const recurringPayments = useLiveQuery<RecurringPayment[]>(`recurring-payments:${uid}`, (ok, fail) =>
    subscribeRecurringPayments(uid, ok, fail),
  );
  const value = useMemo(
    () => ({ budgets, emis, goals, recurringIncomes, accounts, investments, recurringPayments }),
    [budgets, emis, goals, recurringIncomes, accounts, investments, recurringPayments],
  );
  return <FinanceContext value={value}>{children}</FinanceContext>;
}

export function useFinance(): FinanceContextValue {
  const context = use(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside <FinanceProvider>");
  return context;
}

/** Account lookups shared by pickers, lists and ledger writes. */
export function useAccounts() {
  const { accounts } = useFinance();
  return useMemo(() => {
    const list = accounts.data ?? [];
    const byId = new Map(list.map((a) => [a.id, a]));
    return {
      status: accounts.status,
      error: accounts.error,
      retry: accounts.retry,
      all: list,
      active: list.filter((a) => a.active),
      get: (id: string | null | undefined) => (id ? byId.get(id) ?? null : null),
      name: (id: string | null | undefined) => (id ? byId.get(id)?.name ?? "Deleted account" : null),
      /** For ledger writes: skip balance updates on deleted accounts. */
      accountExists: (id: string) => byId.has(id),
    };
  }, [accounts]);
}
