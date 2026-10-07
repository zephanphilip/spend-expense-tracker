import { type DocumentReference, increment, serverTimestamp } from "firebase/firestore";

import type { BalanceEffect } from "@/lib/finance/ledger";

import { accountDoc } from "./paths";

type Update = (ref: DocumentReference, data: Record<string, unknown>) => unknown;

/**
 * Applies balance effects inside a batch or transaction (`update` = batch.update / tx.update).
 * Increments keep this offline-safe and race-free; `lastOpId` is a unique per-write stamp
 * (ledger document id + random suffix) so Security Rules can tell a ledger write happened,
 * even when the same document is edited repeatedly. `extra` merges other fields per account
 * (e.g. card statement dues) into the same single update.
 */
export function applyBalanceEffects(
  update: Update,
  uid: string,
  effects: BalanceEffect[],
  opId: string,
  {
    accountExists = () => true,
    extra = {},
  }: { accountExists?: (id: string) => boolean; extra?: Record<string, Record<string, unknown>> } = {},
): void {
  const stamp = `${opId}:${Math.random().toString(36).slice(2, 10)}`;
  for (const effect of effects) {
    // Skip accounts that were deleted; history keeps the reference but there's nothing to update.
    if (!accountExists(effect.accountId)) continue;
    update(accountDoc(uid, effect.accountId), {
      balance: increment(effect.delta),
      lastOpId: stamp,
      updatedAt: serverTimestamp(),
      ...(extra[effect.accountId] ?? {}),
    });
  }
}

export type AccountExists = (id: string) => boolean;
