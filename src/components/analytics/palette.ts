import type { InvestmentKind, PaymentMethod } from "@/types";

/** Validated categorical palette (light/dark steps live in CSS; these are the light values). */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"] as const;
export const OTHER_COLOR = "var(--series-previous)";

/** Fixed slot per payment method — colour follows the entity, never its rank. */
export const METHOD_COLORS: Record<PaymentMethod, string> = { upi: SERIES[0], credit: SERIES[1], debit: SERIES[2], cash: SERIES[3] };

export const KIND_COLORS: Record<InvestmentKind, string> = {
  mutual_fund: SERIES[0],
  stock: SERIES[1],
  fd: SERIES[2],
  gold: SERIES[3],
  crypto: SERIES[4],
  other: OTHER_COLOR,
};
