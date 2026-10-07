"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Label } from "@/components/ui/label";
import { suggestedMinimumDue } from "@/lib/finance/accounts";
import { minorToInputString } from "@/lib/money";
import { updateCardStatement } from "@/lib/services/account.service";
import { getErrorMessage } from "@/lib/services/errors";
import { toMinorOrNull } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { Account } from "@/types";

/** Records the latest statement's billed amount and minimum due. */
export function StatementSheet({ card, onOpenChange }: { card: Account | null; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal open={card !== null} onOpenChange={onOpenChange} title="Update statement" description="From your latest card statement." preventAutoFocus>
      {card ? <StatementForm key={card.id} card={card} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function StatementForm({ card, onDone }: { card: Account; onDone: () => void }) {
  const { user } = useSession();
  const [statement, setStatement] = useState(card.statementBalance ? minorToInputString(card.statementBalance) : "");
  const [minimum, setMinimum] = useState(card.minimumDue ? minorToInputString(card.minimumDue) : "");
  const [pending, setPending] = useState(false);
  const statementMinor = toMinorOrNull(statement);
  const suggestion = statementMinor ? suggestedMinimumDue(statementMinor) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await updateCardStatement(user.uid, card.id, {
        statementBalance: statementMinor,
        minimumDue: toMinorOrNull(minimum) ?? suggestion,
      });
      onDone();
      toast.success("Statement updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="statement-balance">Statement amount</Label>
            <MoneyField id="statement-balance" value={statement} onValueChange={setStatement} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statement-minimum">Minimum due</Label>
            <MoneyField id="statement-minimum" value={minimum} onValueChange={setMinimum} placeholder={suggestion ? minorToInputString(suggestion) : "Auto"} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Leave minimum due blank to use 5% of the statement (at least ₹200).</p>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>Save statement</SubmitButton>
      </SheetFooter>
    </form>
  );
}
