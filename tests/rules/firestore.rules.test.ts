import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ledger-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();

const validExpense = () => ({
  amount: 25000,
  categoryId: "food",
  paymentMethod: "upi",
  note: "Lunch",
  occurredAt: Timestamp.fromDate(new Date()),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const validProfile = () => ({
  email: "alice@example.com",
  displayName: "Alice",
  photoURL: null,
  currency: "INR",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const validCategory = () => ({
  name: "Coffee",
  icon: "coffee",
  color: "amber",
  archived: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/** Seeds data bypassing rules. */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("profiles", () => {
  it("lets a user create and read their own profile", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice"), validProfile()));
    await assertSucceeds(getDoc(doc(alice(), "users/alice")));
  });

  it("blocks other users and anonymous visitors", async () => {
    await seed("users/alice", { ...validProfile(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await assertFails(getDoc(doc(bob(), "users/alice")));
    await assertFails(getDoc(doc(anon(), "users/alice")));
    await assertFails(setDoc(doc(bob(), "users/alice"), validProfile()));
  });

  it("rejects unknown currencies and extra fields", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice"), { ...validProfile(), currency: "XYZ" }));
    await assertFails(setDoc(doc(alice(), "users/alice"), { ...validProfile(), isAdmin: true }));
  });

  it("keeps createdAt immutable and forbids deletion", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice"), validProfile()));
    await assertSucceeds(
      updateDoc(doc(alice(), "users/alice"), { currency: "USD", updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(alice(), "users/alice"), {
        createdAt: Timestamp.fromDate(new Date(2000, 0, 1)),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(alice(), "users/alice")));
  });
});

describe("expenses", () => {
  const path = "users/alice/expenses/e1";

  it("allows full CRUD for the owner", async () => {
    await assertSucceeds(setDoc(doc(alice(), path), validExpense()));
    await assertSucceeds(getDoc(doc(alice(), path)));
    await assertSucceeds(
      updateDoc(doc(alice(), path), { amount: 30000, note: "", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(deleteDoc(doc(alice(), path)));
  });

  it("denies every operation to other users", async () => {
    await seed(path, { ...validExpense(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await assertFails(getDoc(doc(bob(), path)));
    await assertFails(setDoc(doc(bob(), "users/alice/expenses/e2"), validExpense()));
    await assertFails(updateDoc(doc(bob(), path), { amount: 1, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(bob(), path)));
    await assertFails(getDoc(doc(anon(), path)));
  });

  it.each([
    ["zero amount", { amount: 0 }],
    ["negative amount", { amount: -100 }],
    ["fractional amount", { amount: 10.5 }],
    ["string amount", { amount: "100" }],
    ["huge amount", { amount: 1_000_000_000_001 }],
    ["unknown payment method", { paymentMethod: "crypto" }],
    ["empty category", { categoryId: "" }],
    ["long note", { note: "x".repeat(281) }],
    ["non-timestamp date", { occurredAt: "2026-10-06" }],
    ["client-chosen createdAt", { createdAt: Timestamp.fromDate(new Date(2000, 0, 1)) }],
    ["extra field", { userId: "alice" }],
  ])("rejects %s", async (_label, patch) => {
    await assertFails(setDoc(doc(alice(), path), { ...validExpense(), ...patch }));
  });

  it("rejects a missing required field", async () => {
    const { note: _omit, ...rest } = validExpense();
    void _omit;
    await assertFails(setDoc(doc(alice(), path), rest));
  });

  it("rejects updates that rewrite createdAt or skip updatedAt", async () => {
    await assertSucceeds(setDoc(doc(alice(), path), validExpense()));
    await assertFails(
      updateDoc(doc(alice(), path), { createdAt: Timestamp.fromDate(new Date(2000, 0, 1)) }),
    );
    await assertFails(updateDoc(doc(alice(), path), { amount: 999 }));
  });
});

describe("custom categories", () => {
  const path = "users/alice/categories/c1";

  it("allows owner create, update and archive, but not delete", async () => {
    await assertSucceeds(setDoc(doc(alice(), path), validCategory()));
    await assertSucceeds(
      updateDoc(doc(alice(), path), { name: "Cafés", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(alice(), path), { archived: true, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(alice(), path)));
  });

  it("denies other users", async () => {
    await seed(path, { ...validCategory(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await assertFails(getDoc(doc(bob(), path)));
    await assertFails(setDoc(doc(bob(), "users/alice/categories/c2"), validCategory()));
  });

  it.each([
    ["empty name", { name: "" }],
    ["long name", { name: "x".repeat(33) }],
    ["unknown icon", { icon: "rocket" }],
    ["unknown color", { color: "#ff0000" }],
    ["non-bool archived", { archived: "no" }],
  ])("rejects %s", async (_label, patch) => {
    await assertFails(setDoc(doc(alice(), path), { ...validCategory(), ...patch }));
  });
});

describe("everything else", () => {
  it("is denied by default", async () => {
    await assertFails(setDoc(doc(alice(), "admin/config"), { open: true }));
    // A user can't enumerate other users' profiles or expenses.
    await assertFails(getDocs(collection(alice(), "users")));
    await assertFails(getDocs(collection(alice(), "users/bob/expenses")));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/expenses")));
  });
});

// ================================================================ Phase 2

describe("incomes", () => {
  const income = (patch: Record<string, unknown> = {}) => ({
    amount: 5000000,
    source: "salary",
    note: "",
    receivedAt: Timestamp.now(),
    forMonth: "2026-10",
    expectedAt: null,
    recurringId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...patch,
  });

  it("allows the owner and blocks others", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/incomes/i1"), income()));
    await assertFails(getDoc(doc(bob(), "users/alice/incomes/i1")));
    await assertFails(setDoc(doc(bob(), "users/alice/incomes/i2"), income()));
  });

  it("requires the deterministic id for recurring incomes", async () => {
    await assertSucceeds(
      setDoc(doc(alice(), "users/alice/incomes/tpl1_2026-10"), income({ recurringId: "tpl1" })),
    );
    await assertFails(setDoc(doc(alice(), "users/alice/incomes/random"), income({ recurringId: "tpl1" })));
  });

  it.each([
    ["bad source", { source: "lottery" }],
    ["bad month", { forMonth: "2026-13" }],
    ["zero amount", { amount: 0 }],
    ["float amount", { amount: 10.5 }],
  ])("rejects %s", async (_l, patch) => {
    await assertFails(setDoc(doc(alice(), "users/alice/incomes/i1"), income(patch)));
  });
});

describe("budgets", () => {
  const budget = (month: string, patch: Record<string, unknown> = {}) => ({
    month,
    overall: 3000000,
    categories: { food: 800000 },
    updatedAt: serverTimestamp(),
    ...patch,
  });

  it("stores one document per month, id must match", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/budgets/2026-10"), budget("2026-10")));
    await assertSucceeds(setDoc(doc(alice(), "users/alice/budgets/2026-10"), budget("2026-10", { overall: null })));
    await assertFails(setDoc(doc(alice(), "users/alice/budgets/2026-10"), budget("2026-11")));
    await assertFails(setDoc(doc(alice(), "users/alice/budgets/october"), budget("october")));
    await assertFails(setDoc(doc(bob(), "users/alice/budgets/2026-10"), budget("2026-10")));
  });
});

describe("EMI payments stay consistent with the loan", () => {
  const loanPath = "users/alice/emis/loan1";
  const loan = (patch: Record<string, unknown> = {}) => ({
    name: "Car loan",
    lender: null,
    principal: 50000000,
    annualRateBps: 900,
    monthlyAmount: 1037900,
    tenureMonths: 60,
    startDate: Timestamp.now(),
    paidCount: 0,
    outstanding: 50000000,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...patch,
  });
  const payment = (installment: number) => ({
    installment,
    amount: 1037900,
    principalPart: 662900,
    interestPart: 375000,
    dueDate: Timestamp.now(),
    paidAt: Timestamp.now(),
    expenseId: null,
    createdAt: serverTimestamp(),
  });

  beforeEach(async () => {
    await assertSucceeds(setDoc(doc(alice(), loanPath), loan()));
  });

  it("accepts payment + paidCount increment in one batch", async () => {
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, `${loanPath}/payments/1`), payment(1));
    batch.update(doc(db, loanPath), { paidCount: 1, outstanding: 49337100, updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it("rejects a payment without the loan update, or for the wrong installment", async () => {
    await assertFails(setDoc(doc(alice(), `${loanPath}/payments/1`), payment(1)));
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, `${loanPath}/payments/2`), payment(2));
    batch.update(doc(db, loanPath), { paidCount: 2, updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it("rejects bumping paidCount without a payment record", async () => {
    await assertFails(updateDoc(doc(alice(), loanPath), { paidCount: 1, updatedAt: serverTimestamp() }));
  });

  it("rejects mismatched principal/interest split", async () => {
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, `${loanPath}/payments/1`), { ...payment(1), interestPart: 1 });
    batch.update(doc(db, loanPath), { paidCount: 1, updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it("allows undoing only the latest payment, together with the loan", async () => {
    const db = alice();
    const pay = writeBatch(db);
    pay.set(doc(db, `${loanPath}/payments/1`), payment(1));
    pay.update(doc(db, loanPath), { paidCount: 1, updatedAt: serverTimestamp() });
    await assertSucceeds(pay.commit());

    await assertFails(deleteDoc(doc(db, `${loanPath}/payments/1`)));
    const undo = writeBatch(db);
    undo.delete(doc(db, `${loanPath}/payments/1`));
    undo.update(doc(db, loanPath), { paidCount: 0, updatedAt: serverTimestamp() });
    await assertSucceeds(undo.commit());
  });

  it("lets payments be cleaned up after the loan is deleted", async () => {
    const db = alice();
    const pay = writeBatch(db);
    pay.set(doc(db, `${loanPath}/payments/1`), payment(1));
    pay.update(doc(db, loanPath), { paidCount: 1, updatedAt: serverTimestamp() });
    await assertSucceeds(pay.commit());
    await assertSucceeds(deleteDoc(doc(db, loanPath)));
    await assertSucceeds(deleteDoc(doc(db, `${loanPath}/payments/1`)));
  });

  it("rejects outstanding above principal", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/emis/loan2"), loan({ outstanding: 60000000 })));
  });
});

describe("goal balances only change with a contribution", () => {
  const goalPath = "users/alice/goals/g1";
  const goal = (patch: Record<string, unknown> = {}) => ({
    name: "New phone",
    icon: "phone",
    color: "violet",
    targetAmount: 8000000,
    savedAmount: 0,
    targetDate: null,
    status: "active",
    lastOpId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...patch,
  });
  const contribution = (amount: number) => ({
    amount,
    note: "",
    contributedAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  });

  it("creates a goal with an opening balance in one batch", async () => {
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, goalPath), goal({ savedAmount: 100000, lastOpId: "c0" }));
    batch.set(doc(db, `${goalPath}/contributions/c0`), contribution(100000));
    await assertSucceeds(batch.commit());
  });

  it("rejects setting savedAmount directly", async () => {
    await assertSucceeds(setDoc(doc(alice(), goalPath), goal()));
    await assertFails(
      updateDoc(doc(alice(), goalPath), { savedAmount: 999, updatedAt: serverTimestamp() }),
    );
  });

  it("accepts contribution + matching balance update, rejects a mismatch", async () => {
    await assertSucceeds(setDoc(doc(alice(), goalPath), goal()));
    const db = alice();
    const ok = writeBatch(db);
    ok.set(doc(db, `${goalPath}/contributions/c1`), contribution(50000));
    ok.update(doc(db, goalPath), { savedAmount: 50000, lastOpId: "c1", updatedAt: serverTimestamp() });
    await assertSucceeds(ok.commit());

    const bad = writeBatch(db);
    bad.set(doc(db, `${goalPath}/contributions/c2`), contribution(10000));
    bad.update(doc(db, goalPath), { savedAmount: 99999, lastOpId: "c2", updatedAt: serverTimestamp() });
    await assertFails(bad.commit());

    const withdraw = writeBatch(db);
    withdraw.delete(doc(db, `${goalPath}/contributions/c1`));
    withdraw.update(doc(db, goalPath), { savedAmount: 0, lastOpId: "c1", updatedAt: serverTimestamp() });
    await assertSucceeds(withdraw.commit());
  });

  it("rejects negative balances", async () => {
    await assertFails(setDoc(doc(alice(), goalPath), goal({ savedAmount: -1 })));
  });
});
