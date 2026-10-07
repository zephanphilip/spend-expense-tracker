import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/invalid-login-credentials": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "No account found with that email.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "You appear to be offline. Check your connection.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/account-exists-with-different-credential":
    "This email is already linked to a different sign-in method.",
  "auth/unauthorized-domain":
    "This domain isn't authorised for sign-in. Add it in Firebase Auth settings.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled for the project.",
  "permission-denied": "You don't have permission to do that.",
  unavailable: "Can't reach the server right now. Your changes will sync when you're back online.",
  "failed-precondition": "A database index is still being built. Try again in a minute.",
  "resource-exhausted": "Usage limit reached. Try again later.",
};

/** Error codes that represent a deliberate user cancellation rather than a failure. */
const CANCELLATION_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function isCancellation(error: unknown): boolean {
  return error instanceof FirebaseError && CANCELLATION_CODES.has(error.code);
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
