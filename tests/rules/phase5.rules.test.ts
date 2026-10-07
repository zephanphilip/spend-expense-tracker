import { readFileSync } from "node:fs";

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, type Firestore, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-ledger-rules-p5", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const alice = () => env.authenticatedContext("alice").firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext("bob").firestore() as unknown as Firestore;
const U = "users/alice";

const session = (status = "restoring") => ({ status, fileName: "ledger-backup.json", counts: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

const account = (patch: Record<string, unknown> = {}) => ({
  name: "HDFC", type: "bank", institution: null, openingBalance: 100000, balance: 100000, active: true,
  creditLimit: null, statementDay: null, dueDay: null, statementBalance: null, minimumDue: null, lastOpId: null,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...patch,
});
const expense = (patch: Record<string, unknown> = {}) => ({
  type: "EXPENSE", amount: 5000, categoryId: "food", paymentMethod: "upi", note: "", occurredAt: Timestamp.now(),
  accountId: "a1", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...patch,
});

describe("backup restore sessions", () => {
  it("relaxes ledger checks only for documents stamped with an open session", async () => {
    const db = alice();
    // Without a session: an account whose balance ≠ opening, or an expense that doesn't move a balance, is rejected.
    await assertFails(setDoc(doc(db, `${U}/accounts/a1`), account({ balance: 75000 })));
    await assertSucceeds(setDoc(doc(db, `${U}/restores/r1`), session()));
    await assertSucceeds(setDoc(doc(db, `${U}/accounts/a1`), account({ balance: 75000, restoreId: "r1" })));
    await assertSucceeds(setDoc(doc(db, `${U}/expenses/e1`), expense({ restoreId: "r1" })));
    await assertFails(setDoc(doc(db, `${U}/expenses/e2`), expense({ restoreId: "nope" })));
    await assertFails(setDoc(doc(db, `${U}/expenses/e3`), expense()));
  });

  it("closed sessions stop relaxing rules and can't be reopened", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/restores/r1`), session()));
    await assertSucceeds(updateDoc(doc(db, `${U}/restores/r1`), { status: "completed", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, `${U}/accounts/a1`), account({ balance: 1, restoreId: "r1" })));
    await assertFails(updateDoc(doc(db, `${U}/restores/r1`), { status: "restoring", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, `${U}/restores/r2`), session("completed")));
  });

  it("sessions belong to their owner", async () => {
    await assertFails(setDoc(doc(bob(), `${U}/restores/r1`), session()));
  });

  it("schema validation still applies during restore", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/restores/r1`), session()));
    await assertFails(setDoc(doc(db, `${U}/expenses/e1`), expense({ restoreId: "r1", amount: -5 })));
    await assertFails(setDoc(doc(db, `${U}/expenses/e1`), expense({ restoreId: "r1", evil: true })));
  });
});

describe("recurring automation fields", () => {
  it("expenses may reference their recurring occurrence", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/expenses/rp_x_0`), expense({ accountId: null, recurringId: "x", occurrence: 0 })));
    await assertFails(setDoc(doc(db, `${U}/expenses/rp_x_1`), expense({ accountId: null, recurringId: "x", occurrence: -1 })));
  });

  it("recurring payments accept the autoPay flag", async () => {
    const db = alice();
    const rp = {
      name: "Rent", amount: 2200000, categoryId: "home", paymentMethod: "upi", accountId: null, unit: "month", interval: 1,
      startDate: Timestamp.now(), cycle: 0, nextDate: Timestamp.now(), endDate: null, active: true, autoPay: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db, `${U}/recurringPayments/r`), rp));
    await assertFails(setDoc(doc(db, `${U}/recurringPayments/r2`), { ...rp, autoPay: "yes" }));
  });
});
