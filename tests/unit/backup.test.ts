import { describe, expect, it } from "vitest";

import { BACKUP_COLLECTIONS, type BackupCollection, decodeValue, encodeValue, planRestore, validateBackup } from "@/lib/backup/format";
import { fingerprint } from "@/lib/csv/import";

const d = new Date(2026, 9, 1, 20, 5);
const file = (collections: Record<string, unknown[]>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: "ledger", version: 1, createdAt: d.toISOString(), profile: { displayName: "Asha", currency: "INR" }, collections, ...extra });
const expense = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  data: encodeValue({ type: "EXPENSE", amount: 45000, categoryId: "food", paymentMethod: "upi", note: "Dinner", occurredAt: d, accountId: null, createdAt: d, lastOpId: "x", ...patch }),
});
const noIds = Object.fromEntries(BACKUP_COLLECTIONS.map((c) => [c, new Set<string>()])) as unknown as Record<BackupCollection, Set<string>>;

describe("backup encoding", () => {
  it("round-trips dates and nested values", () => {
    const v = { a: d, b: [d, 1], c: { e: d, f: "x" }, g: null };
    expect(decodeValue(JSON.parse(JSON.stringify(encodeValue(v))))).toEqual(v);
  });
  it("encodes Firestore-like timestamps", () => {
    expect(encodeValue({ toDate: () => d })).toEqual({ $date: d.toISOString() });
  });
});

describe("backup validation", () => {
  it("rejects non-JSON, foreign files and newer versions", () => {
    expect(validateBackup("{nope").issues[0].message).toBe("Not valid JSON.");
    expect(validateBackup(JSON.stringify({ hello: 1 })).issues[0].message).toContain("isn't a Spend backup");
    expect(validateBackup(file({}, { version: 99 })).issues[0].message).toContain("newer than this app supports");
  });

  it("validates each document strictly and strips server fields", () => {
    const v = validateBackup(
      file({
        expenses: [
          expense("e1"),
          expense("e2", { amount: -5 }),
          expense("e3", { evil: "<script>" }),
          expense("e1"),
          { id: "bad/id", data: {} },
        ],
        budgets: [{ id: "2026-10", data: { month: "2026-09", overall: 100, categories: {} } }],
        emiPayments: [{ id: "1", data: encodeValue({ installment: 1, amount: 10, principalPart: 6, interestPart: 4, dueDate: d, paidAt: d, expenseId: null }) }],
        mystery: [],
      }),
    );
    expect(v.docs.expenses.map((x) => x.id)).toEqual(["e1"]);
    expect(v.docs.expenses[0].data).not.toHaveProperty("createdAt");
    expect(v.docs.expenses[0].data).not.toHaveProperty("lastOpId");
    expect(v.docs.expenses[0].data.occurredAt).toEqual(d);
    const messages = v.issues.map((i) => `${i.collection}:${i.id ?? ""}:${i.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        "file::Unknown collection “mystery” ignored.",
        expect.stringMatching(/^expenses:e2:amount/),
        expect.stringMatching(/^expenses:e3:/),
        "expenses:e1:Duplicate id inside the backup; kept the first.",
        "expenses::Malformed entry skipped.",
        "budgets:2026-10:Budget id must equal its month.",
        "emiPayments:1:Missing parent id.",
      ]),
    );
    expect(v.profile).toEqual({ displayName: "Asha", currency: "INR" });
  });
});

describe("restore planning", () => {
  it("never overwrites existing ids and skips content duplicates", () => {
    const v = validateBackup(file({ expenses: [expense("e1"), expense("e2", { note: "Lunch" }), expense("e3", { note: "Taxi" })] }));
    const plan = planRestore(v, {
      ids: { ...noIds, expenses: new Set(["e1"]) },
      contentKeys: { expenses: new Set([fingerprint(d, 45000, "Lunch")]) },
    });
    const e = plan.find((p) => p.collection === "expenses")!;
    expect(e.toCreate.map((x) => x.id)).toEqual(["e3"]);
    expect(e.existing).toBe(1);
    expect(e.duplicates).toBe(1);
  });

  it("keys sub-collection ids by parent", () => {
    const pay = { installment: 1, amount: 10, principalPart: 6, interestPart: 4, dueDate: d, paidAt: d, expenseId: null };
    const v = validateBackup(file({ emiPayments: [{ id: "1", parentId: "loanA", data: encodeValue(pay) }, { id: "1", parentId: "loanB", data: encodeValue(pay) }] }));
    const plan = planRestore(v, { ids: { ...noIds, emiPayments: new Set(["loanA/1"]) }, contentKeys: {} });
    expect(plan.find((p) => p.collection === "emiPayments")!.toCreate.map((x) => x.parentId)).toEqual(["loanB"]);
  });
});
