/**
 * QuickExpenseLauncher — the boundary between the Quick Add flow and whatever hosts it.
 *
 *   QuickExpenseLauncher
 *     ├── PwaQuickExpenseLauncher      (default; plain browser APIs, always available)
 *     └── NativeBridgeLauncher         (only inside a future native iOS wrapper)
 *
 * The PWA never depends on native code. A future native companion (Swift/WKWebView) would
 * load the same `/quick-add` URL and register a `ledgerQuickExpense` script-message handler;
 * only then is the bridge used, e.g. to start a Live Activity in the Dynamic Island after a
 * save. Expenses, budgets and auth stay in the shared web code and Firestore either way.
 * See docs/ios-quick-add.md for what is (and isn't) possible on iOS.
 */
import { haptic } from "@/lib/haptics";

/** What a host may show after a save (e.g. a native Live Activity). Versioned contract. */
export interface QuickExpenseSummary {
  version: 1;
  expenseId: string;
  /** Minor units. */
  amount: number;
  currency: string;
  /** Pre-formatted, e.g. "₹500". */
  amountLabel: string;
  categoryId: string;
  categoryName: string;
  paymentMethod: string;
  /** null = the category has no budget. Negative remaining = over budget. */
  budget: { limit: number; spent: number; remaining: number; percent: number; month: string } | null;
  /** true while only saved on this device. */
  pending: boolean;
}

export interface QuickExpenseLauncher {
  readonly platform: "pwa" | "native-ios";
  /** True only when a native host can show Live Activities / Dynamic Island content. */
  readonly supportsLiveActivities: boolean;
  /** Informs the host that an expense was saved (and its budget computed). */
  expenseSaved(summary: QuickExpenseSummary): void;
  feedback(kind: "tap" | "success" | "warning"): void;
  /**
   * The user is done. Returns true if the host handled it (a native sheet closed itself);
   * false means the web app should navigate on its own.
   */
  finish(): boolean;
}

const pwaLauncher: QuickExpenseLauncher = {
  platform: "pwa",
  supportsLiveActivities: false,
  expenseSaved() {
    // Browsers expose no Live Activity / Dynamic Island API; the in-page result screen is it.
  },
  feedback: haptic,
  finish: () => false,
};

interface WebkitMessageHandler {
  postMessage(message: unknown): void;
}

/** Name of the WKScriptMessageHandler a native wrapper would register. */
export const NATIVE_HANDLER = "ledgerQuickExpense";

function nativeHandler(): WebkitMessageHandler | null {
  if (typeof window === "undefined") return null;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, WebkitMessageHandler | undefined> } })
    .webkit?.messageHandlers;
  return handlers?.[NATIVE_HANDLER] ?? null;
}

function nativeLauncher(handler: WebkitMessageHandler): QuickExpenseLauncher {
  const post = (message: Record<string, unknown>) => {
    try {
      handler.postMessage(message);
    } catch {
      // A broken bridge must never break expense entry.
    }
  };
  return {
    platform: "native-ios",
    supportsLiveActivities: true,
    expenseSaved: (summary) => post({ type: "expense.saved", summary }),
    feedback: (kind) => post({ type: "feedback", kind }),
    finish: () => {
      post({ type: "quickAdd.finish" });
      return true;
    },
  };
}

/** The native bridge when a wrapper registered one, otherwise the PWA implementation. */
export function getQuickExpenseLauncher(): QuickExpenseLauncher {
  const handler = nativeHandler();
  return handler ? nativeLauncher(handler) : pwaLauncher;
}
