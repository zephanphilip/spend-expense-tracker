"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AccountPicker } from "@/components/accounts/account-picker";
import { Money } from "@/components/common/money";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { applySell } from "@/lib/finance/investments";
import { formatMoney, minorToInputString, parseAmountToMinor } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { recordInvestmentTx } from "@/lib/services/investment.service";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useAccounts } from "@/providers/finance-provider";
import type { Investment, InvestmentTxKind } from "@/types";

interface Props {
  investment: Investment | null;
  kind: InvestmentTxKind;
  onOpenChange: (open: boolean) => void;
}

const TITLES: Record<InvestmentTxKind, string> = { BUY: "Invest more", SELL: "Sell / redeem", VALUATION: "Update value" };

export function InvestmentTxSheet({ investment, kind, onOpenChange }: Props) {
  return (
    <ResponsiveModal open={investment !== null} onOpenChange={onOpenChange} title={investment?.name ?? "Investment"} preventAutoFocus>
      {investment ? <TxForm key={`${investment.id}-${kind}`} investment={investment} initialKind={kind} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function TxForm({ investment, initialKind, onDone }: { investment: Investment; initialKind: InvestmentTxKind; onDone: () => void }) {
  const { user, currency } = useSession();
  const accounts = useAccounts();
  const [kind, setKind] = useState<InvestmentTxKind>(initialKind);
  const [amount, setAmount] = useState(initialKind === "VALUATION" ? minorToInputString(investment.currentValue) : "");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [accountId, setAccountId] = useState(() => accounts.active.find((a) => a.type === "bank")?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const minor = parseAmountToMinor(amount) ?? 0;
  const sellPreview = kind === "SELL" && minor > 0 && minor <= investment.currentValue ? applySell(investment, minor) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (kind !== "VALUATION" && minor <= 0) return setError("Enter an amount greater than zero");
    if (kind === "SELL" && minor > investment.currentValue) return setError(`You can sell up to ${formatMoney(investment.currentValue, currency)}`);
    const occurredAt = fromDateInputValue(date) ?? new Date();
    occurredAt.setHours(new Date().getHours(), new Date().getMinutes());
    setPending(true);
    try {
      const { realized } = await recordInvestmentTx(
        user.uid,
        investment.id,
        { kind, amount: minor, accountId: accountId || null, note, occurredAt },
        { accountExists: accounts.accountExists },
      );
      onDone();
      toast.success(
        kind === "VALUATION"
          ? `Value updated to ${formatMoney(minor, currency)}`
          : kind === "BUY"
            ? `${formatMoney(minor, currency)} invested`
            : `${formatMoney(minor, currency)} redeemed${realized !== null ? ` · ${realized >= 0 ? "gain" : "loss"} ${formatMoney(Math.abs(realized), currency)}` : ""}`,
      );
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error && !("code" in e) ? e.message : getErrorMessage(e, "This needs a connection. Try again when you're online.") });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <Segmented<InvestmentTxKind>
          name="investment-tx-kind"
          label="Action"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAmount(k === "VALUATION" ? minorToInputString(investment.currentValue) : "");
          }}
          options={[
            { value: "BUY", label: "Invest" },
            { value: "SELL", label: "Sell" },
            { value: "VALUATION", label: "Value" },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Invested <Money amount={investment.investedAmount} className="font-medium text-foreground" /> · Current value{" "}
          <Money amount={investment.currentValue} className="font-medium text-foreground" />
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-amount">{kind === "VALUATION" ? "Current value" : kind === "BUY" ? "Amount" : "Amount received"}</Label>
            <MoneyField id="inv-amount" value={amount} onValueChange={setAmount} invalid={Boolean(error)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-date">Date</Label>
            <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
        <FieldError message={error} />
        {sellPreview ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            Cost basis removed <Money amount={sellPreview.costBasis} /> ·{" "}
            <span className={cn("font-medium", sellPreview.realized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {sellPreview.realized >= 0 ? "Gain" : "Loss"} <Money amount={Math.abs(sellPreview.realized)} />
            </span>
            {sellPreview.closed ? " · closes this holding" : ""}
          </p>
        ) : null}
        {kind !== "VALUATION" ? (
          <AccountPicker
            name="inv-account"
            label={kind === "BUY" ? "Paid from" : "Received into"}
            value={accountId}
            onChange={setAccountId}
            types={["bank", "wallet", "cash"]}
          />
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="inv-note">Note (optional)</Label>
          <Input id="inv-note" value={note} maxLength={NOTE_MAX_LENGTH} onChange={(e) => setNote(e.target.value)} className="h-11 rounded-xl" />
        </div>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>{TITLES[kind]}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
