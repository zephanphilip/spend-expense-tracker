import {
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { categorySchema } from "@/lib/validation/category";
import type { Category, CategoryInput } from "@/types";

import { categoryConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { categoriesCol, categoryDoc } from "./paths";

export function subscribeToCustomCategories(
  uid: string,
  onData: (categories: Category[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(categoriesCol(uid), orderBy("createdAt", "asc")).withConverter(
    categoryConverter,
  );
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((d) => d.data())), onError);
}

/** Client-generated id so a new category can be selected immediately, even offline. */
export function createCategory(uid: string, input: CategoryInput): PendingWrite {
  const valid = categorySchema.parse(input);
  const ref = doc(categoriesCol(uid));
  const committed = setDoc(ref, {
    ...valid,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, committed };
}

export async function updateCategory(uid: string, id: string, input: CategoryInput): Promise<void> {
  const valid = categorySchema.parse(input);
  await updateDoc(categoryDoc(uid, id), { ...valid, updatedAt: serverTimestamp() });
}

/**
 * Categories are archived rather than deleted so past expenses keep their label and icon.
 */
export async function setCategoryArchived(uid: string, id: string, archived: boolean): Promise<void> {
  await updateDoc(categoryDoc(uid, id), { archived, updatedAt: serverTimestamp() });
}
