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

/**
 * Coming back to the app after this long counts as opening it again (e.g. a Back Tap
 * shortcut's `webapp://` link bringing it to the front). Shorter switches are ignored.
 */
export const RESUME_AFTER_MS = 3_000;

/** Set once this page load has decided where to land (module state: resets on reload). */
let launchHandled = false;

/**
 * True exactly once per page load, so "open into Quick Add" applies to launches — including
 * iOS reloading the app's start page for a `webapp://` link while the app is still in memory
 * (sessionStorage survives that, so it can't be used here) — but not to later in-app
 * navigation back to the dashboard (e.g. "Done" in Quick Add).
 */
export function consumeLaunch(): boolean {
  if (launchHandled) return false;
  launchHandled = true;
  return true;
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
