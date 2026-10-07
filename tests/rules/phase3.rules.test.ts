import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  type Firestore,
  increment,
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
    projectId: "demo-ledger-rules-p3",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const alice = () => env.authenticatedContext("alice").firestore() as unknown as Firestore;
const U = "users/alice";

const account = (patch: Record<string, unknown> = {}) => ({
  name: "HDFC Savings",
  type: "bank",
  institution: "HDFC",
  openingBalance: 10000000,
  balance: 10000000,
  active: true,
  creditLimit: null,
  statementDay: null,
  dueDay: null,
  statementBalance: null,
  minimumDue: null,
  lastOpId: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...patch,
});
const card = (patch: Record<string, unknown> = {}) =>
  account({ name: "Amex", type: "credit_card", openingBalance: -500000, balance: -500000, creditLimit: 20000000, statementDay: 20, dueDay: 8, ...patch });

const expense = (patch: Record<string, unknown> = {}) => ({
  type: "EXPENSE",
  amount: 25000,
  categoryId: "food",
  paymentMethod: "upi",
  note: "",
  occurredAt: Timestamp.now(),
  accountId: "bank",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...patch,
});

const debit = (db: Firestore, id: string, delta: number, opId: string, batch = writeBatch(db)) => {
  // Unique per write, like the service's stamp.
  batch.update(doc(db, `${U}/accounts/${id}`), {
    balance: increment(delta),
    lastOpId: `${opId}:${Math.random().toString(36).slice(2)}`,
    updatedAt: serverTimestamp(),
  });
  return batch;
};

async function seedAccounts() {
  await assertSucceeds(setDoc(doc(alice(), `${U}/accounts/bank`), account()));
  await assertSucceeds(setDoc(doc(alice(), `${U}/accounts/wallet`), account({ name: "Paytm", type: "wallet", openingBalance: 0, balance: 0 })));
  await assertSucceeds(setDoc(doc(alice(), `${U}/accounts/card`), card()));
}

