import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

import {
  BACKUP_APP,
  BACKUP_COLLECTIONS,
  BACKUP_VERSION,
  type BackupCollection,
  type BackupDoc,
  type BackupFile,
  contentKey,
  decodeValue,
  encodeValue,
  type RestorePlanEntry,
  stripFields,
  SUBCOLLECTIONS,
  type ValidatedBackup,
} from "@/lib/backup/format";
import { getDb } from "@/lib/firebase/client";
import { monthKey } from "@/lib/months";
import type { UserProfile } from "@/types";

import { rebuildMonthlyStats } from "./stats.service";

const topCol = (uid: string, name: string) => collection(getDb(), "users", uid, name);

async function readCollection(uid: string, name: BackupCollection): Promise<BackupDoc[]> {
  const sub = SUBCOLLECTIONS[name];
  if (!sub) {
    const snap = await getDocs(topCol(uid, name));
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  const parents = await getDocs(topCol(uid, sub.parent));
  const out: BackupDoc[] = [];
  for (const p of parents.docs) {
    const snap = await getDocs(collection(getDb(), "users", uid, sub.parent, p.id, sub.name));
    out.push(...snap.docs.map((d) => ({ id: d.id, parentId: p.id, data: d.data() })));
  }
  return out;
}

/** Complete JSON backup of every user collection (derived aggregates are rebuilt on restore). */
export async function createBackup(uid: string, profile: UserProfile | null): Promise<BackupFile> {
  const collections: BackupFile["collections"] = {};
  for (const name of BACKUP_COLLECTIONS) {
    const docs = await readCollection(uid, name);
    collections[name] = docs.map((d) => ({ ...d, data: encodeValue(stripFields(d.data)) as Record<string, unknown> }));
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    profile: { displayName: profile?.displayName ?? null, currency: profile?.currency ?? "INR" },
    collections,
  };
}

/** Ids (and content fingerprints for expenses/incomes) already in the account, for duplicate detection. */
export async function existingForRestore(uid: string) {
  const ids = {} as Record<BackupCollection, Set<string>>;
  const contentKeys: Partial<Record<BackupCollection, Set<string>>> = {};
  for (const name of BACKUP_COLLECTIONS) {
    const docs = await readCollection(uid, name);
    ids[name] = new Set(docs.map((d) => (d.parentId ? `${d.parentId}/${d.id}` : d.id)));
    if (name === "expenses" || name === "incomes") {
      contentKeys[name] = new Set(
        docs.map((d) => contentKey(name, decodeValue(encodeValue(d.data)) as Record<string, unknown>)).filter((k): k is string => Boolean(k)),
      );
    }
  }
  return { ids, contentKeys };
}

/** Which server-managed timestamps each collection's rules expect. */
const TIMESTAMPS: Record<BackupCollection, ("createdAt" | "updatedAt")[]> = {
  categories: ["createdAt", "updatedAt"],
  accounts: ["createdAt", "updatedAt"],
  emis: ["createdAt", "updatedAt"],
  goals: ["createdAt", "updatedAt"],
  investments: ["createdAt", "updatedAt"],
  recurringPayments: ["createdAt", "updatedAt"],
  recurringIncomes: ["createdAt", "updatedAt"],
  budgets: ["updatedAt"],
  netWorth: ["updatedAt"],
  expenses: ["createdAt", "updatedAt"],
  incomes: ["createdAt", "updatedAt"],
  transfers: ["createdAt", "updatedAt"],
  investmentTransactions: ["createdAt"],
  emiPayments: ["createdAt"],
  goalContributions: ["createdAt"],
};
const WITH_LAST_OP: ReadonlySet<BackupCollection> = new Set(["accounts", "goals", "investments"]);

export interface RestoreResult {
  restoreId: string;
  written: number;
  orphaned: number;
}

const CHUNK = 400;

/**
 * Restores the planned documents under a restore session (the only time Security Rules
 * accept documents whose balances/ledgers weren't produced by live transactions), in
 * dependency order and chunks of 400, then closes the session and rebuilds monthly
 * aggregates for the months touched. Existing documents are never overwritten.
 */
export async function runRestore(
  uid: string,
  backup: ValidatedBackup,
  plan: RestorePlanEntry[],
  existingAccountIds: ReadonlySet<string>,
  fileName: string,
  onProgress?: (written: number, total: number) => void,
): Promise<RestoreResult> {
  // Transfers can only point at accounts that exist or are being restored.
  const accountIds = new Set([...existingAccountIds, ...(plan.find((p) => p.collection === "accounts")?.toCreate.map((d) => d.id) ?? [])]);
  let orphaned = 0;
  const work: { collection: BackupCollection; doc: BackupDoc }[] = [];
  for (const entry of plan) {
    for (const d of entry.toCreate) {
      if (entry.collection === "transfers") {
        const t = d.data as { fromAccountId: string; toAccountId: string | null };
        if (!accountIds.has(t.fromAccountId) || (t.toAccountId && !accountIds.has(t.toAccountId))) {
          orphaned++;
          continue;
        }
      }
      work.push({ collection: entry.collection, doc: d });
    }
  }

  const sessionRef = doc(collection(getDb(), "users", uid, "restores"));
  const counts = Object.fromEntries(plan.map((p) => [p.collection, p.toCreate.length]));
  await setDoc(sessionRef, {
    status: "restoring",
    fileName: fileName.slice(0, 200),
    backupCreatedAt: Number.isNaN(backup.createdAt.getTime()) ? null : backup.createdAt,
    counts,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  let written = 0;
  try {
    for (let i = 0; i < work.length; i += CHUNK) {
      const batch = writeBatch(getDb());
      for (const { collection: name, doc: d } of work.slice(i, i + CHUNK)) {
        const sub = SUBCOLLECTIONS[name];
        const ref = sub ? doc(getDb(), "users", uid, sub.parent, d.parentId!, sub.name, d.id) : doc(getDb(), "users", uid, name, d.id);
        const data: Record<string, unknown> = { ...d.data, restoreId: sessionRef.id };
        for (const field of TIMESTAMPS[name]) data[field] = serverTimestamp();
        if (WITH_LAST_OP.has(name)) data.lastOpId = null;
        if (name === "expenses") data.type = "EXPENSE";
        if (name === "incomes") data.type = "INCOME";
        batch.set(ref, data);
      }
      await batch.commit();
      written = Math.min(i + CHUNK, work.length);
      onProgress?.(written, work.length);
    }
    await updateDoc(sessionRef, { status: "completed", updatedAt: serverTimestamp() });
  } catch (error) {
    await updateDoc(sessionRef, { status: "failed", updatedAt: serverTimestamp() }).catch(() => undefined);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { written });
  }

  // Rebuild analytics aggregates for every month that received expenses or income.
  const months = new Set<string>();
  for (const { collection: name, doc: d } of work) {
    if (name === "expenses") months.add(monthKey(d.data.occurredAt as Date));
    if (name === "incomes") months.add(d.data.forMonth as string);
  }
  const list = [...months].sort();
  for (let i = 0; i < list.length; i += 6) await rebuildMonthlyStats(uid, list.slice(i, i + 6));

  return { restoreId: sessionRef.id, written: work.length, orphaned };
}
