import { readFileSync } from "node:fs";

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, type Firestore, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-ledger-rules-fitness", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const alice = () => env.authenticatedContext("alice").firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext("bob").firestore() as unknown as Firestore;
const U = "users/alice";

const activity = (patch: Record<string, unknown> = {}) => ({
  name: "Jogging",
  description: "",
  icon: "run",
  color: "orange",
  startDate: "2026-10-01",
  endDate: null,
  schedules: [{ from: "2026-10-01", kind: "daily", days: [], perWeek: null, every: null }],
  reminderEnabled: true,
  reminderTime: "07:00",
  targetDuration: 20,
  targetQuantity: null,
  unit: null,
  multipleEntries: false,
  status: "active",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...patch,
});

const log = (patch: Record<string, unknown> = {}) => ({
  activityId: "jog",
  date: "2026-10-10",
  completedAt: Timestamp.fromDate(new Date("2026-10-10T07:05:00+05:30")),
  durationMin: null,
  quantity: null,
  note: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...patch,
});

describe("fitness activities", () => {
  it("owner can create, update and delete a valid activity", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/fitnessActivities/jog`), activity()));
    await assertSucceeds(
      updateDoc(doc(db, `${U}/fitnessActivities/jog`), {
        schedules: [
          { from: "2026-10-01", kind: "daily", days: [], perWeek: null, every: null },
          { from: "2026-10-11", kind: "weekdays", days: [1, 3, 5], perWeek: null, every: null },
        ],
        status: "paused",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, `${U}/fitnessActivities/jog`)));
  });

  it("other users can't read or write it", async () => {
    await assertSucceeds(setDoc(doc(alice(), `${U}/fitnessActivities/jog`), activity()));
    await assertFails(getDoc(doc(bob(), `${U}/fitnessActivities/jog`)));
    await assertFails(setDoc(doc(bob(), `${U}/fitnessActivities/x`), activity()));
    await assertFails(deleteDoc(doc(bob(), `${U}/fitnessActivities/jog`)));
  });

  it("rejects bad data", async () => {
    const db = alice();
    const ref = doc(db, `${U}/fitnessActivities/a`);
    await assertFails(setDoc(ref, activity({ name: "" })));
    await assertFails(setDoc(ref, activity({ icon: "rocket" })));
    await assertFails(setDoc(ref, activity({ startDate: "2026-13-01" })));
    await assertFails(setDoc(ref, activity({ endDate: "2026-09-01" })));
    await assertFails(setDoc(ref, activity({ reminderTime: "7am" })));
    await assertFails(setDoc(ref, activity({ targetDuration: 0 })));
    await assertFails(setDoc(ref, activity({ status: "deleted" })));
    await assertFails(setDoc(ref, activity({ schedules: [] })));
    await assertFails(setDoc(ref, activity({ schedules: [{ from: "2026-09-01", kind: "daily", days: [], perWeek: null, every: null }] })));
    await assertFails(setDoc(ref, activity({ schedules: [{ from: "2026-10-01", kind: "hourly", days: [], perWeek: null, every: null }] })));
    await assertFails(setDoc(ref, activity({ evil: true })));
    await assertFails(setDoc(ref, activity({ createdAt: Timestamp.now() })));
  });
});

describe("fitness logs", () => {
  beforeEach(async () => {
    await setDoc(doc(alice(), `${U}/fitnessActivities/jog`), activity());
  });

  it("daily check-in ids must match activity and date (idempotent per day)", async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, `${U}/fitnessLogs/jog_2026-10-10`), log()));
    // A second create for the same day is an update with a new createdAt → rejected.
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/jog_2026-10-10`), log()));
    // Id that claims another day.
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/jog_2026-10-09`), log()));
    // Random ids (multi-session activities) are fine.
    await assertSucceeds(setDoc(doc(db, `${U}/fitnessLogs/abcDEF123random`), log()));
  });

  it("edits keep the activity and the id/date pairing", async () => {
    const db = alice();
    const ref = doc(db, `${U}/fitnessLogs/jog_2026-10-10`);
    await setDoc(ref, log());
    await assertSucceeds(updateDoc(ref, { durationMin: 25, note: "Park loop", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { date: "2026-10-09", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { activityId: "other", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { durationMin: -5, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it("requires the activity to exist and belong to the user", async () => {
    await assertFails(setDoc(doc(alice(), `${U}/fitnessLogs/ghost_2026-10-10`), log({ activityId: "ghost" })));
    await assertFails(setDoc(doc(bob(), `${U}/fitnessLogs/jog_2026-10-10`), log()));
    await assertFails(getDoc(doc(bob(), `${U}/fitnessLogs/jog_2026-10-10`)));
  });

  it("validates fields", async () => {
    const db = alice();
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/r1`), log({ date: "10/10/2026" })));
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/r2`), log({ completedAt: "yesterday" })));
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/r3`), log({ note: "x".repeat(281) })));
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/r4`), log({ quantity: 2_000_000 })));
    await assertFails(setDoc(doc(db, `${U}/fitnessLogs/r5`), log({ extra: 1 })));
  });
});
