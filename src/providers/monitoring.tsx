"use client";

import { useEffect } from "react";

import { isFirebaseConfigured, performanceMonitoring, useFirebaseEmulators } from "@/lib/firebase/config";

/**
 * Firebase Performance Monitoring, loaded lazily (its SDK stays out of the main bundle) in
 * production when enabled. Automatically traces page loads and Firestore/network requests.
 */
export function Monitoring() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !performanceMonitoring || !isFirebaseConfigured || useFirebaseEmulators) return;
    void Promise.all([import("firebase/performance"), import("@/lib/firebase/client")]).then(([perf, client]) => {
      perf.getPerformance(client.getFirebaseApp());
    });
  }, []);
  return null;
}
