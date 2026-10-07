"use client";

import { ChevronLeft, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useLocalPreference } from "@/hooks/use-local-preference";
import { defaultAccountFor, readExpenseUsage, rememberExpenseChoices } from "@/lib/expense-preferences";
import { settleQuickly } from "@/lib/async";
import { currencySymbol, formatMoney, fractionDigits, sanitizeAmountInput } from "@/lib/money";
import { draftFromSearchParams, hasLinkParams, QUICK_ADD_PATH } from "@/lib/quick-add/deep-link";
import { getQuickExpenseLauncher, type QuickExpenseLauncher } from "@/lib/quick-add/launcher";
import {
  amountMinor,
  initialQuickAddState,
  INPUT_STEPS,
  previousStep,
  type QuickAddConfig,
  type QuickAddDraft,
  quickAddReducer,
  type QuickAddState,
  type QuickAddStep,
  visibleSteps,
} from "@/lib/quick-add/machine";
import { consumeLaunch, DEFAULT_QUICK_ADD_PREFS, QUICK_ADD_PREFS_KEY, type QuickAddPreferences } from "@/lib/quick-add/preferences";
import { calculateCategoryBudgetStatus, createExpense } from "@/lib/services/expense.service";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";

import { AmountStep, CategoryStep, ConfirmStep, NoteStep, PaymentStep, ResultStep } from "./quick-add-steps";
import { useQuickAddData } from "./use-quick-add-data";

/** In-progress draft, kept for the tab's lifetime so a reload or iOS eviction doesn't lose it. */
const DRAFT_KEY = "ledger:quick-add-draft";
const DRAFT_TTL_MS = 30 * 60_000;

type InputStep = (typeof INPUT_STEPS)[number];
const isInputStep = (step: QuickAddStep): step is InputStep => (INPUT_STEPS as readonly string[]).includes(step);

function restoreDraft(): { draft: QuickAddDraft; step: InputStep; returnToConfirm: boolean } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
    if (!saved || Date.now() - saved.at > DRAFT_TTL_MS || !isInputStep(saved.step)) return null;
    return { draft: saved.draft, step: saved.step, returnToConfirm: saved.returnToConfirm === true };
  } catch {
    return null;
  }
}

function persistDraft(state: QuickAddState) {
  try {
    const { draft, step, returnToConfirm } = state;
    const empty = !draft.amount && !draft.categoryId && !draft.note && !draft.paymentMethod;
    // Never persisted once saving starts: a reload mid-save must not offer to save again.
    if (!isInputStep(step) || empty) sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step, returnToConfirm, at: Date.now() }));
  } catch {
    // Storage unavailable — the in-memory state still survives re-renders.
  }
}

function newSubmissionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * Waits for custom categories only when a deep link names a category (it may be a custom
 * one); otherwise Quick Add renders immediately with the built-in categories.
 */
export function QuickAddScreen() {
  const params = useSearchParams();
  const { status } = useCategories();
  if (params.has("category") && status === "loading") return null;
  return <QuickAddFlow params={params} />;
}

