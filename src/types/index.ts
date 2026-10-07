import type { AccountType, InvestmentKind, RecurrenceUnit } from "@/lib/constants/accounts";
import type { CategoryColorKey } from "@/lib/constants/colors";
import type { CategoryIconKey } from "@/lib/constants/icons";
import type { CurrencyCode } from "@/lib/constants/currencies";
import type { IncomeSource } from "@/lib/constants/income";
import type { PaymentMethod } from "@/lib/constants/payment-methods";
import type { TransactionType } from "@/lib/constants/transactions";

export type {
  AccountType,
  CategoryColorKey,
  CategoryIconKey,
  CurrencyCode,
  IncomeSource,
  InvestmentKind,
  PaymentMethod,
  RecurrenceUnit,
  TransactionType,
};

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  currency: CurrencyCode;
  createdAt: Date;
  updatedAt: Date;
}

export type UserProfileUpdate = Partial<
  Pick<UserProfile, "displayName" | "currency">
>;

export interface Category {
  id: string;
  name: string;
  icon: CategoryIconKey;
  color: CategoryColorKey;
  isDefault: boolean;
  archived: boolean;
  createdAt?: Date;
}

export type CategoryInput = Pick<Category, "name" | "icon" | "color">;

export interface Expense {
  id: string;
  /** Integer amount in minor units (paise, cents). */
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note: string;
  occurredAt: Date;
  /** Always "EXPENSE" (Phase 1 documents without the field read as EXPENSE). */
  type: "EXPENSE";
  /** Account/card the money came from; null = not tracked against an account. */
  accountId: string | null;
  /** Set when generated from a recurring payment: which schedule and which occurrence. */
  recurringId: string | null;
  occurrence: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseInput = Pick<Expense, "amount" | "categoryId" | "paymentMethod" | "note" | "occurredAt"> & {
  accountId?: string | null;
  recurringId?: string | null;
  occurrence?: number | null;
};

export interface ExpenseQuery {
  from?: Date;
  to?: Date;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  limit: number;
}

/** Discriminated state for any async, subscription-backed resource. */
export type AsyncState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "error"; data?: undefined; error: Error }
  | { status: "success"; data: T; error?: undefined };

// ---------------------------------------------------------------- Phase 2


/** "yyyy-MM" in the user's local time zone. */
export type MonthKey = string;

