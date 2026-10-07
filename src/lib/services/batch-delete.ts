import { type DocumentReference, writeBatch } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";

const CHUNK = 450;

/**
 * Deletes `parent` first, then `children` in chunks below Firestore's 500-write limit.
 * Parent-first matters: Security Rules only allow deleting ledger children (payments,
 * contributions) once their parent no longer exists.
 */
export async function deleteParentThenChildren(
  parent: DocumentReference,
  children: DocumentReference[],
): Promise<void> {
  const first = writeBatch(getDb());
  first.delete(parent);
  await first.commit();
  for (let i = 0; i < children.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    children.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}
