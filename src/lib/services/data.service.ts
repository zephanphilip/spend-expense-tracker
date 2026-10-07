import {
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { endOfDay, startOfDay } from "date-fns";

import { getDb } from "@/lib/firebase/client";
import { fingerprint, type ImportType, type ParsedRow } from "@/lib/csv/import";
import { monthKey } from "@/lib/months";
import { expenseStatsDelta, incomeStatsDelta, mergeStatsDeltas, type StatsDelta } from "@/lib/stats/monthly";
import type { CategoryColorKey, Expense, Income } from "@/types";

import { categoriesCol, expenseDoc, expensesCol, importDoc, importsCol, incomeDoc, incomesCol } from "./paths";
import { expenseConverter, incomeConverter } from "./converters";
import { applyStatsDeltas } from "./stats.service";

/** All expenses (export is an explicit user action), newest first. */
export async function fetchAllExpenses(uid: string): Promise<Expense[]> {
  const snap = await getDocs(query(expensesCol(uid), orderBy("occurredAt", "desc")).withConverter(expenseConverter));
  return snap.docs.map((d) => d.data());
}

export async function fetchAllIncomes(uid: string): Promise<Income[]> {
  const snap = await getDocs(query(incomesCol(uid), orderBy("receivedAt", "desc")).withConverter(incomeConverter));
  return snap.docs.map((d) => d.data());
}

/**
 * Fingerprints of records already saved in the file's date span — the only data the
 * duplicate check downloads.
 */
export async function existingFingerprints(uid: string, type: ImportType, span: { from: Date; to: Date }): Promise<Set<string>> {
  const from = Timestamp.fromDate(startOfDay(span.from));
  const to = Timestamp.fromDate(endOfDay(span.to));
  if (type === "expenses") {
    const snap = await getDocs(query(expensesCol(uid), where("occurredAt", ">=", from), where("occurredAt", "<=", to)).withConverter(expenseConverter));
    return new Set(snap.docs.map((d) => d.data()).map((e) => fingerprint(e.occurredAt, e.amount, e.note)));
  }
  const snap = await getDocs(query(incomesCol(uid), where("receivedAt", ">=", from), where("receivedAt", "<=", to)).withConverter(incomeConverter));
  return new Set(snap.docs.map((d) => d.data()).map((i) => fingerprint(i.receivedAt, i.amount, i.note)));
}

export interface ImportLog {
  id: string;
  type: ImportType;
  fileName: string;
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  status: "importing" | "completed" | "undone";
  createdAt: Date;
}

export function subscribeImports(uid: string, onData: (items: ImportLog[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(importsCol(uid), orderBy("createdAt", "desc"), limit(10)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            type: x.type === "incomes" ? "incomes" : "expenses",
            fileName: String(x.fileName ?? ""),
            total: Number(x.total ?? 0),
            imported: Number(x.imported ?? 0),
            skipped: Number(x.skipped ?? 0),
            duplicates: Number(x.duplicates ?? 0),
            invalid: Number(x.invalid ?? 0),
            status: x.status === "undone" ? "undone" : x.status === "importing" ? "importing" : "completed",
            createdAt: x.createdAt instanceof Timestamp ? x.createdAt.toDate() : new Date(),
          } satisfies ImportLog;
        }),
      ),
    onError,
  );
}

const CHUNK = 200;
const NEW_CATEGORY_COLORS: CategoryColorKey[] = ["violet", "teal", "pink", "sky", "amber", "lime", "rose", "indigo"];

export interface ImportRequest {
  type: ImportType;
  fileName: string;
  /** Rows the user confirmed (valid, plus duplicates only if they opted in). */
  rows: ParsedRow[];
  counts: { total: number; duplicates: number; invalid: number; skipped: number };
}

/**
 * Imports confirmed rows as *new* documents only — never overwrites. Writes happen in
 * chunks of 200 (each with its monthly-aggregate increments) under an import log whose id
 * is stamped on every row, so the whole import can be undone. Imported rows aren't linked
 * to accounts: past transactions are already reflected in your current balances.
 */
