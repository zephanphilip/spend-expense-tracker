import {
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { applyBuy, applySell, applyValuation } from "@/lib/finance/investments";
import { investmentTxEffects } from "@/lib/finance/ledger";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import type { Investment, InvestmentKind, InvestmentTransaction, InvestmentTxKind } from "@/types";

import { type AccountExists, applyBalanceEffects } from "./balances";
import { deleteParentThenChildren } from "./batch-delete";
import { investmentConverter, investmentTxConverter } from "./converters";
import type { PendingWrite } from "./expense.service";
import { investmentDoc, investmentsCol, investmentTxCol, investmentTxDoc } from "./paths";

type Unsubscribe = () => void;

export function subscribeInvestments(
  uid: string,
  onData: (items: Investment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(investmentsCol(uid), orderBy("createdAt", "asc")).withConverter(investmentConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

export function subscribeInvestmentHistory(
  uid: string,
  filter: { investmentId: string } | { accountId: string },
  onData: (items: InvestmentTransaction[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const [field, value] = "investmentId" in filter ? ["investmentId", filter.investmentId] : ["accountId", filter.accountId];
  const q = query(investmentTxCol(uid), where(field, "==", value), orderBy("occurredAt", "desc"), limit(200)).withConverter(
    investmentTxConverter,
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

export interface NewInvestment {
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  invested: number;
  /** Current value if different from invested (existing holdings). */
  currentValue: number;
  purchaseDate: Date;
  /** Account the money came from; null for holdings bought before using the app. */
  accountId: string | null;
}

/** Creates a holding with its opening BUY in one batch (debiting the account if given). */
export function createInvestment(uid: string, input: NewInvestment): PendingWrite {
  const ref = doc(investmentsCol(uid));
  const txRef = doc(investmentTxCol(uid));
  const batch = writeBatch(getDb());
  batch.set(ref, {
    name: input.name.trim(),
    kind: input.kind,
    institution: input.institution?.trim() || null,
    investedAmount: input.invested,
    currentValue: input.currentValue,
    realizedGain: 0,
    purchaseDate: Timestamp.fromDate(input.purchaseDate),
    lastValuedAt: Timestamp.fromDate(new Date()),
    status: "active",
    lastOpId: txRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(txRef, {
    investmentId: ref.id,
    type: "INVESTMENT",
    kind: "BUY",
    amount: input.invested,
    costBasis: null,
    accountId: input.accountId,
    note: "Initial investment",
    occurredAt: Timestamp.fromDate(input.purchaseDate),
    createdAt: serverTimestamp(),
  });
  applyBalanceEffects(batch.update.bind(batch), uid, investmentTxEffects({ kind: "BUY", amount: input.invested, accountId: input.accountId }), txRef.id);
  return { id: ref.id, committed: batch.commit() };
}

export interface InvestmentTxInput {
  kind: InvestmentTxKind;
  /** BUY/SELL: cash amount. VALUATION: new current value. */
  amount: number;
  accountId: string | null;
  note: string;
  occurredAt: Date;
}

/**
 * Records a buy, sell or valuation atomically: the history entry, the holding's new
 * invested/current values (sell uses proportional cost basis), and the account movement.
 */
export async function recordInvestmentTx(
  uid: string,
  investmentId: string,
  input: InvestmentTxInput,
  options: { accountExists?: AccountExists } = {},
): Promise<{ realized: number | null }> {
  const invRef = investmentDoc(uid, investmentId).withConverter(investmentConverter);
  const txRef = doc(investmentTxCol(uid));
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new Error("Investment not found");
    const inv = snap.data();
    let next = inv;
    let costBasis: number | null = null;
    let realized: number | null = null;
    let status = inv.status;
    if (input.kind === "BUY") next = applyBuy(inv, input.amount);
    else if (input.kind === "VALUATION") next = applyValuation(inv, input.amount);
    else {
      const sale = applySell(inv, input.amount);
      next = sale.next;
      costBasis = sale.costBasis;
      realized = sale.realized;
      if (sale.closed) status = "closed";
    }
    if (input.kind === "BUY") status = "active";
    const accountId = input.kind === "VALUATION" ? null : input.accountId;
    tx.set(txRef, {
      investmentId,
      type: "INVESTMENT",
      kind: input.kind,
      amount: input.amount,
      costBasis,
      accountId,
      note: input.note.trim().slice(0, NOTE_MAX_LENGTH),
      occurredAt: Timestamp.fromDate(input.occurredAt),
      createdAt: serverTimestamp(),
    });
    tx.update(investmentDoc(uid, investmentId), {
      investedAmount: next.investedAmount,
      currentValue: next.currentValue,
      realizedGain: next.realizedGain,
      status,
      lastOpId: txRef.id,
      ...(input.kind === "VALUATION" ? { lastValuedAt: Timestamp.fromDate(input.occurredAt) } : {}),
      updatedAt: serverTimestamp(),
    });
    applyBalanceEffects(tx.update.bind(tx), uid, investmentTxEffects({ kind: input.kind, amount: input.amount, accountId }), txRef.id, options);
    return { realized };
  });
}

export function updateInvestmentDetails(uid: string, id: string, details: { name: string; institution: string | null; kind: InvestmentKind }) {
  return updateDoc(investmentDoc(uid, id), {
    name: details.name.trim(),
    institution: details.institution?.trim() || null,
    kind: details.kind,
    updatedAt: serverTimestamp(),
  });
}

/** Deletes the holding and its history. Cash already moved stays in your accounts. */
export async function deleteInvestment(uid: string, id: string): Promise<void> {
  const history = await getDocs(query(investmentTxCol(uid), where("investmentId", "==", id)));
  await deleteParentThenChildren(investmentDoc(uid, id), history.docs.map((d) => investmentTxDoc(uid, d.id)));
}