export interface Income {
  id: string;
  /** Minor units. */
  amount: number;
  source: IncomeSource;
  note: string;
  receivedAt: Date;
  /** The month this income belongs to (salary for September may arrive on 1 October). */
  forMonth: MonthKey;
  /** When it was expected (salary tracking); null if not tracked. */
  expectedAt: Date | null;
  /** Set when generated from a recurring template. */
  recurringId: string | null;
  type: "INCOME";
  /** Account the money went into; null = not tracked against an account. */
  accountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IncomeInput = Pick<
  Income,
  "amount" | "source" | "note" | "receivedAt" | "forMonth" | "expectedAt" | "recurringId"
> & { accountId?: string | null };

export interface RecurringIncome {
  id: string;
  name: string;
  source: IncomeSource;
  amount: number;
  /** 1–31; clamped to the month's last day. */
  dayOfMonth: number;
  startMonth: MonthKey;
  active: boolean;
  accountId: string | null;
  /** Record automatically on the expected day (Phase 5). */
  autoRecord: boolean;
  createdAt: Date;
}

export type RecurringIncomeInput = Pick<
  RecurringIncome,
  "name" | "source" | "amount" | "dayOfMonth" | "startMonth" | "active"
> & { accountId?: string | null; autoRecord?: boolean };

export interface Budget {
  month: MonthKey;
  /** Overall monthly limit in minor units; null when unset. */
  overall: number | null;
  /** categoryId → monthly limit in minor units. */
  categories: Record<string, number>;
  updatedAt: Date;
}

export type BudgetInput = Pick<Budget, "overall" | "categories">;

export type EmiStatus = "active" | "closed";

export interface Emi {
  id: string;
  name: string;
  lender: string | null;
  principal: number;
  /** Annual interest rate in basis points (10.5% → 1050). */
  annualRateBps: number;
  monthlyAmount: number;
  tenureMonths: number;
  /** Due date of the first installment. */
  startDate: Date;
  paidCount: number;
  outstanding: number;
  status: EmiStatus;
  createdAt: Date;
}

export type EmiInput = Pick<
  Emi,
  "name" | "lender" | "principal" | "annualRateBps" | "monthlyAmount" | "tenureMonths" | "startDate"
>;

export interface EmiPayment {
  id: string;
  installment: number;
  amount: number;
  principalPart: number;
  interestPart: number;
  dueDate: Date;
  paidAt: Date;
  expenseId: string | null;
  /** Account debited for this installment (Phase 3); null for older records. */
  accountId: string | null;
}

export type GoalStatus = "active" | "archived";

export interface Goal {
  id: string;
  name: string;
  icon: CategoryIconKey;
  color: CategoryColorKey;
  targetAmount: number;
  savedAmount: number;
  targetDate: Date | null;
  status: GoalStatus;
  createdAt: Date;
}

export type GoalInput = Pick<Goal, "name" | "icon" | "color" | "targetAmount" | "targetDate">;

export interface GoalContribution {
  id: string;
  /** Positive to save, negative to withdraw. */
  amount: number;
  note: string;
  contributedAt: Date;
}

// ---------------------------------------------------------------- Phase 3

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  /**
   * Signed minor units. Assets are positive when you hold money; a credit card's balance
   * is negative while you owe on it (outstanding = −balance).
   */
  openingBalance: number;
  balance: number;
  active: boolean;
  // Credit cards only
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  /** Amount billed on the latest statement still to pay (≥ 0). */
  statementBalance: number | null;
  minimumDue: number | null;
  createdAt: Date;
}

export type AccountInput = Pick<
  Account,
  "name" | "type" | "institution" | "openingBalance" | "active" | "creditLimit" | "statementDay" | "dueDay"
>;

export interface Transfer {
  id: string;
  type: "TRANSFER" | "DEBT_PAYMENT";
  amount: number;
  fromAccountId: string;
  /** Destination account (bank/cash/wallet/card); null when paying an EMI. */
  toAccountId: string | null;
  emiId: string | null;
  emiInstallment: number | null;
  note: string;
  occurredAt: Date;
  createdAt: Date;
}

export interface Investment {
  id: string;
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  /** Remaining cost basis (minor units). */
  investedAmount: number;
  currentValue: number;
  /** Cumulative gain/loss realised by selling. */
  realizedGain: number;
  purchaseDate: Date;
  lastValuedAt: Date;
  status: "active" | "closed";
  createdAt: Date;
}

export type InvestmentTxKind = "BUY" | "SELL" | "VALUATION";

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  type: "INVESTMENT";
  kind: InvestmentTxKind;
  /** BUY/SELL: cash amount. VALUATION: the new current value. */
  amount: number;
  /** SELL only: cost basis removed from investedAmount. */
  costBasis: number | null;
  accountId: string | null;
  note: string;
  occurredAt: Date;
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId: string | null;
  unit: RecurrenceUnit;
  interval: number;
  startDate: Date;
  /** Occurrences already paid or skipped; the next one is occurrence `cycle`. */
  cycle: number;
  nextDate: Date;
  endDate: Date | null;
  active: boolean;
  /** Record each occurrence automatically on its due date (Phase 5). */
  autoPay: boolean;
  createdAt: Date;
}

export type RecurringPaymentInput = Pick<
  RecurringPayment,
  "name" | "amount" | "categoryId" | "paymentMethod" | "accountId" | "unit" | "interval" | "startDate" | "endDate" | "active"
> & { autoPay?: boolean };

export interface NetWorthSnapshot {
  month: MonthKey;
  assets: number;
  liabilities: number;
  netWorth: number;
  updatedAt: Date;
}
