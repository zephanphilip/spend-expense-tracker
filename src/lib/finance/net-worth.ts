import type { Account, Emi, Investment } from "@/types";

import { cardOutstanding } from "./accounts";

export interface NetWorth {
  assets: { bank: number; cash: number; wallet: number; investments: number; cardCredit: number; total: number };
  liabilities: { creditCards: number; loans: number; total: number };
  netWorth: number;
}

/**
 * Assets: bank, cash and wallet balances (overdrafts count negative), investment value and
 * any card overpayment. Liabilities: card outstanding and remaining EMI principal.
 */
export function computeNetWorth({
  accounts,
  investments,
  emis,
}: {
  accounts: readonly Account[];
  investments: readonly Investment[];
  emis: readonly Emi[];
}): NetWorth {
  const sumBalance = (type: Account["type"]) =>
    accounts.filter((a) => a.type === type).reduce((s, a) => s + a.balance, 0);
  const cards = accounts.filter((a) => a.type === "credit_card");
  const assets = {
    bank: sumBalance("bank"),
    cash: sumBalance("cash"),
    wallet: sumBalance("wallet"),
    investments: investments.filter((i) => i.status === "active").reduce((s, i) => s + i.currentValue, 0),
    cardCredit: cards.reduce((s, a) => s + Math.max(a.balance, 0), 0),
    total: 0,
  };
  assets.total = assets.bank + assets.cash + assets.wallet + assets.investments + assets.cardCredit;
  const liabilities = {
    creditCards: cards.reduce((s, a) => s + cardOutstanding(a), 0),
    loans: emis.filter((e) => e.status === "active").reduce((s, e) => s + e.outstanding, 0),
    total: 0,
  };
  liabilities.total = liabilities.creditCards + liabilities.loans;
  return { assets, liabilities, netWorth: assets.total - liabilities.total };
}
