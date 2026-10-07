import {
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { afterCardPayment } from "@/lib/finance/accounts";
import { reverseEffects, transferEffects } from "@/lib/finance/ledger";
import { transferInputSchema } from "@/lib/validation/accounts";
import type { Account, Transfer } from "@/types";

import { type AccountExists, applyBalanceEffects } from "./balances";
import { transferConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { transferDoc, transfersCol } from "./paths";

/** Movements in or out of an account (two indexed queries merged), newest first. */
export function subscribeAccountTransfers(
  uid: string,
  accountId: string,
  onData: (transfers: Transfer[]) => void,
  onError: (error: Error) => void,
): () => void {
  let outgoing: Transfer[] | null = null;
  let incoming: Transfer[] | null = null;
  const emit = () => {
    if (!outgoing || !incoming) return;
    const byId = new Map([...outgoing, ...incoming].map((t) => [t.id, t]));
    onData([...byId.values()].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()));
  };
  const make = (field: "fromAccountId" | "toAccountId") =>
    query(transfersCol(uid), where(field, "==", accountId), orderBy("occurredAt", "desc"), limit(200)).withConverter(
      transferConverter,
    );
  const u1 = onSnapshot(make("fromAccountId"), (s) => ((outgoing = s.docs.map((d) => d.data())), emit()), onError);
  const u2 = onSnapshot(make("toAccountId"), (s) => ((incoming = s.docs.map((d) => d.data())), emit()), onError);
  return () => {
    u1();
    u2();
  };
}

export interface TransferInput {
  from: Account;
  to: Account;
  amount: number;
  note: string;
  occurredAt: Date;
}

/**
 * Moves money between two of your accounts in one batch: the transfer record (both sides,
 * so they can't drift apart) plus a debit and a credit. Paying a credit card is the same
 * movement typed DEBT_PAYMENT; it also reduces the card's statement/minimum due. Neither
 * is an expense — the spending was recorded when you used the card.
 */
export function createTransfer(uid: string, { from, to, amount, note, occurredAt }: TransferInput): PendingWrite {
  const v = transferInputSchema.parse({ fromAccountId: from.id, toAccountId: to.id, amount, note, occurredAt });
  if (v.fromAccountId === v.toAccountId) throw new Error("Choose two different accounts");
  const type = to.type === "credit_card" ? "DEBT_PAYMENT" : "TRANSFER";
  const ref = doc(transfersCol(uid));
  const batch = writeBatch(getDb());
  batch.set(ref, {
    type,
    amount: v.amount,
    fromAccountId: v.fromAccountId,
    toAccountId: v.toAccountId,
    emiId: null,
    emiInstallment: null,
    note: v.note.trim(),
    occurredAt: Timestamp.fromDate(v.occurredAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  applyBalanceEffects(batch.update.bind(batch), uid, transferEffects(v), ref.id, {
    extra: type === "DEBT_PAYMENT" ? { [to.id]: afterCardPayment(to, v.amount) } : {},
  });
  return { id: ref.id, committed: batch.commit() };
}

/** Deletes a transfer and reverses both sides. EMI payments must be undone from the EMI. */
export function deleteTransfer(uid: string, transfer: Transfer, accountExists?: AccountExists): Promise<void> {
  if (transfer.emiId) throw new Error("Undo EMI payments from the loan's page.");
  const batch = writeBatch(getDb());
  batch.delete(transferDoc(uid, transfer.id));
  applyBalanceEffects(batch.update.bind(batch), uid, reverseEffects(transferEffects(transfer)), transfer.id, { accountExists });
  return batch.commit();
}

/** Only the note and date can change; amounts and accounts are fixed (delete and re-add instead). */
export function updateTransferDetails(uid: string, id: string, { note, occurredAt }: { note: string; occurredAt: Date }) {
  return updateDoc(transferDoc(uid, id), { note: note.trim(), occurredAt: Timestamp.fromDate(occurredAt), updatedAt: serverTimestamp() });
}
