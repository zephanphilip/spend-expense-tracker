"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/common/money";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Label } from "@/components/ui/label";
import { cardOutstanding } from "@/lib/finance/accounts";
import { minorToInputString, parseAmountToMinor } from "@/lib/money";
import { reconcileBalance } from "@/lib/services/account.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";
import type { Account } from "@/types";

/** Sets the balance to what the bank/app actually shows (adjusts the opening balance). */
export function ReconcileSheet({ account, onOpenChange }: { account: Account | null; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal open={account !== null} onOpenChange={onOpenChange} title="Adjust balance" description="Match what your bank or card app shows. Not recorded as income or spending." preventAutoFocus>
      {account ? <ReconcileForm key={account.id} account={account} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function ReconcileForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const { user } = useSession();
  const isCard = account.type === "credit_card";
  const shown = isCard ? cardOutstanding(account) : Math.abs(account.balance);
  const [value, setValue] = useState(minorToInputString(shown));
  const [negative, setNegative] = useState(isCard ? account.balance > 0 : account.balance < 0);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const minor = parseAmountToMinor(value || "0");
    if (minor === null) return setError("Enter a valid amount");
    const target = isCard ? (negative ? minor : -minor) : negative ? -minor : minor;
    setPending(true);
    try {
      await reconcileBalance(user.uid, account, target);
      onDone();
      toast.success("Balance adjusted");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <p className="text-sm text-muted-foreground">
          Tracked {isCard ? "outstanding" : "balance"}: <Money amount={shown} className="font-medium text-foreground" />
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reconcile-value">{isCard ? "Actual outstanding" : "Actual balance"}</Label>
          <MoneyField id="reconcile-value" value={value} onValueChange={setValue} />
          <FieldError message={error} />
        </div>
        <SwitchField id="reconcile-negative" label={isCard ? "Credit balance (overpaid)" : "Overdrawn"} checked={negative} onCheckedChange={setNegative} />
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>Save</SubmitButton>
      </SheetFooter>
    </form>
  );
}
