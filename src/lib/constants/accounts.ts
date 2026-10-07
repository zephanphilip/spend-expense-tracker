import { Banknote, CreditCard, Landmark, type LucideIcon, Smartphone } from "lucide-react";

export const ACCOUNT_TYPES = ["bank", "cash", "wallet", "credit_card"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; short: string; icon: LucideIcon; tile: string }> = {
  bank: {
    label: "Bank account",
    short: "Bank",
    icon: Landmark,
    tile: "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  },
  cash: {
    label: "Cash",
    short: "Cash",
    icon: Banknote,
    tile: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  wallet: {
    label: "UPI / Wallet",
    short: "Wallet",
    icon: Smartphone,
    tile: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  },
  credit_card: {
    label: "Credit card",
    short: "Card",
    icon: CreditCard,
    tile: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  },
};

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && (ACCOUNT_TYPES as readonly string[]).includes(value);
}

export const INVESTMENT_KINDS = ["mutual_fund", "stock", "fd", "gold", "crypto", "other"] as const;
export type InvestmentKind = (typeof INVESTMENT_KINDS)[number];

export const INVESTMENT_KIND_LABELS: Record<InvestmentKind, string> = {
  mutual_fund: "Mutual fund",
  stock: "Stocks",
  fd: "Fixed deposit",
  gold: "Gold",
  crypto: "Crypto",
  other: "Other",
};

export function isInvestmentKind(value: unknown): value is InvestmentKind {
  return typeof value === "string" && (INVESTMENT_KINDS as readonly string[]).includes(value);
}

export const RECURRENCE_UNITS = ["day", "week", "month", "year"] as const;
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];
