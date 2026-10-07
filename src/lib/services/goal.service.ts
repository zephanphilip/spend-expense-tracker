import {
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import { goalInputSchema } from "@/lib/validation/finance";
import type { Goal, GoalContribution, GoalInput } from "@/types";

import { deleteParentThenChildren } from "./batch-delete";
import { goalContributionConverter, goalConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { contributionDoc, contributionsCol, goalDoc, goalsCol } from "./paths";

type Unsubscribe = () => void;

export function subscribeGoals(
  uid: string,
  onData: (goals: Goal[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(goalsCol(uid), orderBy("createdAt", "asc")).withConverter(goalConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

export function subscribeContributions(
  uid: string,
  goalId: string,
  onData: (items: GoalContribution[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(contributionsCol(uid, goalId), orderBy("contributedAt", "desc")).withConverter(
    goalContributionConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

function goalFields(input: GoalInput) {
  const v = goalInputSchema.parse(input);
  return {
    name: v.name,
    icon: v.icon,
    color: v.color,
    targetAmount: v.targetAmount,
    targetDate: v.targetDate ? Timestamp.fromDate(v.targetDate) : null,
  };
}

/** Creates a goal; an opening balance is recorded as its first contribution in the same batch. */
export function createGoal(uid: string, input: GoalInput, initialSaved = 0): PendingWrite {
  const batch = writeBatch(getDb());
  const ref = doc(goalsCol(uid));
  const contribution = initialSaved > 0 ? doc(contributionsCol(uid, ref.id)) : null;
  batch.set(ref, {
    ...goalFields(input),
    savedAmount: initialSaved,
    status: "active",
    lastOpId: contribution?.id ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (contribution) {
    batch.set(contribution, {
      amount: initialSaved,
      note: "Opening balance",
      contributedAt: Timestamp.now(),
      createdAt: serverTimestamp(),
    });
  }
  return { id: ref.id, committed: batch.commit() };
}

export function updateGoal(uid: string, id: string, input: GoalInput): Promise<void> {
  return updateDoc(goalDoc(uid, id), { ...goalFields(input), updatedAt: serverTimestamp() });
}

export function setGoalArchived(uid: string, id: string, archived: boolean): Promise<void> {
  return updateDoc(goalDoc(uid, id), {
    status: archived ? "archived" : "active",
    updatedAt: serverTimestamp(),
  });
}

export class InsufficientSavingsError extends Error {
  constructor() {
    super("You can't withdraw more than you've saved.");
    this.name = "InsufficientSavingsError";
  }
}

/**
 * Adds a contribution (negative = withdrawal) and updates the goal's balance atomically.
 * `lastOpId` lets Security Rules verify the balance changed together with a contribution.
 */
export async function addContribution(
  uid: string,
  goalId: string,
  { amount, note, contributedAt }: { amount: number; note: string; contributedAt: Date },
): Promise<string> {
  if (!Number.isSafeInteger(amount) || amount === 0) throw new Error("Invalid amount");
  const goalRef = goalDoc(uid, goalId).withConverter(goalConverter);
  const ref = doc(contributionsCol(uid, goalId));
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalRef);
    if (!snap.exists()) throw new Error("Goal not found");
    const savedAmount = snap.data().savedAmount + amount;
    if (savedAmount < 0) throw new InsufficientSavingsError();
    tx.set(ref, {
      amount,
      note: note.trim().slice(0, NOTE_MAX_LENGTH),
      contributedAt: Timestamp.fromDate(contributedAt),
      createdAt: serverTimestamp(),
    });
    tx.update(goalDoc(uid, goalId), { savedAmount, lastOpId: ref.id, updatedAt: serverTimestamp() });
  });
  return ref.id;
}

/** Removes a contribution and reverses its effect on the balance atomically. */
export async function deleteContribution(uid: string, goalId: string, contribution: GoalContribution): Promise<void> {
  const goalRef = goalDoc(uid, goalId).withConverter(goalConverter);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalRef);
    if (!snap.exists()) throw new Error("Goal not found");
    const savedAmount = snap.data().savedAmount - contribution.amount;
    if (savedAmount < 0) throw new InsufficientSavingsError();
    tx.delete(contributionDoc(uid, goalId, contribution.id));
    tx.update(goalDoc(uid, goalId), {
      savedAmount,
      lastOpId: contribution.id,
      updatedAt: serverTimestamp(),
    });
  });
}

/** Deletes a goal and its contribution history. */
export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  const contributions = await getDocs(contributionsCol(uid, goalId));
  await deleteParentThenChildren(goalDoc(uid, goalId), contributions.docs.map((c) => c.ref));
}
