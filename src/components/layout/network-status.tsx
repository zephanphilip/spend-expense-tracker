"use client";

import { CloudOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Real connectivity check: `navigator.onLine` only reflects the network interface (and can
 * report "online" on captive portals or flaky Wi-Fi), so confirm with a tiny uncached
 * request. /sw.js is never cached by the service worker or the browser.
 */
async function probe(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`/sw.js?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

/** Thin offline banner (changes keep working via Firestore's local cache) + "back online" toast. */
export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Quick retries right after a change (the network often needs a moment after the
    // "online" event), then a slow poll while still offline.
    const RETRY_MS = [2_000, 5_000];
    const check = async (attempt = 0) => {
      if (timer) clearTimeout(timer);
      const ok = await probe();
      if (cancelled) return;
      setOnline(ok);
      if (!ok) timer = setTimeout(() => void check(attempt + 1), RETRY_MS[attempt] ?? 30_000);
    };
    const onOnline = () => void check(0);
    const goOffline = () => setOnline(false);
    void check(RETRY_MS.length); // initial load: no fast retries needed
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online", { description: "Your offline changes are syncing." });
    }
  }, [online]);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 text-xs font-medium text-background"
    >
      <CloudOff className="size-3.5" aria-hidden />
      Offline — changes are saved on this device and will sync
    </div>
  );
}
