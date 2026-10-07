/**
 * `/quick-add` deep links, e.g. from an iOS Shortcut that asks for the amount natively:
 *
 *   /quick-add?amount=500&category=food&method=upi&note=Lunch
 *
 * Every parameter is optional and untrusted: invalid values are dropped, never guessed.
 * A link can pre-fill the draft but can never save on its own — the user always confirms.
 */
import { isPaymentMethod, PAYMENT_METHOD_META, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants/payment-methods";
import { sanitizeAmountInput } from "@/lib/money";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import type { Category } from "@/types";

import { EMPTY_DRAFT, type QuickAddDraft } from "./machine";

export const QUICK_ADD_PATH = "/quick-add";

export interface QuickAddLinkParams {
  amount?: string;
  /** Category id or (case-insensitive) name. */
  category?: string;
  /** Payment method id or label ("upi", "Credit", …). */
  method?: string;
  note?: string;
}

/** Builds a Quick Add URL (absolute when `origin` is given). */
export function quickAddUrl(params: QuickAddLinkParams = {}, origin?: string): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const path = query.size ? `${QUICK_ADD_PATH}?${query}` : QUICK_ADD_PATH;
  return origin ? new URL(path, origin).toString() : path;
}

/** "1,250.50" (thousands) → "1250.50"; "12,5" (decimal comma) → "12.5"; "-5" → "5". */
function parseLinkAmount(raw: string, digits: number): string {
  const value = raw.trim().replace(/\s/g, "");
  const thousands = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value);
  return sanitizeAmountInput(thousands ? value.replace(/,/g, "") : value, digits);
}

function matchCategory(raw: string, categories: readonly Category[]): string | null {
  const needle = raw.trim().toLowerCase();
  if (!needle) return null;
  const match =
    categories.find((c) => c.id.toLowerCase() === needle) ?? categories.find((c) => c.name.toLowerCase() === needle);
  return match?.id ?? null;
}

function matchMethod(raw: string): PaymentMethod | null {
  const needle = raw.trim().toLowerCase();
  if (isPaymentMethod(needle)) return needle;
  return PAYMENT_METHODS.find((m) => PAYMENT_METHOD_META[m].label.toLowerCase() === needle) ?? null;
}

/** Draft pre-filled from a deep link's query string. */
export function draftFromSearchParams(
  params: URLSearchParams,
  { categories, digits }: { categories: readonly Category[]; digits: number },
): QuickAddDraft {
  const amount = params.get("amount");
  const category = params.get("category");
  const method = params.get("method");
  const note = params.get("note");
  return {
    ...EMPTY_DRAFT,
    amount: amount ? parseLinkAmount(amount, digits) : "",
    categoryId: category ? matchCategory(category, categories) : null,
    paymentMethod: method ? matchMethod(method) : null,
    note: note ? note.trim().slice(0, NOTE_MAX_LENGTH) : "",
  };
}

export function hasLinkParams(params: URLSearchParams): boolean {
  return ["amount", "category", "method", "note"].some((key) => params.has(key));
}
