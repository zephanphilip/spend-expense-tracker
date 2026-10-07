"use client";

import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/common/money";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_META, PAYMENT_METHODS } from "@/lib/constants/payment-methods";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { dueDateFor, splitNextInstallment } from "@/lib/finance/emi";
import { formatMoney } from "@/lib/money";
import { recordEmiPayment, undoLastEmiPayment } from "@/lib/services/emi.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";
import { AccountPicker } from "@/components/accounts/account-picker";
import { useAccounts } from "@/providers/finance-provider";
import type { Emi, PaymentMethod } from "@/types";

interface EmiPaymentSheetProps {
  emi: Emi | null;
  onOpenChange: (open: boolean) => void;
}

export function EmiPaymentSheet({ emi, onOpenChange }: EmiPaymentSheetProps) {
  return (
    <ResponsiveModal
      open={emi !== null}
      onOpenChange={onOpenChange}
      title={emi ? `Pay ${emi.name}` : "Record payment"}
      description={emi ? `Installment ${emi.paidCount + 1} of ${emi.tenureMonths} · due ${format(dueDateFor(emi.startDate, emi.paidCount + 1), "d MMM yyyy")}` : undefined}
      preventAutoFocus
    >
      {emi ? <PaymentForm key={`${emi.id}-${emi.paidCount}`} emi={emi} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function PaymentForm({ emi, onDone }: { emi: Emi; onDone: () => void }) {
  const { user, currency } = useSession();
  const split = splitNextInstallment(emi);
  const [paidOn, setPaidOn] = useState(() => toDateInputValue(new Date()));
  const [logExpense, setLogExpense] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("debit");
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState(() => accounts.active.find((a) => a.type === "bank")?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const paidAt = fromDateInputValue(paidOn);
    if (!paidAt) return setError("Choose a date");
    paidAt.setHours(new Date().getHours(), new Date().getMinutes());
    setPending(true);
    try {
      const payment = await recordEmiPayment(user.uid, emi.id, { paidAt, logExpense, paymentMethod: method, accountId: accountId || null });
      onDone();
      const done = payment.installment >= emi.tenureMonths;
      toast.success(done ? `🎉 ${emi.name} fully repaid` : `${formatMoney(payment.amount, currency)} paid · ${emi.name}`, {
        description: [accountId ? `Paid from ${accounts.name(accountId)}.` : null, logExpense ? "Counted in spending." : null]
          .filter(Boolean)
          .join(" ") || undefined,
        action: {
          label: "Undo",
          onClick: () =>
            void undoLastEmiPayment(user.uid, emi.id, { accountExists: accounts.accountExists }).catch((e) => toast.error(getErrorMessage(e))),
        },
      });
    } catch (e) {
      toast.error("Couldn't record payment", {
        description: e instanceof Error && !("code" in e) ? e.message : getErrorMessage(e, "Recording a payment needs a connection. Try again when you're online."),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="rounded-2xl bg-muted/60 p-4 text-center">
          <p className="text-3xl font-semibold tracking-tight">
            <Money amount={split.amount} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Principal <Money amount={split.principalPart} /> · Interest <Money amount={split.interestPart} />
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="emi-paid-on">Paid on</Label>
          <Input id="emi-paid-on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="h-11 rounded-xl" />
          <FieldError message={error} />
        </div>
        <AccountPicker
          name="emi-account"
          label="Paid from"
          value={accountId}
          onChange={setAccountId}
          types={["bank", "wallet", "cash"]}
        />
        <SwitchField
          id="emi-log-expense"
          label="Count in spending"
          description="Adds the installment to expenses (EMI category) for budgets. Your account is debited once either way."
          checked={logExpense}
          onCheckedChange={setLogExpense}
        />
        {logExpense ? (
          <Segmented
            name="emi-method"
            label="Paid with"
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_META[m].label, icon: PAYMENT_METHOD_META[m].icon }))}
          />
        ) : null}
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>Record payment</SubmitButton>
      </SheetFooter>
    </form>
  );
}
