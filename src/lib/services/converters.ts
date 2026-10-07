import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  Timestamp,
} from "firebase/firestore";

import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { CATEGORY_ICONS } from "@/lib/constants/icons";
import { DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/constants/currencies";
import { DEFAULT_PAYMENT_METHOD, isPaymentMethod } from "@/lib/constants/payment-methods";
import { isAccountType, isInvestmentKind } from "@/lib/constants/accounts";
import { isIncomeSource } from "@/lib/constants/income";
import { isMonthKey, monthKey } from "@/lib/months";
import type {
  Account,
  Budget,
  Category,
  Emi,
  EmiPayment,
  Expense,
  Goal,
  GoalContribution,
  Income,
  Investment,
  InvestmentTransaction,
  NetWorthSnapshot,
  RecurringIncome,
  RecurringPayment,
  Transfer,
  UserProfile,
} from "@/types";

/** Pending server timestamps are estimated locally so freshly written docs sort correctly. */
const SNAPSHOT_OPTIONS: SnapshotOptions = { serverTimestamps: "estimate" };

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

function readOnly<T>(fromFirestore: (data: DocumentData, id: string) => T): FirestoreDataConverter<T> {
  return {
    toFirestore() {
      throw new Error("Write through the service functions, not the converter.");
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
      return fromFirestore(snapshot.data({ ...SNAPSHOT_OPTIONS, ...options }), snapshot.id);
    },
  };
}

export const expenseConverter = readOnly<Expense>((data, id) => ({
  id,
  amount: typeof data.amount === "number" ? data.amount : 0,
  categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
  paymentMethod: isPaymentMethod(data.paymentMethod) ? data.paymentMethod : DEFAULT_PAYMENT_METHOD,
  note: typeof data.note === "string" ? data.note : "",
  occurredAt: toDate(data.occurredAt),
  // Phase 3 fields: older documents predate them and read as untracked expenses.
  type: "EXPENSE",
  accountId: typeof data.accountId === "string" ? data.accountId : null,
  recurringId: typeof data.recurringId === "string" ? data.recurringId : null,
  occurrence: typeof data.occurrence === "number" ? data.occurrence : null,
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
}));

export const categoryConverter = readOnly<Category>((data, id) => ({
  id,
  name: typeof data.name === "string" ? data.name : "Untitled",
  icon: data.icon in CATEGORY_ICONS ? data.icon : "other",
  color: data.color in CATEGORY_COLORS ? data.color : "slate",
  isDefault: false,
  archived: data.archived === true,
  createdAt: toDate(data.createdAt),
}));

export const userProfileConverter = readOnly<UserProfile>((data, id) => ({
  uid: id,
  email: typeof data.email === "string" ? data.email : null,
  displayName: typeof data.displayName === "string" ? data.displayName : null,
  photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
  currency: isCurrencyCode(data.currency) ? data.currency : DEFAULT_CURRENCY,
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
}));

// ---------------------------------------------------------------- Phase 2

const int = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const nullableDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

export const incomeConverter = readOnly<Income>((data, id) => {
  const receivedAt = toDate(data.receivedAt);
  return {
    id,
    amount: int(data.amount),
    source: isIncomeSource(data.source) ? data.source : "other",
    note: str(data.note),
    receivedAt,
    forMonth: isMonthKey(data.forMonth) ? data.forMonth : monthKey(receivedAt),
    expectedAt: nullableDate(data.expectedAt),
    recurringId: typeof data.recurringId === "string" ? data.recurringId : null,
    type: "INCOME",
    accountId: typeof data.accountId === "string" ? data.accountId : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
});

export const recurringIncomeConverter = readOnly<RecurringIncome>((data, id) => ({
  id,
  name: str(data.name, "Recurring income"),
  source: isIncomeSource(data.source) ? data.source : "other",
  amount: int(data.amount),
  dayOfMonth: Math.min(Math.max(int(data.dayOfMonth, 1), 1), 31),
  startMonth: isMonthKey(data.startMonth) ? data.startMonth : "1970-01",
  active: data.active !== false,
  accountId: typeof data.accountId === "string" ? data.accountId : null,
  autoRecord: data.autoRecord === true,
  createdAt: toDate(data.createdAt),
}));

export const budgetConverter = readOnly<Budget>((data, id) => {
  const categories: Record<string, number> = {};
  if (data.categories && typeof data.categories === "object") {
    for (const [key, value] of Object.entries(data.categories as Record<string, unknown>)) {
      if (typeof value === "number" && value > 0) categories[key] = Math.round(value);
    }
  }
  return {
    month: isMonthKey(data.month) ? data.month : id,
    overall: typeof data.overall === "number" && data.overall > 0 ? Math.round(data.overall) : null,
    categories,
    updatedAt: toDate(data.updatedAt),
  };
});

export const emiConverter = readOnly<Emi>((data, id) => ({
  id,
  name: str(data.name, "Loan"),
  lender: typeof data.lender === "string" && data.lender ? data.lender : null,
  principal: int(data.principal),
  annualRateBps: int(data.annualRateBps),
  monthlyAmount: int(data.monthlyAmount),
  tenureMonths: Math.max(int(data.tenureMonths, 1), 1),
  startDate: toDate(data.startDate),
  paidCount: int(data.paidCount),
  outstanding: int(data.outstanding),
  status: data.status === "closed" ? "closed" : "active",
  createdAt: toDate(data.createdAt),
}));

export const emiPaymentConverter = readOnly<EmiPayment>((data, id) => ({
  id,
  installment: int(data.installment),
  amount: int(data.amount),
  principalPart: int(data.principalPart),
  interestPart: int(data.interestPart),
  dueDate: toDate(data.dueDate),
  paidAt: toDate(data.paidAt),
  expenseId: typeof data.expenseId === "string" ? data.expenseId : null,
  accountId: typeof data.accountId === "string" ? data.accountId : null,
}));

export const goalConverter = readOnly<Goal>((data, id) => ({
  id,
  name: str(data.name, "Goal"),
  icon: data.icon in CATEGORY_ICONS ? data.icon : "piggy",
  color: data.color in CATEGORY_COLORS ? data.color : "emerald",
  targetAmount: int(data.targetAmount),
  savedAmount: int(data.savedAmount),
  targetDate: nullableDate(data.targetDate),
  status: data.status === "archived" ? "archived" : "active",
  createdAt: toDate(data.createdAt),
}));

export const goalContributionConverter = readOnly<GoalContribution>((data, id) => ({
  id,
  amount: int(data.amount),
  note: str(data.note),
  contributedAt: toDate(data.contributedAt),
}));

// ---------------------------------------------------------------- Phase 3

const nullableInt = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
const nullableStr = (value: unknown) => (typeof value === "string" && value ? value : null);

export const accountConverter = readOnly<Account>((data, id) => ({
  id,
  name: str(data.name, "Account"),
  type: isAccountType(data.type) ? data.type : "bank",
  institution: nullableStr(data.institution),
  openingBalance: int(data.openingBalance),
  balance: int(data.balance),
  active: data.active !== false,
  creditLimit: nullableInt(data.creditLimit),
  statementDay: nullableInt(data.statementDay),
  dueDay: nullableInt(data.dueDay),
  statementBalance: nullableInt(data.statementBalance),
  minimumDue: nullableInt(data.minimumDue),
  createdAt: toDate(data.createdAt),
}));

export const transferConverter = readOnly<Transfer>((data, id) => ({
  id,
  type: data.type === "DEBT_PAYMENT" ? "DEBT_PAYMENT" : "TRANSFER",
  amount: int(data.amount),
  fromAccountId: str(data.fromAccountId),
  toAccountId: nullableStr(data.toAccountId),
  emiId: nullableStr(data.emiId),
  emiInstallment: nullableInt(data.emiInstallment),
  note: str(data.note),
  occurredAt: toDate(data.occurredAt),
  createdAt: toDate(data.createdAt),
}));

export const investmentConverter = readOnly<Investment>((data, id) => ({
  id,
  name: str(data.name, "Investment"),
  kind: isInvestmentKind(data.kind) ? data.kind : "other",
  institution: nullableStr(data.institution),
  investedAmount: int(data.investedAmount),
  currentValue: int(data.currentValue),
  realizedGain: int(data.realizedGain),
  purchaseDate: toDate(data.purchaseDate),
  lastValuedAt: toDate(data.lastValuedAt),
  status: data.status === "closed" ? "closed" : "active",
  createdAt: toDate(data.createdAt),
}));

export const investmentTxConverter = readOnly<InvestmentTransaction>((data, id) => ({
  id,
  investmentId: str(data.investmentId),
  type: "INVESTMENT",
  kind: data.kind === "SELL" || data.kind === "VALUATION" ? data.kind : "BUY",
  amount: int(data.amount),
  costBasis: nullableInt(data.costBasis),
  accountId: nullableStr(data.accountId),
  note: str(data.note),
  occurredAt: toDate(data.occurredAt),
}));

export const recurringPaymentConverter = readOnly<RecurringPayment>((data, id) => ({
  id,
  name: str(data.name, "Payment"),
  amount: int(data.amount),
  categoryId: str(data.categoryId, "other"),
  paymentMethod: isPaymentMethod(data.paymentMethod) ? data.paymentMethod : DEFAULT_PAYMENT_METHOD,
  accountId: nullableStr(data.accountId),
  unit: data.unit === "day" || data.unit === "week" || data.unit === "year" ? data.unit : "month",
  interval: Math.max(int(data.interval, 1), 1),
  startDate: toDate(data.startDate),
  cycle: int(data.cycle),
  nextDate: toDate(data.nextDate),
  endDate: nullableDate(data.endDate),
  active: data.active !== false,
  autoPay: data.autoPay === true,
  createdAt: toDate(data.createdAt),
}));

export const netWorthConverter = readOnly<NetWorthSnapshot>((data, id) => ({
  month: isMonthKey(data.month) ? data.month : id,
  assets: int(data.assets),
  liabilities: int(data.liabilities),
  netWorth: int(data.netWorth),
  updatedAt: toDate(data.updatedAt),
}));