describe("accounts", () => {
  it("creates with balance = opening balance; card fields only on cards", async () => {
    await assertSucceeds(setDoc(doc(alice(), `${U}/accounts/a1`), account()));
    await assertFails(setDoc(doc(alice(), `${U}/accounts/a2`), account({ balance: 999 })));
    await assertFails(setDoc(doc(alice(), `${U}/accounts/a3`), account({ creditLimit: 100 })));
    await assertSucceeds(setDoc(doc(alice(), `${U}/accounts/c1`), card()));
    await assertFails(setDoc(doc(env.authenticatedContext("bob").firestore(), `${U}/accounts/x`), account()));
  });

  it("blocks direct balance edits but allows reconciliation and metadata changes", async () => {
    await seedAccounts();
    const db = alice();
    await assertFails(updateDoc(doc(db, `${U}/accounts/bank`), { balance: 999999999, updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(doc(db, `${U}/accounts/bank`), { openingBalance: increment(500), balance: increment(500), updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db, `${U}/accounts/bank`), { name: "Salary account", active: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `${U}/accounts/bank`), { type: "cash", updatedAt: serverTimestamp() }));
  });
});

describe("expenses linked to accounts", () => {
  beforeEach(seedAccounts);

  it("must debit the account by exactly the amount", async () => {
    const db = alice();
    const ok = debit(db, "bank", -25000, "e1");
    ok.set(doc(db, `${U}/expenses/e1`), expense());
    await assertSucceeds(ok.commit());

    const wrong = debit(db, "bank", -1, "e2");
    wrong.set(doc(db, `${U}/expenses/e2`), expense());
    await assertFails(wrong.commit());

    await assertFails(setDoc(doc(db, `${U}/expenses/e3`), expense())); // no balance update
  });

  it("card spending increases the card's debt", async () => {
    const db = alice();
    const b = debit(db, "card", -25000, "e1");
    b.set(doc(db, `${U}/expenses/e1`), expense({ accountId: "card", paymentMethod: "credit" }));
    await assertSucceeds(b.commit());
  });

  it("edits adjust by the difference; switching accounts refunds one and debits the other", async () => {
    const db = alice();
    const create = debit(db, "bank", -25000, "e1");
    create.set(doc(db, `${U}/expenses/e1`), expense());
    await assertSucceeds(create.commit());

    const bump = debit(db, "bank", -5000, "e1");
    bump.update(doc(db, `${U}/expenses/e1`), { amount: 30000, updatedAt: serverTimestamp() });
    await assertSucceeds(bump.commit());

    const sw = writeBatch(db);
    debit(db, "bank", 30000, "e1", sw);
    debit(db, "wallet", -30000, "e1", sw);
    sw.update(doc(db, `${U}/expenses/e1`), { accountId: "wallet", updatedAt: serverTimestamp() });
    await assertSucceeds(sw.commit());

    const del = debit(db, "wallet", 30000, "e1");
    del.delete(doc(db, `${U}/expenses/e1`));
    await assertSucceeds(del.commit());
  });

  it("deleting without refunding the account is rejected", async () => {
    const db = alice();
    const create = debit(db, "bank", -25000, "e1");
    create.set(doc(db, `${U}/expenses/e1`), expense());
    await assertSucceeds(create.commit());
    await assertFails(deleteDoc(doc(db, `${U}/expenses/e1`)));
  });

  it("keeps Phase 1 documents (no type/accountId) valid", async () => {
    const db = alice();
    const legacy = expense();
    delete (legacy as Record<string, unknown>).type;
    delete (legacy as Record<string, unknown>).accountId;
    await assertSucceeds(setDoc(doc(db, `${U}/expenses/old`), legacy));
    await assertSucceeds(updateDoc(doc(db, `${U}/expenses/old`), { amount: 1, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db, `${U}/expenses/old`)));
    await assertFails(setDoc(doc(db, `${U}/expenses/bad`), { ...legacy, type: "TRANSFER" }));
  });

  it("allows cleaning up history of a deleted account", async () => {
    const db = alice();
    const create = debit(db, "bank", -25000, "e1");
    create.set(doc(db, `${U}/expenses/e1`), expense());
    await assertSucceeds(create.commit());
    await assertSucceeds(deleteDoc(doc(db, `${U}/accounts/bank`)));
    await assertSucceeds(deleteDoc(doc(db, `${U}/expenses/e1`)));
  });
});

describe("transfers and card payments", () => {
  beforeEach(seedAccounts);
  const transfer = (patch: Record<string, unknown> = {}) => ({
    type: "TRANSFER",
    amount: 100000,
    fromAccountId: "bank",
    toAccountId: "wallet",
    emiId: null,
    emiInstallment: null,
    note: "",
    occurredAt: Timestamp.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...patch,
  });

  it("moves both sides by the amount", async () => {
    const db = alice();
    const b = writeBatch(db);
    b.set(doc(db, `${U}/transfers/t1`), transfer());
    debit(db, "bank", -100000, "t1", b);
    debit(db, "wallet", 100000, "t1", b);
    await assertSucceeds(b.commit());
  });

  it("rejects one-sided, mismatched or same-account transfers", async () => {
    const db = alice();
    const oneSided = writeBatch(db);
    oneSided.set(doc(db, `${U}/transfers/t1`), transfer());
    debit(db, "bank", -100000, "t1", oneSided);
    await assertFails(oneSided.commit());

    const mismatch = writeBatch(db);
    mismatch.set(doc(db, `${U}/transfers/t2`), transfer());
    debit(db, "bank", -100000, "t2", mismatch);
    debit(db, "wallet", 90000, "t2", mismatch);
    await assertFails(mismatch.commit());

    await assertFails(setDoc(doc(db, `${U}/transfers/t3`), transfer({ toAccountId: "bank" })));
  });

  it("card payment is a DEBT_PAYMENT: bank down, card debt down", async () => {
    const db = alice();
    const pay = writeBatch(db);
    pay.set(doc(db, `${U}/transfers/p1`), transfer({ type: "DEBT_PAYMENT", toAccountId: "card", amount: 500000 }));
    debit(db, "bank", -500000, "p1", pay);
    pay.update(doc(db, `${U}/accounts/card`), { balance: increment(500000), lastOpId: "p1:x", statementBalance: 0, minimumDue: 0, updatedAt: serverTimestamp() });
    await assertSucceeds(pay.commit());

    // A plain TRANSFER into a card, or a DEBT_PAYMENT into a bank account, is rejected.
    const wrongType = writeBatch(db);
    wrongType.set(doc(db, `${U}/transfers/p2`), transfer({ toAccountId: "card" }));
    debit(db, "bank", -100000, "p2", wrongType);
    debit(db, "card", 100000, "p2", wrongType);
    await assertFails(wrongType.commit());

    const notACard = writeBatch(db);
    notACard.set(doc(db, `${U}/transfers/p3`), transfer({ type: "DEBT_PAYMENT" }));
    debit(db, "bank", -100000, "p3", notACard);
    debit(db, "wallet", 100000, "p3", notACard);
    await assertFails(notACard.commit());
  });

  it("only note/date are editable; delete must reverse both sides", async () => {
    const db = alice();
    const b = writeBatch(db);
    b.set(doc(db, `${U}/transfers/t1`), transfer());
    debit(db, "bank", -100000, "t1", b);
    debit(db, "wallet", 100000, "t1", b);
    await assertSucceeds(b.commit());

    await assertSucceeds(updateDoc(doc(db, `${U}/transfers/t1`), { note: "Rent share", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `${U}/transfers/t1`), { amount: 1, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, `${U}/transfers/t1`)));

    const undo = writeBatch(db);
    undo.delete(doc(db, `${U}/transfers/t1`));
    debit(db, "bank", 100000, "t1", undo);
    debit(db, "wallet", -100000, "t1", undo);
    await assertSucceeds(undo.commit());
  });
});

describe("EMI payment from an account", () => {
  const loan = {
    name: "Car",
    lender: null,
    principal: 50000000,
    annualRateBps: 900,
    monthlyAmount: 1037918,
    tenureMonths: 60,
    startDate: Timestamp.now(),
    paidCount: 0,
    outstanding: 50000000,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const payment = (patch: Record<string, unknown> = {}) => ({
    installment: 1,
    amount: 1037918,
    principalPart: 662918,
    interestPart: 375000,
    dueDate: Timestamp.now(),
    paidAt: Timestamp.now(),
    expenseId: null,
    accountId: "bank",
    createdAt: serverTimestamp(),
    ...patch,
  });

  beforeEach(async () => {
    await seedAccounts();
    await assertSucceeds(setDoc(doc(alice(), `${U}/emis/l1`), loan));
  });

  it("records payment + DEBT_PAYMENT + account debit together", async () => {
    const db = alice();
    const b = writeBatch(db);
    b.set(doc(db, `${U}/emis/l1/payments/1`), payment());
    b.update(doc(db, `${U}/emis/l1`), { paidCount: 1, outstanding: 50000000 - 662918, updatedAt: serverTimestamp() });
    b.set(doc(db, `${U}/transfers/emi_l1_1`), {
      type: "DEBT_PAYMENT", amount: 1037918, fromAccountId: "bank", toAccountId: null, emiId: "l1", emiInstallment: 1,
      note: "", occurredAt: Timestamp.now(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    debit(db, "bank", -1037918, "emi_l1_1", b);
    await assertSucceeds(b.commit());
  });

  it("rejects an account-linked payment without its DEBT_PAYMENT", async () => {
    const db = alice();
    const b = writeBatch(db);
    b.set(doc(db, `${U}/emis/l1/payments/1`), payment());
    b.update(doc(db, `${U}/emis/l1`), { paidCount: 1, updatedAt: serverTimestamp() });
    await assertFails(b.commit());
  });
});

describe("investments", () => {
  beforeEach(seedAccounts);
  const inv = (patch: Record<string, unknown> = {}) => ({
    name: "Nifty 50 index",
    kind: "mutual_fund",
    institution: null,
    investedAmount: 1000000,
    currentValue: 1000000,
    realizedGain: 0,
    purchaseDate: Timestamp.now(),
    lastValuedAt: Timestamp.now(),
    status: "active",
    lastOpId: "buy1",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...patch,
  });
  const tx = (patch: Record<string, unknown> = {}) => ({
    investmentId: "i1",
    type: "INVESTMENT",
    kind: "BUY",
    amount: 1000000,
    costBasis: null,
    accountId: "bank",
    note: "",
    occurredAt: Timestamp.now(),
    createdAt: serverTimestamp(),
    ...patch,
  });

  async function create() {
    const db = alice();
    const b = writeBatch(db);
    b.set(doc(db, `${U}/investments/i1`), inv());
    b.set(doc(db, `${U}/investmentTransactions/buy1`), tx());
    debit(db, "bank", -1000000, "buy1", b);
    await assertSucceeds(b.commit());
    return db;
  }

  it("buys debit the account and raise invested/current", async () => {
    await create();
  });

  it("sell must remove the stated cost basis and credit the account", async () => {
    const db = await create();
    await assertSucceeds(updateDoc(doc(db, `${U}/investments/i1`), { currentValue: 1000000, updatedAt: serverTimestamp() })); // no-op valid
    const sell = writeBatch(db);
    sell.set(doc(db, `${U}/investmentTransactions/s1`), tx({ kind: "SELL", amount: 250000, costBasis: 250000 }));
    sell.update(doc(db, `${U}/investments/i1`), { investedAmount: 750000, currentValue: 750000, lastOpId: "s1", updatedAt: serverTimestamp() });
    debit(db, "bank", 250000, "s1", sell);
    await assertSucceeds(sell.commit());

    const bad = writeBatch(db);
    bad.set(doc(db, `${U}/investmentTransactions/s2`), tx({ kind: "SELL", amount: 100000, costBasis: 100000 }));
    bad.update(doc(db, `${U}/investments/i1`), { investedAmount: 750000, currentValue: 650000, lastOpId: "s2", updatedAt: serverTimestamp() });
    debit(db, "bank", 100000, "s2", bad);
    await assertFails(bad.commit());
  });

  it("valuation changes current value only, without moving cash", async () => {
    const db = await create();
    const v = writeBatch(db);
    v.set(doc(db, `${U}/investmentTransactions/v1`), tx({ kind: "VALUATION", amount: 1200000, accountId: null }));
    v.update(doc(db, `${U}/investments/i1`), { currentValue: 1200000, lastOpId: "v1", updatedAt: serverTimestamp() });
    await assertSucceeds(v.commit());
    await assertFails(updateDoc(doc(db, `${U}/investments/i1`), { currentValue: 5, updatedAt: serverTimestamp() }));
  });
});

describe("recurring payments and net worth", () => {
  const rp = {
    name: "Netflix",
    amount: 64900,
    categoryId: "entertainment",
    paymentMethod: "credit",
    accountId: null,
    unit: "month",
    interval: 1,
    startDate: Timestamp.now(),
    cycle: 0,
    nextDate: Timestamp.now(),
    endDate: null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  it("advances one cycle at a time", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/recurringPayments/r1`), rp));
    await assertSucceeds(updateDoc(doc(db, `${U}/recurringPayments/r1`), { cycle: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `${U}/recurringPayments/r1`), { cycle: 5, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, `${U}/recurringPayments/r2`), { ...rp, cycle: 3 }));
    await assertFails(setDoc(doc(db, `${U}/recurringPayments/r3`), { ...rp, unit: "fortnight" }));
  });

  it("net worth snapshot must be consistent", async () => {
    const db = alice();
    const snap = { month: "2026-10", assets: 1000, liabilities: 300, netWorth: 700, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, `${U}/netWorth/2026-10`), snap));
    await assertFails(setDoc(doc(db, `${U}/netWorth/2026-11`), { ...snap, month: "2026-11", netWorth: 999 }));
    await assertFails(setDoc(doc(db, `${U}/netWorth/2026-12`), snap));
  });
});

describe("phase 4: monthly stats and imports", () => {
  it("stats documents are owner-only and shape-checked; increments merge", async () => {
    const db = alice();
    await assertSucceeds(
      setDoc(
        doc(db, `${U}/monthlyStats/2026-10`),
        { month: "2026-10", expenseTotal: increment(500), expenseCount: increment(1), byCategory: { food: increment(500) }, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
    await assertSucceeds(
      setDoc(doc(db, `${U}/monthlyStats/2026-10`), { month: "2026-10", byCategory: { food: increment(-500) }, updatedAt: serverTimestamp() }, { merge: true }),
    );
    await assertFails(setDoc(doc(db, `${U}/monthlyStats/2026-10`), { month: "2026-11", updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(db, `${U}/monthlyStats/2026-10`), { month: "2026-10", hacked: true, updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(db, `${U}/monthlyStats/2026-10`), { month: "2026-10", byCategory: "nope", updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(
      setDoc(doc(env.authenticatedContext("bob").firestore(), `${U}/monthlyStats/2026-10`), { month: "2026-10", updatedAt: serverTimestamp() }),
    );
  });

  it("imported expenses may carry an importId; import logs only change status", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/expenses/imp1`), expense({ accountId: null, importId: "import1" })));
    const log = {
      type: "expenses", fileName: "bank.csv", total: 10, imported: 8, skipped: 2, duplicates: 1, invalid: 1,
      status: "completed", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db, `${U}/imports/import1`), log));
    await assertSucceeds(updateDoc(doc(db, `${U}/imports/import1`), { status: "undone", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `${U}/imports/import1`), { total: 99, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, `${U}/imports/import1`)));
  });
});
