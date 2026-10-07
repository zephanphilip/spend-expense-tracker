import { PAYMENT_METHOD_META } from "@/lib/constants/payment-methods";
import { minorToInputString } from "@/lib/money";
import type { Category, Expense } from "@/types";

/**
 * Free-text search over note, category name, payment method and amount.
 * Every whitespace-separated term must match somewhere (AND semantics).
 */
export function searchExpenses(
  expenses: readonly Expense[],
  search: string,
  getCategory: (id: string) => Category,
): Expense[] {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...expenses];
  return expenses.filter((e) => {
    const haystack = [
      e.note,
      getCategory(e.categoryId).name,
      PAYMENT_METHOD_META[e.paymentMethod].label,
      minorToInputString(e.amount),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term.replace(/,/g, "")));
  });
}
