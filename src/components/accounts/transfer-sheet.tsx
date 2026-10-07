"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Money } from "@/components/common/money";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { cardOutstanding } from "@/lib/finance/accounts";
import { formatMoney, minorToInputString } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { createTransfer, deleteTransfer } from "@/lib/services/transfer.service";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import { type TransferFormValues, transferFormSchema } from "@/lib/validation/accounts";
import { toMinor } from "@/lib/validation/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useAccounts } from "@/providers/finance-provider";
import type { Account } from "@/types";

import { AccountPicker } from "./account-picker";

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect the source account. */
  from?: Account | null;
  /** Pay a credit card: destination fixed to this card, with amount presets. */
  payCard?: Account | null;
}

export function TransferSheet({ open, onOpenChange, from, payCard }: TransferSheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={payCard ? `Pay ${payCard.name}` : "Transfer money"}
      description={payCard ? "Reduces the card's outstanding. Not counted as spending." : "Between your own accounts. Not counted as spending."}
      preventAutoFocus
    >
      {open ? <TransferForm from={from ?? null} payCard={payCard ?? null} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function TransferForm({ from, payCard, onDone }: { from: Account | null; payCard: Account | null; onDone: () => void }) {
  const { user, currency } = useSession();
  const accounts = useAccounts();
  const firstBank = accounts.active.find((a) => a.type !== "credit_card" && a.id !== payCard?.id);
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: from?.id ?? firstBank?.id ?? "",
      toAccountId: payCard?.id ?? "",
      amount: "",
      occurredOn: toDateInputValue(new Date()),
      note: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- live pickers/preview.
  const [fromId, toId] = watch(["fromAccountId", "toAccountId"]);
  const source = accounts.get(fromId);
  const presets = payCard
    ? [
        { label: "Minimum due", amount: payCard.minimumDue ?? 0 },
        { label: "Statement", amount: payCard.statementBalance ?? 0 },
        { label: "Full outstanding", amount: cardOutstanding(payCard) },
      ].filter((p) => p.amount > 0)
    : [];

  const onSubmit = handleSubmit(async (values) => {
    const src = accounts.get(values.fromAccountId);
    const dst = accounts.get(values.toAccountId);
    if (!src || !dst) return;
    const amount = toMinor(values.amount);
    const occurredAt = fromDateInputValue(values.occurredOn) ?? new Date();
    occurredAt.setHours(new Date().getHours(), new Date().getMinutes());
    try {
      const { id, committed } = createTransfer(user.uid, { from: src, to: dst, amount, note: values.note, occurredAt });
      const result = await settleQuickly(committed);
      if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
      onDone();
      const isPayment = dst.type === "credit_card";
      toast.success(isPayment ? `${formatMoney(amount, currency)} paid to ${dst.name}` : `${formatMoney(amount, currency)} moved to ${dst.name}`, {
        action: {
          label: "Undo",
          onClick: () =>
            void deleteTransfer(
              user.uid,
              { id, type: isPayment ? "DEBT_PAYMENT" : "TRANSFER", amount, fromAccountId: src.id, toAccountId: dst.id, emiId: null, emiInstallment: null, note: "", occurredAt, createdAt: occurredAt },
              accounts.accountExists,
            ).catch((e) => toast.error(getErrorMessage(e))),
        },
      });
    } catch (error) {
      toast.error("Couldn't save transfer", { description: getErrorMessage(error) });
    }
  });

  if (accounts.active.length < 2) {
    return (
      <SheetBody>
        <p className="text-sm text-muted-foreground">Add at least two accounts to move money between them.</p>
      </SheetBody>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <Controller
          control={control}
          name="fromAccountId"
          render={({ field }) => (
            <AccountPicker name="transfer-from" label="From" value={field.value} onChange={field.onChange} allowNone={false} exclude={toId} types={payCard ? ["bank", "wallet", "cash"] : undefined} />
          )}
        />
        <FieldError message={errors.fromAccountId?.message} />
        {source ? (
          <p className="-mt-3 text-xs text-muted-foreground">
            Balance <Money amount={source.balance} />
          </p>
        ) : null}
        {!payCard ? (
          <>
            <div className="flex justify-center text-muted-foreground" aria-hidden>
              <ArrowDown className="size-5" />
            </div>
            <Controller
              control={control}
              name="toAccountId"
              render={({ field }) => (
                <AccountPicker name="transfer-to" label="To" value={field.value} onChange={field.onChange} allowNone={false} exclude={fromId} />
              )}
            />
            <FieldError message={errors.toAccountId?.message} />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <FormField id="transfer-amount" label="Amount" error={errors.amount?.message}>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => <MoneyField {...fieldA11y("transfer-amount", errors.amount?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.amount)} />}
            />
          </FormField>
          <FormField id="transfer-date" label="Date" error={errors.occurredOn?.message}>
            <Input {...fieldA11y("transfer-date", errors.occurredOn?.message)} type="date" className="h-11 rounded-xl" {...register("occurredOn")} />
          </FormField>
        </div>
        {presets.length ? (
          <div className="-mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setValue("amount", minorToInputString(p.amount), { shouldValidate: true })}
                className={cn("inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-medium outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50")}
              >
                {p.label} · <Money amount={p.amount} />
              </button>
            ))}
          </div>
        ) : null}
        <FormField id="transfer-note" label="Note (optional)" error={errors.note?.message}>
          <Input {...fieldA11y("transfer-note", errors.note?.message)} maxLength={NOTE_MAX_LENGTH} className="h-11 rounded-xl" {...register("note")} />
        </FormField>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>{payCard ? "Record payment" : "Transfer"}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
