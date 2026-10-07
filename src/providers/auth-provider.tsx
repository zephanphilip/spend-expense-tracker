"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { toast } from "sonner";

import { DEFAULT_CURRENCY } from "@/lib/constants/currencies";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  type AuthUser,
  completeRedirectSignIn,
  subscribeToAuth,
} from "@/lib/services/auth.service";
import { getErrorMessage, isCancellation } from "@/lib/services/errors";
import { ensureUserProfile, subscribeToUserProfile } from "@/lib/services/user.service";
import type { CurrencyCode, UserProfile } from "@/types";

export type AuthState =
  | { status: "unconfigured"; user: null; profile: null }
  | { status: "loading"; user: null; profile: null }
  | { status: "unauthenticated"; user: null; profile: null }
  | { status: "authenticated"; user: AuthUser; profile: UserProfile | null };

const AuthContext = createContext<AuthState | null>(null);

const INITIAL_STATE: AuthState = isFirebaseConfigured
  ? { status: "loading", user: null, profile: null }
  : { status: "unconfigured", user: null, profile: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    completeRedirectSignIn().catch((error) => {
      if (!isCancellation(error)) toast.error(getErrorMessage(error));
    });

    let unsubscribeProfile: (() => void) | undefined;
    const unsubscribeAuth = subscribeToAuth((user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      if (!user) {
        setState({ status: "unauthenticated", user: null, profile: null });
        return;
      }

      setState({ status: "authenticated", user, profile: null });
      // Creating the profile is best-effort: the app works with defaults until it exists.
      ensureUserProfile(user).catch((error) => console.warn("Profile setup deferred", error));
      unsubscribeProfile = subscribeToUserProfile(
        user.uid,
        (profile) => setState({ status: "authenticated", user, profile }),
        (error) => console.warn("Profile subscription failed", error),
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** For components rendered under <AuthGuard>, where a user is guaranteed. */
export function useSession(): { user: AuthUser; profile: UserProfile | null; currency: CurrencyCode } {
  const state = useAuth();
  if (state.status !== "authenticated") {
    throw new Error("useSession must be used inside <AuthGuard>");
  }
  return {
    user: state.user,
    profile: state.profile,
    currency: state.profile?.currency ?? DEFAULT_CURRENCY,
  };
}
