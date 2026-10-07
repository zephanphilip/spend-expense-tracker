/**
 * Waits briefly for a Firestore write to be acknowledged. On a slow or offline
 * connection we don't block the UI: the local cache already reflects the change and
 * Firestore will sync it later. Rejections that arrive within the window propagate.
 */
export async function settleQuickly(
  committed: Promise<void>,
  timeoutMs = 2500,
): Promise<"committed" | "pending"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"pending">((resolve) => {
    timer = setTimeout(() => resolve("pending"), timeoutMs);
  });
  try {
    return await Promise.race([committed.then(() => "committed" as const), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
