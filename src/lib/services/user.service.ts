import type { User } from "firebase/auth";
import { onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

import { DEFAULT_CURRENCY } from "@/lib/constants/currencies";
import { getDb } from "@/lib/firebase/client";
import type { UserProfile, UserProfileUpdate } from "@/types";

import { userProfileConverter } from "./converters";
import { userDoc } from "./paths";

/**
 * Creates the profile document on first sign-in. Safe to call concurrently: the
 * transaction re-reads, so only one create wins and later callers just patch the name.
 */
export async function ensureUserProfile(
  user: Pick<User, "uid" | "email" | "displayName" | "photoURL">,
  overrides: { displayName?: string } = {},
): Promise<void> {
  const ref = userDoc(user.uid);
  await runTransaction(getDb(), async (tx) => {
    const snapshot = await tx.get(ref);
    const displayName = overrides.displayName ?? user.displayName ?? null;
    if (!snapshot.exists()) {
      tx.set(ref, {
        email: user.email ?? null,
        displayName,
        photoURL: user.photoURL ?? null,
        currency: DEFAULT_CURRENCY,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (overrides.displayName && snapshot.get("displayName") !== overrides.displayName) {
      tx.update(ref, { displayName: overrides.displayName, updatedAt: serverTimestamp() });
    }
  });
}

export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    userDoc(uid).withConverter(userProfileConverter),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    onError,
  );
}

export async function updateUserProfile(uid: string, update: UserProfileUpdate): Promise<void> {
  await updateDoc(userDoc(uid), { ...update, updatedAt: serverTimestamp() });
}
