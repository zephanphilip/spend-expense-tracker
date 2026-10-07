import { collection, doc } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";

export const userDoc = (uid: string) => doc(getDb(), "users", uid);
export const expensesCol = (uid: string) => collection(getDb(), "users", uid, "expenses");
export const expenseDoc = (uid: string, id: string) => doc(getDb(), "users", uid, "expenses", id);
export const categoriesCol = (uid: string) => collection(getDb(), "users", uid, "categories");
export const categoryDoc = (uid: string, id: string) =>
  doc(getDb(), "users", uid, "categories", id);

const sub = (uid: string, ...segments: string[]) => doc(getDb(), "users", uid, ...segments);
const subCol = (uid: string, ...segments: string[]) =>
  collection(getDb(), "users", uid, ...(segments as [string, ...string[]]));

export const incomesCol = (uid: string) => subCol(uid, "incomes");
export const incomeDoc = (uid: string, id: string) => sub(uid, "incomes", id);
export const recurringIncomesCol = (uid: string) => subCol(uid, "recurringIncomes");
export const recurringIncomeDoc = (uid: string, id: string) => sub(uid, "recurringIncomes", id);
export const budgetsCol = (uid: string) => subCol(uid, "budgets");
export const budgetDoc = (uid: string, month: string) => sub(uid, "budgets", month);
export const emisCol = (uid: string) => subCol(uid, "emis");
export const emiDoc = (uid: string, id: string) => sub(uid, "emis", id);
export const emiPaymentsCol = (uid: string, emiId: string) => subCol(uid, "emis", emiId, "payments");
export const emiPaymentDoc = (uid: string, emiId: string, installment: number) =>
  sub(uid, "emis", emiId, "payments", String(installment));
export const goalsCol = (uid: string) => subCol(uid, "goals");
export const goalDoc = (uid: string, id: string) => sub(uid, "goals", id);
export const contributionsCol = (uid: string, goalId: string) =>
  subCol(uid, "goals", goalId, "contributions");
export const contributionDoc = (uid: string, goalId: string, id: string) =>
  sub(uid, "goals", goalId, "contributions", id);

// Phase 3
export const accountsCol = (uid: string) => subCol(uid, "accounts");
export const accountDoc = (uid: string, id: string) => sub(uid, "accounts", id);
export const transfersCol = (uid: string) => subCol(uid, "transfers");
export const transferDoc = (uid: string, id: string) => sub(uid, "transfers", id);
export const investmentsCol = (uid: string) => subCol(uid, "investments");
export const investmentDoc = (uid: string, id: string) => sub(uid, "investments", id);
export const investmentTxCol = (uid: string) => subCol(uid, "investmentTransactions");
export const investmentTxDoc = (uid: string, id: string) => sub(uid, "investmentTransactions", id);
export const recurringPaymentsCol = (uid: string) => subCol(uid, "recurringPayments");
export const recurringPaymentDoc = (uid: string, id: string) => sub(uid, "recurringPayments", id);
export const netWorthCol = (uid: string) => subCol(uid, "netWorth");
export const netWorthDoc = (uid: string, month: string) => sub(uid, "netWorth", month);

// Phase 4
export const monthlyStatsCol = (uid: string) => subCol(uid, "monthlyStats");
export const monthlyStatsDoc = (uid: string, month: string) => sub(uid, "monthlyStats", month);
export const importsCol = (uid: string) => subCol(uid, "imports");
export const importDoc = (uid: string, id: string) => sub(uid, "imports", id);
