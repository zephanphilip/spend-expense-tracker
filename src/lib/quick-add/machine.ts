/**
 * Quick Add as an explicit state machine:
 *
 *   AMOUNT → CATEGORY → NOTE → PAYMENT → CONFIRM → SAVING → SAVED → BUDGET_RESULT
 *
 * Pure (no React, no Firebase) so every transition is unit-tested and any UI — the PWA today,
 * a native companion later — can drive the same flow. Side effects (writing the expense,
 * reading the budget) happen outside, in response to SAVING / SAVED.
 */
import type { PaymentMethod } from "@/lib/constants/payment-methods";
import type { CategoryBudgetStatus } from "@/lib/finance/budget";
import { parseAmountToMinor } from "@/lib/money";
import { MAX_AMOUNT_MINOR, NOTE_MAX_LENGTH } from "@/lib/validation/expense";

export type QuickAddStep =
  | "AMOUNT"
  | "CATEGORY"
  | "NOTE"
  | "PAYMENT"
  | "CONFIRM"
  | "SAVING"
  | "SAVED"
  | "BUDGET_RESULT";

/** The steps the user fills in, in order (the rest are system states). */
export const INPUT_STEPS = ["AMOUNT", "CATEGORY", "NOTE", "PAYMENT", "CONFIRM"] as const satisfies readonly QuickAddStep[];
type InputStep = (typeof INPUT_STEPS)[number];

export interface QuickAddDraft {
  /** Exactly what the amount field holds (already sanitized). */
  amount: string;
  categoryId: string | null;
  note: string;
  paymentMethod: PaymentMethod | null;
}

export interface QuickAddConfig {
  /** Minor-unit digits of the user's currency (2 for INR). */
  digits: number;
  /** false = skip the note step entirely. */
  askNote: boolean;
  /** true = picking a payment method saves straight away (no confirm screen). */
  oneTapSave: boolean;
}

export interface SavedExpense {
  id: string;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note: string;
  occurredAt: Date;
  /** true while the write only exists on this device (offline / slow network). */
  pending: boolean;
}

export type BudgetOutcome =
  | { status: "ready"; budget: CategoryBudgetStatus; fromCache: boolean }
  | { status: "error" };

export interface QuickAddState {
  step: QuickAddStep;
  draft: QuickAddDraft;
  /** Set while saving; a second save for the same draft is refused. */
  submissionId: string | null;
  /** When editing a field from CONFIRM, finishing that step returns to CONFIRM. */
  returnToConfirm: boolean;
  /** For transitions: 1 = forward, -1 = back. */
  direction: 1 | -1;
  saved: SavedExpense | null;
  budget: BudgetOutcome | null;
  error: string | null;
}

export type QuickAddEvent =
  | { type: "SET_AMOUNT"; value: string }
  | { type: "SUBMIT_AMOUNT" }
  | { type: "PICK_CATEGORY"; categoryId: string }
  | { type: "SET_NOTE"; value: string }
  | { type: "SUBMIT_NOTE" }
  | { type: "SKIP_NOTE" }
  | { type: "PICK_METHOD"; method: PaymentMethod; submissionId: string }
  | { type: "EDIT"; step: Exclude<InputStep, "CONFIRM"> }
  | { type: "BACK" }
  | { type: "SAVE"; submissionId: string }
  | { type: "SAVE_SUCCEEDED"; submissionId: string; saved: SavedExpense }
  | { type: "SAVE_FAILED"; submissionId: string; error: string }
  | { type: "BUDGET_LOADED"; expenseId: string; outcome: BudgetOutcome }
  | { type: "RESET" };

export const EMPTY_DRAFT: QuickAddDraft = { amount: "", categoryId: null, note: "", paymentMethod: null };

export function amountMinor(draft: QuickAddDraft, digits: number): number | null {
  const minor = parseAmountToMinor(draft.amount, digits);
  return minor !== null && minor > 0 && minor <= MAX_AMOUNT_MINOR ? minor : null;
}

/** First input step that still needs an answer (CONFIRM when everything is filled). */
export function firstIncompleteStep(draft: QuickAddDraft, config: QuickAddConfig): InputStep {
  if (amountMinor(draft, config.digits) === null) return "AMOUNT";
  if (!draft.categoryId) return "CATEGORY";
  if (!draft.paymentMethod) return config.askNote && !draft.note ? "NOTE" : "PAYMENT";
  return "CONFIRM";
}

export function initialQuickAddState(config: QuickAddConfig, draft: QuickAddDraft = EMPTY_DRAFT): QuickAddState {
  return {
    step: firstIncompleteStep(draft, config),
    draft,
    submissionId: null,
    returnToConfirm: false,
    direction: 1,
    saved: null,
    budget: null,
    error: null,
  };
}

