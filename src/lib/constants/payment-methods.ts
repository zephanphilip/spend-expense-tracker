import { Banknote, CreditCard, type LucideIcon, Smartphone, Wallet } from "lucide-react";

export const PAYMENT_METHODS = ["upi", "credit", "debit", "cash"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: LucideIcon }
> = {
  upi: { label: "UPI", icon: Smartphone },
  credit: { label: "Credit", icon: CreditCard },
  debit: { label: "Debit", icon: Wallet },
  cash: { label: "Cash", icon: Banknote },
};

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "upi";

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}
