"use client";

import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { nextOccurrence } from "@/lib/finance/recurrence";
import { formatMoney, minorToInputString, parseAmountToMinor } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { payRecurring, skipRecurring } from "@/lib/services/recurring-payment.service";
import { useSession } from "@/providers/auth-provider";
import { useAccounts } from "@/providers/finance-provider";
import type { RecurringPayment } from "@/types";

/** Confirms the next occurrence: records the expense (and account debit) and advances the schedule. */
export function PayRecurringSheet({ payment, onOpenChange }: { payment: RecurringPayment | null; onOpenChange: (open: boolean) => void }) {
  const due = payment ? nextOccurrence(payment) : null;
  return (
    <ResponsiveModal
      open={payment !== null}
      onOpenChange={onOpenChange}
      title={payment ? `Pay ${payment.name}` : "Pay"}
      description={due ? `Due ${format(due, "d MMM yyyy")}` : undefined}
      preventAutoFocus
    >
      {payment ? <PayForm key={`${payment.id}-${payment.cycle}`} payment={payment} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function PayForm({ payment, onDone }: { payment: RecurringPayment; onDone: () => void }) {
  const { user, currency } = useSession();
  const { accountExists, name } = useAccounts();
  const [amount, setAmount] = useState(minorToInputString(payment.amount));
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"pay" | "skip" | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const minor = parseAmountToMinor(amount);
    const paidAt = fromDateInputValue(date);
    if (!minor || minor <= 0) return setError("Enter an amount greater than zero");
    if (!paidAt) return setError("Choose a date");
    paidAt.setHours(new Date().getHours(), new Date().getMinutes());
    setPending("pay");
    try {
      await payRecurring(user.uid, payment.id, { paidAt, amount: minor }, { accountExists });
      onDone();
      toast.success(`${formatMoney(minor, currency)} · ${payment.name} paid`);
    } catch (e) {
      toast.error("Couldn't record payment", { description: e instanceof Error && !("code" in e) ? e.message : getErrorMessage(e, "This needs a connection. Try again when you're online.") });
    } finally {
      setPending(null);
    }
  }

  async function onSkip() {
    setPending("skip");
    try {
      await skipRecurring(user.uid, payment.id);
      onDone();
      toast.success(`${payment.name} skipped this time`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <MoneyField id="pay-amount" value={amount} onValueChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Paid on</Label>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
        <FieldError message={error} />
        <p className="text-sm text-muted-foreground">
          Recorded as an expense{payment.accountId ? ` from ${name(payment.accountId)}` : ""}.
        </p>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" className="h-12 rounded-xl px-4" onClick={onSkip} disabled={pending !== null}>
          Skip
        </Button>
        <SubmitButton pending={pending === "pay"}>Mark as paid</SubmitButton>
      </SheetFooter>
    </form>
  );
}