/** The input steps shown for this config, in order. */
export function visibleSteps(config: QuickAddConfig): InputStep[] {
  return INPUT_STEPS.filter((s) => s !== "NOTE" || config.askNote);
}

function forward(state: QuickAddState, next: InputStep, draft = state.draft): QuickAddState {
  const step = state.returnToConfirm && next !== "CONFIRM" && isComplete(draft) ? "CONFIRM" : next;
  return { ...state, draft, step, direction: 1, error: null, returnToConfirm: step === "CONFIRM" ? false : state.returnToConfirm };
}

function isComplete(draft: QuickAddDraft): boolean {
  return Boolean(draft.amount && draft.categoryId && draft.paymentMethod);
}

/** Where BACK leads from an input step (null = nowhere; the UI may close Quick Add). */
export function previousStep(step: QuickAddStep, config: QuickAddConfig): InputStep | null {
  const steps = visibleSteps(config);
  const index = steps.indexOf(step as InputStep);
  return index > 0 ? steps[index - 1] : null;
}

function startSaving(state: QuickAddState, draft: QuickAddDraft, submissionId: string, config: QuickAddConfig): QuickAddState {
  if (amountMinor(draft, config.digits) === null) return { ...state, draft, step: "AMOUNT", direction: -1 };
  if (!draft.categoryId) return { ...state, draft, step: "CATEGORY", direction: -1 };
  if (!draft.paymentMethod) return { ...state, draft, step: "PAYMENT", direction: -1 };
  return { ...state, draft, step: "SAVING", submissionId, direction: 1, error: null, returnToConfirm: false };
}

export function quickAddReducer(config: QuickAddConfig) {
  return function reduce(state: QuickAddState, event: QuickAddEvent): QuickAddState {
    // While a save is in flight only its own outcome is accepted: this is what makes a
    // double tap (or a re-render replaying an event) unable to create a second expense.
    if (state.step === "SAVING") {
      if (event.type === "SAVE_SUCCEEDED" && event.submissionId === state.submissionId) {
        return { ...state, step: "SAVED", saved: event.saved, direction: 1 };
      }
      if (event.type === "SAVE_FAILED" && event.submissionId === state.submissionId) {
        return { ...state, step: "CONFIRM", submissionId: null, error: event.error, direction: -1 };
      }
      return state;
    }

    switch (event.type) {
      case "SET_AMOUNT":
        return { ...state, draft: { ...state.draft, amount: event.value }, error: null };
      case "SUBMIT_AMOUNT":
        if (state.step !== "AMOUNT") return state;
        if (amountMinor(state.draft, config.digits) === null) {
          return { ...state, error: state.draft.amount ? "Enter an amount greater than zero" : "Enter an amount" };
        }
        return forward(state, "CATEGORY");
      case "PICK_CATEGORY": {
        if (state.step !== "CATEGORY") return state;
        const draft = { ...state.draft, categoryId: event.categoryId };
        return forward(state, config.askNote ? "NOTE" : "PAYMENT", draft);
      }
      case "SET_NOTE":
        return { ...state, draft: { ...state.draft, note: event.value.slice(0, NOTE_MAX_LENGTH) } };
      case "SUBMIT_NOTE":
      case "SKIP_NOTE": {
        if (state.step !== "NOTE") return state;
        const draft = event.type === "SKIP_NOTE" ? { ...state.draft, note: "" } : { ...state.draft, note: state.draft.note.trim() };
        return forward(state, "PAYMENT", draft);
      }
      case "PICK_METHOD": {
        if (state.step !== "PAYMENT") return state;
        const draft = { ...state.draft, paymentMethod: event.method };
        // One-tap save, except when the user came here to change the method from CONFIRM.
        if (config.oneTapSave && !state.returnToConfirm) return startSaving(state, draft, event.submissionId, config);
        return forward(state, "CONFIRM", draft);
      }
      case "EDIT":
        if (state.step !== "CONFIRM") return state;
        if (event.step === "NOTE" && !config.askNote) return state;
        return { ...state, step: event.step, returnToConfirm: true, direction: -1, error: null };
      case "BACK": {
        if (state.returnToConfirm && state.step !== "CONFIRM" && isComplete(state.draft)) {
          return { ...state, step: "CONFIRM", returnToConfirm: false, direction: 1 };
        }
        const previous = previousStep(state.step, config);
        return previous ? { ...state, step: previous, direction: -1, error: null } : state;
      }
      case "SAVE":
        if (state.step !== "CONFIRM") return state;
        return startSaving(state, state.draft, event.submissionId, config);
      case "BUDGET_LOADED":
        if (state.step !== "SAVED" || state.saved?.id !== event.expenseId) return state;
        return { ...state, step: "BUDGET_RESULT", budget: event.outcome };
      case "RESET":
        return initialQuickAddState(config);
      default:
        return state;
    }
  };
}
