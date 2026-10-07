"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuth } from "@/providers/auth-provider";

import { SetupNotice } from "./setup-notice";
import { SplashScreen } from "./splash-screen";

/**
 * Client-side route protection. Data access is independently enforced by Firestore
 * Security Rules, so this guard is about UX, not security.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      // Keep the query too, so e.g. a Quick Add deep link survives signing in.
      router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
    }
  }, [status, router, pathname]);

  if (status === "unconfigured") return <SetupNotice />;
  if (status !== "authenticated") return <SplashScreen />;
  return children;
}