function QuickAddFlow({ params }: { params: URLSearchParams }) {
  const router = useRouter();
  const { user, currency } = useSession();
  const { categories, getCategory } = useCategories();
  const [prefs] = useLocalPreference<QuickAddPreferences>(QUICK_ADD_PREFS_KEY, DEFAULT_QUICK_ADD_PREFS);
  const data = useQuickAddData();
  const keyboard = useKeyboardInset(true);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [launcher] = useState<QuickExpenseLauncher>(getQuickExpenseLauncher);
  const [usage, setUsage] = useState(readExpenseUsage);

  const digits = fractionDigits(currency);
  const config = useMemo<QuickAddConfig>(
    () => ({ digits, askNote: prefs.askNote, oneTapSave: prefs.oneTapSave }),
    [digits, prefs.askNote, prefs.oneTapSave],
  );
  const reducer = useMemo(() => quickAddReducer(config), [config]);
  const [fromLink] = useState(() => hasLinkParams(params));
  const [state, dispatch] = useReducer(reducer, null, () => {
    // A deep link (e.g. an iOS Shortcut) wins over a leftover draft.
    if (fromLink) return initialQuickAddState(config, draftFromSearchParams(params, { categories, digits }));
    const restored = restoreDraft();
    if (!restored) return initialQuickAddState(config);
    return { ...initialQuickAddState(config, restored.draft), step: restored.step, returnToConfirm: restored.returnToConfirm };
  });

  const format = (minor: number) => formatMoney(minor, currency);
  const minor = amountMinor(state.draft, digits);
  const amountLabel = format(minor ?? 0);
  const category = state.draft.categoryId ? getCategory(state.draft.categoryId) : null;

  // This visit counts as the app's launch, so "open into Quick Add" won't bounce us back here.
  // A consumed deep link is dropped from the URL so a reload resumes the persisted draft
  // instead of re-applying the link.
  useEffect(() => {
    consumeLaunch();
    if (fromLink) router.replace(QUICK_ADD_PATH, { scroll: false });
  }, [fromLink, router]);

  useEffect(() => persistDraft(state), [state]);

  // Focus follows the step: the field to type into, else the step heading for VoiceOver.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current && state.step === "AMOUNT") {
      firstRender.current = false;
      return; // autoFocus already handled it
    }
    firstRender.current = false;
    const target =
      state.step === "AMOUNT"
        ? document.getElementById("amount")
        : state.step === "NOTE"
          ? document.querySelector<HTMLInputElement>("[aria-label='Note (optional)']")
          : document.getElementById("step-title");
    target?.focus({ preventScroll: true });
  }, [state.step]);

  // ── Side effects driven by the state machine ──────────────────────────────────────────

  const save = useEffectEvent(async (submissionId: string, draft: QuickAddDraft) => {
    const amount = amountMinor(draft, digits);
    if (amount === null || !draft.categoryId || !draft.paymentMethod) {
      dispatch({ type: "SAVE_FAILED", submissionId, error: "Something's missing — check the details and try again." });
      return;
    }
    try {
      const accounts = await data.accountsForSave();
      const input = {
        amount,
        categoryId: draft.categoryId,
        paymentMethod: draft.paymentMethod,
        note: draft.note.trim(),
        occurredAt: new Date(),
        accountId: defaultAccountFor(draft.paymentMethod, accounts) || null,
      };
      // Same service (and ledger/balance/stats logic) as the Add sheet.
      const { id, committed } = createExpense(user.uid, input, {
        accountExists: (accountId) => accounts.some((a) => a.id === accountId),
      });
      rememberExpenseChoices(input);
      const result = await settleQuickly(committed);
      if (result === "pending") {
        committed.catch((error) => toast.error("An expense couldn't be synced", { description: getErrorMessage(error) }));
      }
      dispatch({
        type: "SAVE_SUCCEEDED",
        submissionId,
        saved: { id, ...input, pending: result === "pending" },
      });
    } catch (error) {
      launcher.feedback("warning");
      dispatch({ type: "SAVE_FAILED", submissionId, error: getErrorMessage(error, "Couldn't save the expense. Please try again.") });
    }
  });

  // Each submission id is written at most once, even if React re-runs the effect.
  const started = useRef(new Set<string>());
  useEffect(() => {
    if (state.step !== "SAVING" || !state.submissionId || started.current.has(state.submissionId)) return;
    started.current.add(state.submissionId);
    void save(state.submissionId, state.draft);
  }, [state.step, state.submissionId, state.draft]);

  const loadBudget = useEffectEvent(async () => {
    const saved = state.saved;
    if (!saved) return;
    try {
      const budget = await calculateCategoryBudgetStatus(user.uid, saved, saved);
      dispatch({ type: "BUDGET_LOADED", expenseId: saved.id, outcome: { status: "ready", budget, fromCache: budget.source === "cache" } });
      const progress = budget.progress;
      launcher.feedback(progress?.state === "over" ? "warning" : "success");
      launcher.expenseSaved({
        version: 1,
        expenseId: saved.id,
        amount: saved.amount,
        currency,
        amountLabel: format(saved.amount),
        categoryId: saved.categoryId,
        categoryName: getCategory(saved.categoryId).name,
        paymentMethod: saved.paymentMethod,
        budget: progress
          ? { limit: progress.limit, spent: progress.spent, remaining: progress.remaining, percent: progress.percent, month: budget.month }
          : null,
        pending: saved.pending,
      });
    } catch {
      launcher.feedback("success");
      dispatch({ type: "BUDGET_LOADED", expenseId: saved.id, outcome: { status: "error" } });
    }
  });

  useEffect(() => {
    if (state.step === "SAVED") void loadBudget();
  }, [state.step]);

  // ── Navigation ────────────────────────────────────────────────────────────────────────

  const leave = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (!launcher.finish()) router.replace("/dashboard");
  };

  const addAnother = () => {
    setUsage(readExpenseUsage());
    dispatch({ type: "RESET" });
  };

  const steps = visibleSteps(config);
  const stepIndex = isInputStep(state.step) ? steps.indexOf(state.step) : steps.length - 1;
  const canGoBack = isInputStep(state.step) && (state.returnToConfirm || previousStep(state.step, config) !== null);
  const busy = state.step === "SAVING";
  const finished = state.step === "SAVED" || state.step === "BUDGET_RESULT";
  // Saving keeps the confirm screen; SAVED → BUDGET_RESULT stays one screen.
  const screenKey = busy ? "CONFIRM" : finished ? "RESULT" : state.step;

  return (
    <main
      id="main"
      className="fixed inset-x-0 bottom-0 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]"
      style={keyboard ? { bottom: keyboard.bottom, height: keyboard.height } : undefined}
    >
      <header className="flex h-14 shrink-0 short:h-11 items-center justify-between px-[max(0.5rem,env(safe-area-inset-left))]">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "BACK" })}
            className="flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Back"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        ) : (
          <span className="size-11" aria-hidden />
        )}
        {finished ? (
          <span />
        ) : (
          <ol className="flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <li
                key={s}
                aria-hidden
                className={cn("h-1.5 rounded-full transition-all duration-300", i === stepIndex ? "w-5 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted")}
              />
            ))}
          </ol>
        )}
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
          aria-label={finished ? "Close" : "Cancel"}
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {state.step !== "AMOUNT" && !finished && minor !== null ? (
        <p className="shrink-0 pb-2 text-center text-sm font-medium tabular-nums text-muted-foreground short:hidden" aria-hidden={state.step === "CONFIRM" || busy}>
          {state.step === "CONFIRM" || busy ? "" : `${amountLabel}${category && state.step !== "CATEGORY" ? ` · ${category.name}` : ""}`}
        </p>
      ) : null}

      <div
        key={screenKey}
        className={cn(
          "flex min-h-0 flex-1 flex-col animate-in fade-in duration-200",
          state.direction === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6",
        )}
      >
        {state.step === "AMOUNT" ? (
          <AmountStep
            value={state.draft.amount}
            symbol={currencySymbol(currency)}
            error={state.error}
            onChange={(raw) => dispatch({ type: "SET_AMOUNT", value: sanitizeAmountInput(raw, digits) })}
            onSubmit={() => dispatch({ type: "SUBMIT_AMOUNT" })}
          />
        ) : state.step === "CATEGORY" ? (
          <CategoryStep
            categories={categories}
            usage={usage}
            selectedId={state.draft.categoryId}
            remainingByCategory={data.remainingByCategory}
            formatAmount={format}
            onPick={(categoryId) => {
              launcher.feedback("tap");
              dispatch({ type: "PICK_CATEGORY", categoryId });
            }}
          />
        ) : state.step === "NOTE" && category ? (
          <NoteStep
            value={state.draft.note}
            category={category}
            onChange={(value) => dispatch({ type: "SET_NOTE", value })}
            onSubmit={() => dispatch({ type: "SUBMIT_NOTE" })}
            onSkip={() => dispatch({ type: "SKIP_NOTE" })}
          />
        ) : state.step === "PAYMENT" ? (
          <PaymentStep
            usage={usage}
            selected={state.draft.paymentMethod}
            oneTapSave={config.oneTapSave}
            onPick={(method) => {
              launcher.feedback("tap");
              dispatch({ type: "PICK_METHOD", method, submissionId: newSubmissionId() });
            }}
          />
        ) : (state.step === "CONFIRM" || busy) && category ? (
          <ConfirmStep
            draft={state.draft}
            amountLabel={amountLabel}
            category={category}
            askNote={config.askNote}
            saving={busy}
            error={state.error}
            offline={!online}
            onEdit={(step) => dispatch({ type: "EDIT", step })}
            onSave={() => dispatch({ type: "SAVE", submissionId: newSubmissionId() })}
          />
        ) : finished && state.saved ? (
          <ResultStep
            saved={state.saved}
            amountLabel={format(state.saved.amount)}
            category={getCategory(state.saved.categoryId)}
            budget={state.budget}
            formatAmount={format}
            onAddAnother={addAnother}
            onDone={leave}
          />
        ) : null}
      </div>
    </main>
  );
}
