"use client";

import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpectedIncome } from "@/lib/finance/income";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { formatMoney, minorToInputString, parseAmountToMinor } from "@/lib/money";
import { formatMonth } from "@/lib/months";
import { getErrorMessage } from "@/lib/services/errors";
import { recordRecurringIncome } from "@/lib/services/income.service";
import { useSession } from "@/providers/auth-provider";
import { useAccounts } from "@/providers/finance-provider";

interface RecordRecurringSheetProps {
  expected: ExpectedIncome | null;
  onOpenChange: (open: boolean) => void;
}

/** One-tap confirmation that an expected recurring income (e.g. salary) arrived. */
export function RecordRecurringSheet({ expected, onOpenChange }: RecordRecurringSheetProps) {
  return (
    <ResponsiveModal
      open={expected !== null}
      onOpenChange={onOpenChange}
      title={expected ? `${expected.template.name} received?` : "Mark received"}
      description={expected ? `For ${formatMonth(expected.month)} · expected ${format(expected.expectedAt, "d MMM")}` : undefined}
      preventAutoFocus
    >
      {expected ? <RecordForm key={`${expected.template.id}-${expected.month}`} expected={expected} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function RecordForm({ expected, onDone }: { expected: ExpectedIncome; onDone: () => void }) {
  const { user, currency } = useSession();
  const { accountExists, name } = useAccounts();
  const [amount, setAmount] = useState(() => minorToInputString(expected.template.amount));
  const [receivedOn, setReceivedOn] = useState(() => toDateInputValue(new Date()));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const minor = parseAmountToMinor(amount);
    const receivedAt = fromDateInputValue(receivedOn);
    if (!minor || minor <= 0) return setError("Enter an amount greater than zero");
    if (!receivedAt) return setError("Choose a date");
    receivedAt.setHours(new Date().getHours(), new Date().getMinutes());
    setPending(true);
    try {
      await recordRecurringIncome(user.uid, expected.template, expected.month, {
        amount: minor,
        receivedAt,
        expectedAt: expected.expectedAt,
      }, { accountExists });
      onDone();
      toast.success(`${formatMoney(minor, currency)} ${expected.template.name} recorded`);
    } catch (e) {
      toast.error("Couldn't record income", { description: e instanceof Error && e.name === "AlreadyRecordedError" ? e.message : getErrorMessage(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="record-amount">Amount</Label>
            <MoneyField id="record-amount" value={amount} onValueChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-date">Received on</Label>
            <Input id="record-date" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
        <FieldError message={error} />
        {expected.template.accountId ? (
          <p className="text-sm text-muted-foreground">Will be added to {name(expected.template.accountId)}.</p>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>Mark as received</SubmitButton>
      </SheetFooter>
    </form>
  );
}
