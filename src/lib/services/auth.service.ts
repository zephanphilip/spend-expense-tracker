import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { getFirebaseAuth, resetFirestore } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/services/user.service";
import type { SignUpValues } from "@/lib/validation/auth";

export type AuthUser = User;

export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

/** Surfaces errors from a redirect-based Google sign-in that completed on page load. */
export async function completeRedirectSignIn(): Promise<void> {
  await getRedirectResult(getFirebaseAuth());
}

const POPUP_UNAVAILABLE = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    // Some in-app browsers and installed PWAs block popups; fall back to a full redirect.
    if (error instanceof FirebaseError && POPUP_UNAVAILABLE.has(error.code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signUpWithEmail({ displayName, email, password }: SignUpValues): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(user, { displayName });
  // The auth listener may already be creating the profile; this call is idempotent and
  // fills in the name if that write won the race.
  await ensureUserProfile(user, { displayName });
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  await resetFirestore();
}
