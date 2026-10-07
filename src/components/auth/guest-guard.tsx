"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuth } from "@/providers/auth-provider";

import { SetupNotice } from "./setup-notice";
import { SplashScreen } from "./splash-screen";

/** Only allow same-origin relative paths, to prevent open redirects via ?next=. */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/dashboard";
}

/** Wraps sign-in/sign-up pages: signed-in users are sent on to the app. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  if (status === "unconfigured") return <SetupNotice />;
  if (status !== "unauthenticated") return <SplashScreen />;
  return children;
}
