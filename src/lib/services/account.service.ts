import { deleteDoc, doc, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { accountInputSchema } from "@/lib/validation/accounts";
import type { Account, AccountInput } from "@/types";

import { accountConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { accountDoc, accountsCol } from "./paths";

export function subscribeAccounts(
  uid: string,
  onData: (accounts: Account[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(accountsCol(uid), orderBy("createdAt", "asc")).withConverter(accountConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

/**
 * `-0` (e.g. "owe nothing" on a card → −0) is stored by Firestore as a double, which the
 * rules reject as a non-integer balance. Normalise it to 0 everywhere we write balances.
 */
const noNegativeZero = (n: number) => (n === 0 ? 0 : n);

function fields(input: AccountInput) {
  const v = accountInputSchema.parse({ ...input, openingBalance: noNegativeZero(input.openingBalance) });
  const isCard = v.type === "credit_card";
  return {
    name: v.name,
    type: v.type,
    institution: v.institution || null,
    openingBalance: v.openingBalance,
    active: v.active,
    creditLimit: isCard ? v.creditLimit : null,
    statementDay: isCard ? v.statementDay : null,
    dueDay: isCard ? v.dueDay : null,
  };
}

/** New account; its balance starts at the opening balance. */
export function createAccount(uid: string, input: AccountInput): PendingWrite {
  const ref = doc(accountsCol(uid));
  const f = fields(input);
  const committed = setDoc(ref, {
    ...f,
    balance: f.openingBalance,
    statementBalance: null,
    minimumDue: null,
    lastOpId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, committed };
}

/**
 * Edits an account. Changing the opening balance shifts the current balance by the same
 * amount (a reconciliation), so the ledger-derived part — balance minus opening — never
 * changes outside a transaction. The account type is fixed after creation.
 */
export function updateAccount(uid: string, before: Account, input: AccountInput): Promise<void> {
  const f = fields({ ...input, type: before.type });
  const shift = noNegativeZero(f.openingBalance - before.openingBalance);
  return updateDoc(accountDoc(uid, before.id), {
    ...f,
    ...(shift !== 0 ? { balance: increment(shift) } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Sets the current balance to `target` by adjusting the opening balance (for when the
 * real bank balance drifted from what was tracked, e.g. untracked fees).
 */
export function reconcileBalance(uid: string, account: Account, target: number): Promise<void> {
  const shift = noNegativeZero(target - account.balance);
  if (shift === 0) return Promise.resolve();
  return updateDoc(accountDoc(uid, account.id), {
    openingBalance: increment(shift),
    balance: increment(shift),
    updatedAt: serverTimestamp(),
  });
}

export function setAccountActive(uid: string, id: string, active: boolean): Promise<void> {
  return updateDoc(accountDoc(uid, id), { active, updatedAt: serverTimestamp() });
}

/** Records the latest card statement (amount billed and minimum due). */
export function updateCardStatement(
  uid: string,
  id: string,
  { statementBalance, minimumDue }: { statementBalance: number | null; minimumDue: number | null },
): Promise<void> {
  return updateDoc(accountDoc(uid, id), { statementBalance, minimumDue, updatedAt: serverTimestamp() });
}

/**
 * Deletes an account. History that references it is kept and shown as "Deleted account";
 * prefer deactivating accounts you no longer use.
 */
export function deleteAccount(uid: string, id: string): Promise<void> {
  return deleteDoc(accountDoc(uid, id));
}
