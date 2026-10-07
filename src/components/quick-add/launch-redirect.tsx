"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { QUICK_ADD_PATH } from "@/lib/quick-add/deep-link";
import {
  consumeLaunch,
  DEFAULT_QUICK_ADD_PREFS,
  isStandalone,
  QUICK_ADD_PREFS_KEY,
  type QuickAddPreferences,
  RESUME_AFTER_MS,
} from "@/lib/quick-add/preferences";

function launchOnOpenEnabled(): boolean {
  try {
    const prefs: QuickAddPreferences = { ...DEFAULT_QUICK_ADD_PREFS, ...JSON.parse(localStorage.getItem(QUICK_ADD_PREFS_KEY) ?? "{}") };
    return prefs.launchOnOpen;
  } catch {
    return false; // unreadable preference → default (off)
  }
}

/** Something the user is in the middle of: an open sheet/dialog or a focused field. */
function busy(): boolean {
  const active = document.activeElement;
  return (
    document.querySelector("[role='dialog'], [role='alertdialog']") !== null ||
    (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']"))
  );
}

/**
 * With "Open the app into Quick Add" on, the installed app lands on Quick Add instead of the
 * dashboard — the PWA stand-in for an app-icon shortcut, which iOS doesn't give web apps.
 *
 *  - Cold launch (Home Screen icon, or a Shortcut's `webapp://<host>`, which ignores the path
 *    and opens the start URL): redirect once per launch from the dashboard.
 *  - Resume (the app was still in memory, so iOS just brings it back): redirect when it was
 *    away for at least RESUME_AFTER_MS, unless the user was in the middle of something.
 */
export function QuickAddLaunchRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (consumeLaunch() && pathname === "/dashboard" && isStandalone() && launchOnOpenEnabled()) {
      router.replace(QUICK_ADD_PATH);
    }

    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < RESUME_AFTER_MS || !isStandalone() || !launchOnOpenEnabled()) return;
      if (pathRef.current === QUICK_ADD_PATH || busy()) return;
      router.push(QUICK_ADD_PATH);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // The cold-launch check concerns only the first screen; the listener lives for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
