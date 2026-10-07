/** Per-device Quick Add settings (Settings → Quick Add). */
export interface QuickAddPreferences {
  /** Show the optional note step. */
  askNote: boolean;
  /** Save as soon as a payment method is picked (no confirm screen). */
  oneTapSave: boolean;
  /**
   * Opening the installed app (Home Screen icon, or a Shortcut's `webapp://` link) goes
   * straight to Quick Add — on a cold launch, and when it returns after RESUME_AFTER_MS.
   */
  launchOnOpen: boolean;
}

export const QUICK_ADD_PREFS_KEY = "ledger:quick-add";

export const DEFAULT_QUICK_ADD_PREFS: QuickAddPreferences = {
  askNote: true,
  oneTapSave: false,
  launchOnOpen: false,
};

/** Coming back to the app after this long counts as opening it again. */
export const RESUME_AFTER_MS = 30_000;

const SESSION_FLAG = "ledger:launched";

/**
 * True exactly once per app launch (sessionStorage starts empty in a freshly opened app or
 * tab), so "open into Quick Add" applies to launches, not to every visit to the dashboard.
 */
export function consumeLaunch(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_FLAG)) return false;
    sessionStorage.setItem(SESSION_FLAG, "1");
    return true;
  } catch {
    return false;
  }
}

/** Installed to the Home Screen and running standalone (iOS sets navigator.standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Opens the installed Home Screen web app (iOS 16.4+; undocumented, ignores any path). */
export function homeScreenAppUrl(origin: string): string {
  return `webapp://${new URL(origin).host}`;
}
