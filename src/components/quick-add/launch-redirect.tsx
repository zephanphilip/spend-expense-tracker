"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { QUICK_ADD_PATH } from "@/lib/quick-add/deep-link";
import {
  consumeLaunch,
  DEFAULT_QUICK_ADD_PREFS,
  isStandalone,
  QUICK_ADD_PREFS_KEY,
  type QuickAddPreferences,
} from "@/lib/quick-add/preferences";

/**
 * With "Open the app into Quick Add" on, launching the installed app lands on Quick Add
 * instead of the dashboard. This is the PWA stand-in for an app-icon shortcut, which iOS
 * doesn't offer to web apps; it also catches `webapp://` launches, which ignore the path.
 */
export function QuickAddLaunchRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!consumeLaunch() || pathname !== "/dashboard" || !isStandalone()) return;
    let prefs: QuickAddPreferences = DEFAULT_QUICK_ADD_PREFS;
    try {
      prefs = { ...prefs, ...JSON.parse(localStorage.getItem(QUICK_ADD_PREFS_KEY) ?? "{}") };
    } catch {
      // Unreadable preference → default (off).
    }
    if (prefs.launchOnOpen) router.replace(QUICK_ADD_PATH);
    // Only the first screen of a launch matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