export async function runImport(uid: string, req: ImportRequest, onProgress?: (done: number) => void): Promise<{ importId: string; imported: number }> {
  const logRef = doc(importsCol(uid));
  await setDoc(logRef, {
    type: req.type,
    fileName: req.fileName.slice(0, 200),
    total: req.counts.total,
    imported: 0,
    skipped: req.counts.skipped,
    duplicates: req.counts.duplicates,
    invalid: req.counts.invalid,
    status: "importing",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Create any new categories first, once each.
  const newCategoryIds = new Map<string, string>();
  const newNames = [...new Set(req.rows.map((r) => r.newCategoryName).filter((n): n is string => Boolean(n)))];
  if (newNames.length) {
    const batch = writeBatch(getDb());
    newNames.forEach((name, i) => {
      const ref = doc(categoriesCol(uid));
      newCategoryIds.set(name, ref.id);
      batch.set(ref, {
        name,
        icon: "other",
        color: NEW_CATEGORY_COLORS[i % NEW_CATEGORY_COLORS.length],
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  let imported = 0;
  for (let i = 0; i < req.rows.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    const deltas: StatsDelta[] = [];
    for (const row of req.rows.slice(i, i + CHUNK)) {
      if (!row.date || !row.amount) continue;
      const occurredAt = Timestamp.fromDate(row.date);
      if (req.type === "expenses") {
        const categoryId = row.categoryId ?? newCategoryIds.get(row.newCategoryName ?? "") ?? "other";
        batch.set(doc(expensesCol(uid)), {
          type: "EXPENSE",
          amount: row.amount,
          categoryId,
          paymentMethod: row.paymentMethod,
          note: row.note,
          occurredAt,
          accountId: null,
          importId: logRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        deltas.push(expenseStatsDelta({ amount: row.amount, categoryId, paymentMethod: row.paymentMethod, accountId: null, occurredAt: row.date }, 1));
      } else {
        const forMonth = monthKey(row.date);
        batch.set(doc(incomesCol(uid)), {
          type: "INCOME",
          amount: row.amount,
          source: row.source,
          note: row.note,
          receivedAt: occurredAt,
          forMonth,
          expectedAt: null,
          recurringId: null,
          accountId: null,
          importId: logRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        deltas.push(incomeStatsDelta({ amount: row.amount, source: row.source, forMonth }, 1));
      }
      imported++;
    }
    applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(...deltas));
    await batch.commit();
    onProgress?.(imported);
  }

  await updateDoc(logRef, { status: "completed", imported, updatedAt: serverTimestamp() });
  return { importId: logRef.id, imported };
}

/** Deletes every record created by an import (and reverses its analytics), in chunks. */
export async function undoImport(uid: string, log: Pick<ImportLog, "id" | "type">): Promise<number> {
  const col = log.type === "expenses" ? expensesCol(uid) : incomesCol(uid);
  let removed = 0;
  // Loop because each pass deletes up to CHUNK records.
  for (;;) {
    const snap = await getDocs(query(col, where("importId", "==", log.id), limit(CHUNK)));
    if (snap.empty) break;
    const batch = writeBatch(getDb());
    const deltas: StatsDelta[] = [];
    for (const d of snap.docs) {
      if (log.type === "expenses") {
        const e = expenseConverter.fromFirestore(d as never);
        deltas.push(expenseStatsDelta(e, -1));
        batch.delete(expenseDoc(uid, d.id));
      } else {
        const inc = incomeConverter.fromFirestore(d as never);
        deltas.push(incomeStatsDelta(inc, -1));
        batch.delete(incomeDoc(uid, d.id));
      }
    }
    applyStatsDeltas(batch.set.bind(batch), uid, mergeStatsDeltas(...deltas));
    await batch.commit();
    removed += snap.size;
  }
  await updateDoc(importDoc(uid, log.id), { status: "undone", updatedAt: serverTimestamp() });
  return removed;
}
