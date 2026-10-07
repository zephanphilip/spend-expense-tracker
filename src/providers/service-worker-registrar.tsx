"use client";

import { useEffect } from "react";

/** Registers the PWA service worker in production builds only (avoids stale dev assets). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.warn("Service worker registration failed", error));
  }, []);
  return null;
}
