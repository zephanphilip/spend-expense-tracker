/**
 * Explicit transaction types. Every balance-affecting record carries one of these.
 * Only EXPENSE counts towards spending; TRANSFER and DEBT_PAYMENT move money between
 * your own accounts/liabilities, INVESTMENT moves it into holdings.
 */
export const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "TRANSFER", "INVESTMENT", "DEBT_PAYMENT"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  INVESTMENT: "Investment",
  DEBT_PAYMENT: "Debt payment",
};
