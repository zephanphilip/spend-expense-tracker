import { deleteDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";

import { budgetInputSchema } from "@/lib/validation/finance";
import type { Budget, BudgetInput, MonthKey } from "@/types";

import { budgetConverter } from "./converters";
import { budgetDoc, budgetsCol } from "./paths";

/** The most recent 36 monthly budget documents, newest first. */
export function subscribeBudgets(
  uid: string,
  onData: (budgets: Budget[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(budgetsCol(uid), orderBy("month", "desc"), limit(36)).withConverter(budgetConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/** Saves the full budget for a month (one document per month, id = "yyyy-MM"). */
export function saveBudget(uid: string, month: MonthKey, input: BudgetInput): Promise<void> {
  const valid = budgetInputSchema.parse(input);
  return setDoc(budgetDoc(uid, month), {
    month,
    overall: valid.overall,
    categories: valid.categories,
    updatedAt: serverTimestamp(),
  });
}

/** Removes a month's own budget so it falls back to the previous month's. */
export function deleteBudget(uid: string, month: MonthKey): Promise<void> {
  return deleteDoc(budgetDoc(uid, month));
}
