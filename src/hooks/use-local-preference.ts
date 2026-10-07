"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "ledger:preference";

/**
 * Per-device preference persisted in localStorage, shared live across components (and
 * tabs, via the storage event). Falls back to the default when storage is unavailable.
 */
export function useLocalPreference<T>(key: string, fallback: T): [T, (value: T) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const handler = (e: Event) => {
      if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent).detail === key) onChange();
    };
    window.addEventListener("storage", handler);
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(EVENT, handler);
    };
  }, [key]);
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  let value = fallback;
  if (raw !== null) {
    try {
      value = { ...(typeof fallback === "object" && fallback !== null ? fallback : {}), ...JSON.parse(raw) } as T;
      if (typeof fallback !== "object" || fallback === null) value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode) — the setting just won't persist.
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );
  return [value, set];
}
