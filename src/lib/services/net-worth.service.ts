import { limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";

import type { NetWorth } from "@/lib/finance/net-worth";
import type { MonthKey, NetWorthSnapshot } from "@/types";

import { netWorthConverter } from "./converters";
import { netWorthCol, netWorthDoc } from "./paths";

export function subscribeNetWorthHistory(
  uid: string,
  onData: (items: NetWorthSnapshot[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(netWorthCol(uid), orderBy("month", "desc"), limit(24)).withConverter(netWorthConverter);
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data()).reverse()), onError);
}

/** Upserts this month's snapshot (one per month; the latest values win). */
export function saveNetWorthSnapshot(uid: string, month: MonthKey, nw: NetWorth): Promise<void> {
  return setDoc(netWorthDoc(uid, month), {
    month,
    assets: nw.assets.total,
    liabilities: nw.liabilities.total,
    netWorth: nw.netWorth,
    updatedAt: serverTimestamp(),
  });
}
