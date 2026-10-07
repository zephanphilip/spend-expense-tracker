"use client";

import { useMemo } from "react";

import { computeNetWorth } from "@/lib/finance/net-worth";
import { useFinance } from "@/providers/finance-provider";

export function useNetWorth() {
  const { accounts, investments, emis } = useFinance();
  const ready = accounts.status === "success" && investments.status === "success" && emis.status === "success";
  const value = useMemo(
    () => (ready ? computeNetWorth({ accounts: accounts.data ?? [], investments: investments.data ?? [], emis: emis.data ?? [] }) : null),
    [ready, accounts.data, investments.data, emis.data],
  );
  const hasData = Boolean(accounts.data?.length || investments.data?.length || emis.data?.some((e) => e.status === "active"));
  return { netWorth: value, hasData, error: accounts.error ?? investments.error ?? emis.error ?? null };
}
