import { format } from "date-fns";

import { ACCOUNT_TYPE_META, INVESTMENT_KIND_LABELS } from "@/lib/constants/accounts";
import { INCOME_SOURCE_META } from "@/lib/constants/income";
import { PAYMENT_METHOD_META } from "@/lib/constants/payment-methods";
import { emiOverview } from "@/lib/finance/emi";
import { goalProgress } from "@/lib/finance/goals";
import { investmentReturns } from "@/lib/finance/investments";
import { frequencyLabel, nextOccurrence } from "@/lib/finance/recurrence";
import type { Account, Budget, Category, Emi, Expense, Goal, Income, Investment, RecurringPayment } from "@/types";

import { type Cell, toCsv } from "./csv";

export const EXPORT_TYPES = [
  "expenses",
  "incomes",
  "budgets",
  "emis",
  "accounts",
  "investments",
  "recurring",
  "wishlist",
  "categories",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_LABELS: Record<ExportType, string> = {
  expenses: "Expenses",
  incomes: "Income",
  budgets: "Budgets",
  emis: "EMIs",
  accounts: "Accounts & cards",
  investments: "Investments",
  recurring: "Recurring payments",
  wishlist: "Wishlist",
  categories: "Categories",
};

/** Minor units → "1234.50" / "-12.05" (plain numbers so spreadsheets can sum them). */
export function major(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const dt = (d: Date | null | undefined) => (d ? format(d, "yyyy-MM-dd HH:mm") : "");
const day = (d: Date | null | undefined) => (d ? format(d, "yyyy-MM-dd") : "");

export interface ExportLookups {
  category: (id: string) => Category;
  accountName: (id: string | null) => string | null;
}

/** Each exporter returns a header row + data rows; `toCsv` handles escaping and safety. */
export const exporters = {
  expenses: (items: readonly Expense[], l: ExportLookups): Cell[][] => [
    ["Date", "Amount", "Category", "Note", "Payment method", "Account", "Type"],
    ...items.map((e) => [dt(e.occurredAt), major(e.amount), l.category(e.categoryId).name, e.note, PAYMENT_METHOD_META[e.paymentMethod].label, l.accountName(e.accountId) ?? "", e.type]),
  ],
  incomes: (items: readonly Income[], l: ExportLookups): Cell[][] => [
    ["Date received", "Amount", "Type", "For month", "Expected on", "Note", "Account", "Recurring"],
    ...items.map((i) => [dt(i.receivedAt), major(i.amount), INCOME_SOURCE_META[i.source].label, i.forMonth, day(i.expectedAt), i.note, l.accountName(i.accountId) ?? "", i.recurringId ? "yes" : "no"]),
  ],
  budgets: (items: readonly Budget[], l: ExportLookups): Cell[][] => [
    ["Month", "Scope", "Limit"],
    ...items.flatMap((b) => [
      ...(b.overall ? [[b.month, "Overall", major(b.overall)]] : []),
      ...Object.entries(b.categories).map(([id, limit]) => [b.month, l.category(id).name, major(limit)]),
    ]),
  ],
  emis: (items: readonly Emi[]): Cell[][] => [
    ["Name", "Lender", "Principal", "Interest rate %", "Monthly EMI", "Tenure (months)", "Paid", "Remaining", "Outstanding", "Start date", "End date", "Next due", "Status"],
    ...items.map((e) => {
      const o = emiOverview(e);
      return [e.name, e.lender ?? "", major(e.principal), (e.annualRateBps / 100).toFixed(2), major(e.monthlyAmount), e.tenureMonths, e.paidCount, o.remainingTenure, major(e.outstanding), day(e.startDate), day(o.endDate), day(o.nextDueDate), e.status];
    }),
  ],
  accounts: (items: readonly Account[]): Cell[][] => [
    ["Name", "Type", "Institution", "Opening balance", "Current balance", "Credit limit", "Statement day", "Due day", "Statement amount", "Minimum due", "Active"],
    ...items.map((a) => [a.name, ACCOUNT_TYPE_META[a.type].label, a.institution ?? "", major(a.openingBalance), major(a.balance), major(a.creditLimit), a.statementDay ?? "", a.dueDay ?? "", major(a.statementBalance), major(a.minimumDue), a.active ? "yes" : "no"]),
  ],
  investments: (items: readonly Investment[]): Cell[][] => [
    ["Name", "Type", "Platform", "Invested", "Current value", "Returns", "Return %", "Realised gain", "Purchase date", "Last valued", "Status"],
    ...items.map((i) => {
      const r = investmentReturns(i);
      return [i.name, INVESTMENT_KIND_LABELS[i.kind], i.institution ?? "", major(i.investedAmount), major(i.currentValue), major(r.absolute), r.ratio === null ? "" : (r.ratio * 100).toFixed(2), major(i.realizedGain), day(i.purchaseDate), day(i.lastValuedAt), i.status];
    }),
  ],
  recurring: (items: readonly RecurringPayment[], l: ExportLookups): Cell[][] => [
    ["Name", "Amount", "Frequency", "Category", "Payment method", "Account", "Next payment", "Ends", "Active"],
    ...items.map((p) => [p.name, major(p.amount), frequencyLabel(p.unit, p.interval), l.category(p.categoryId).name, PAYMENT_METHOD_META[p.paymentMethod].label, l.accountName(p.accountId) ?? "", day(nextOccurrence(p)), day(p.endDate), p.active ? "yes" : "no"]),
  ],
  wishlist: (items: readonly Goal[]): Cell[][] => [
    ["Wish", "Target", "Saved", "Remaining", "Progress %", "Target date", "Status"],
    ...items.map((g) => {
      const p = goalProgress(g);
      return [g.name, major(g.targetAmount), major(g.savedAmount), major(p.remaining), p.percent, day(g.targetDate), p.achieved ? "achieved" : g.status];
    }),
  ],
  categories: (items: readonly Category[]): Cell[][] => [
    ["Name", "Icon", "Colour", "Built-in", "Archived"],
    ...items.map((c) => [c.name, c.icon, c.color, c.isDefault ? "yes" : "no", c.archived ? "yes" : "no"]),
  ],
} satisfies Record<ExportType, (items: never, l: ExportLookups) => Cell[][]>;

export function exportFileName(type: ExportType, now = new Date()): string {
  return `spend-${type}-${format(now, "yyyy-MM-dd")}.csv`;
}

export { toCsv };
