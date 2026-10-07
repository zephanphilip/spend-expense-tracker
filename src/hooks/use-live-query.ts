"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

export type LiveResult<T> =
  | { status: "loading"; data: undefined; error: null }
  | { status: "error"; data: undefined; error: Error }
  | { status: "success"; data: T; error: null };

type Subscribe<T> = (onData: (data: T) => void, onError: (error: Error) => void) => () => void;

const LOADING = { status: "loading", data: undefined, error: null } as const;

/**
 * Subscribes to a live Firestore query identified by `key` (re-subscribes when it changes).
 * Pass `null` as the key to stay idle. `retry()` re-subscribes after a terminal error.
 */
export function useLiveQuery<T>(key: string | null, subscribe: Subscribe<T>): LiveResult<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const fullKey = key === null ? null : `${key}#${attempt}`;
  const [snapshot, setSnapshot] = useState<{ key: string; result: LiveResult<T> } | null>(null);

  const start = useEffectEvent((activeKey: string) =>
    subscribe(
      (data) => setSnapshot({ key: activeKey, result: { status: "success", data, error: null } }),
      (error) => setSnapshot({ key: activeKey, result: { status: "error", data: undefined, error } }),
    ),
  );

  useEffect(() => {
    if (fullKey === null) return;
    return start(fullKey);
  }, [fullKey]);

  const result = snapshot && snapshot.key === fullKey ? snapshot.result : LOADING;
  return { ...result, retry } as LiveResult<T> & { retry: () => void };
}
