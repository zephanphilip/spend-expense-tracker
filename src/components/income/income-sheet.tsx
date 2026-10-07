"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { AmountInput } from "@/components/expenses/amount-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleQuickly } from "@/lib/async";
import { INCOME_SOURCE_META, INCOME_SOURCES } from "@/lib/constants/income";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { currencySymbol, formatMoney, fractionDigits, minorToInputString, sanitizeAmountInput } from "@/lib/money";
import { monthKey } from "@/lib/months";
import { getErrorMessage } from "@/lib/services/errors";
import { createIncome, deleteIncome, updateIncome } from "@/lib/services/income.service";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import { type IncomeFormValues, incomeFormSchema } from "@/lib/validation/finance";
import { toMinor } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import { AccountPicker } from "@/components/accounts/account-picker";
import { useAccounts } from "@/providers/finance-provider";
import type { Income, IncomeInput, IncomeSource } from "@/types";

interface IncomeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit an existing income; omit to add. */
  income?: Income | null;
  defaultSource?: IncomeSource;
}

export function IncomeSheet({ open, onOpenChange, income, defaultSource }: IncomeSheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={income ? "Edit income" : "Add income"}
      hideHeader={!income}
      preventAutoFocus={Boolean(income)}
    >
      {open ? (
        <IncomeForm income={income ?? null} defaultSource={defaultSource} onDone={() => onOpenChange(false)} />
      ) : null}
    </ResponsiveModal>
  );
}

function initialValues(income: Income | null, source: IncomeSource): IncomeFormValues {
  const now = new Date();
  if (income) {
    return {
      amount: minorToInputString(income.amount),
      source: income.source,
      receivedOn: toDateInputValue(income.receivedAt),
      forMonth: income.forMonth,
      expectedOn: income.expectedAt ? toDateInputValue(income.expectedAt) : "",
      note: income.note,
      repeatMonthly: false,
      accountId: income.accountId ?? "",
    };
  }
  return {
    amount: "",
    source,
    receivedOn: toDateInputValue(now),
    forMonth: monthKey(now),
    expectedOn: "",
    note: "",
    repeatMonthly: false,
    accountId: "",
  };
}

function IncomeForm({ income, defaultSource = "salary", onDone }: { income: Income | null; defaultSource?: IncomeSource; onDone: () => void }) {
  const { user, currency } = useSession();
  const accounts = useAccounts();
  const [defaults] = useState(() => {
    const values = initialValues(income, defaultSource);
    // New income lands in your first bank account by default (if you have one).
    if (!income) values.accountId = accounts.active.find((a) => a.type === "bank")?.id ?? "";
    return values;
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isEdit = income !== null;

  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<IncomeFormValues>({ resolver: zodResolver(incomeFormSchema), defaultValues: defaults });

  // eslint-disable-next-line react-hooks/incompatible-library -- drives conditional fields only.
  const [source, receivedOn, expectedOn] = watch(["source", "receivedOn", "expectedOn"]);
  const repeatDay = fromDateInputValue(expectedOn) ?? fromDateInputValue(receivedOn) ?? null;
  const isSalary = source === "salary";

  const onSubmit = handleSubmit(async (values) => {
    const receivedAt = fromDateInputValue(values.receivedOn) ?? new Date();
    // Keep the original time of day when editing; otherwise stamp "now" on the chosen date.
    const base = income?.receivedAt ?? new Date();
    receivedAt.setHours(base.getHours(), base.getMinutes(), 0, 0);
    const expectedAt = values.source === "salary" ? fromDateInputValue(values.expectedOn) ?? null : null;
    const input: IncomeInput = {
      amount: toMinor(values.amount),
      source: values.source,
      note: values.note.trim(),
      receivedAt,
      forMonth: values.source === "salary" ? values.forMonth : monthKey(receivedAt),
      expectedAt,
      recurringId: income?.recurringId ?? null,
      accountId: values.accountId || null,
    };
    const ledger = { accountExists: accounts.accountExists };
    const label = `${formatMoney(input.amount, currency)} ${INCOME_SOURCE_META[input.source].label.toLowerCase()}`;
    try {
      if (isEdit) {
        await settleQuickly(updateIncome(user.uid, income, input, ledger));
        onDone();
        toast.success("Income updated");
        return;
      }
      const repeat = values.repeatMonthly
        ? {
            name: input.note || INCOME_SOURCE_META[input.source].label,
            dayOfMonth: (expectedAt ?? receivedAt).getDate(),
          }
        : undefined;
      const { id, committed } = createIncome(user.uid, input, repeat, ledger);
      const result = await settleQuickly(committed);
      if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
      onDone();
      toast.success(`${label} added`, {
        description: repeat ? `Repeats monthly on day ${repeat.dayOfMonth}.` : undefined,
        action: repeat
          ? undefined
          : {
              label: "Undo",
              onClick: () =>
                void deleteIncome(user.uid, { ...input, id, accountId: input.accountId ?? null }, ledger).catch((e) =>
                  toast.error(getErrorMessage(e)),
                ),
            },
      });
    } catch (error) {
      toast.error("Couldn't save income", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="space-y-2 pt-2">
          <Label htmlFor="income-amount" className="sr-only">
            Amount
          </Label>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <AmountInput
                id="income-amount"
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(raw) => field.onChange(sanitizeAmountInput(raw, fractionDigits(currency)))}
                currencySymbol={currencySymbol(currency)}
                invalid={Boolean(errors.amount)}
                autoFocus={!isEdit}
                className="text-emerald-600 dark:text-emerald-400"
              />
            )}
          />
          <FieldError message={errors.amount?.message} />
        </div>

        <Controller
          control={control}
          name="source"
          render={({ field }) => (
            <Segmented
              name="income-source"
              label="Income type"
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                if (value === "salary" && !dirtyFields.forMonth) {
                  const received = fromDateInputValue(getValues("receivedOn"));
                  if (received) setValue("forMonth", monthKey(received));
                }
              }}
              options={INCOME_SOURCES.map((s) => ({ value: s, label: INCOME_SOURCE_META[s].label }))}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="income-received">Received on</Label>
            <Input id="income-received" type="date" className="h-11 rounded-xl" {...register("receivedOn")} />
            <FieldError message={errors.receivedOn?.message} />
          </div>
          {isSalary ? (
            <div className="space-y-1.5">
              <Label htmlFor="income-for-month">Salary for</Label>
              <Input id="income-for-month" type="month" className="h-11 rounded-xl" {...register("forMonth")} />
              <FieldError message={errors.forMonth?.message} />
            </div>
          ) : null}
        </div>

        {isSalary ? (
          <div className="space-y-1.5">
            <Label htmlFor="income-expected">
              Expected on <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="income-expected" type="date" className="h-11 rounded-xl" {...register("expectedOn")} />
            <p className="text-xs text-muted-foreground">Used to track whether salary arrives on time.</p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="income-note">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="income-note"
            placeholder={isSalary ? "e.g. Acme Corp" : "What was it for?"}
            maxLength={NOTE_MAX_LENGTH}
            className="h-11 rounded-xl"
            {...register("note")}
          />
          <FieldError message={errors.note?.message} />
        </div>

        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <AccountPicker
              name="income-account"
              label="Into account"
              value={field.value}
              onChange={field.onChange}
              types={["bank", "cash", "wallet"]}
            />
          )}
        />

        {!isEdit ? (
          <Controller
            control={control}
            name="repeatMonthly"
            render={({ field }) => (
              <SwitchField
                id="income-repeat"
                label="Repeats every month"
                description={`We'll remind you each month and you can confirm it in one tap${field.value && repeatDay ? ` (around the ${format(repeatDay, "do")})` : ""}.`}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        ) : null}
      </SheetBody>
      <SheetFooter>
        {isEdit ? (
          <Button
            type="button"
            variant="destructive"
            className="size-12 rounded-xl"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete income"
          >
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting}>{isEdit ? "Save changes" : "Save income"}</SubmitButton>
      </SheetFooter>
      {income ? (
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title="Delete this income?"
          description={`${formatMoney(income.amount, currency)} will be removed from your totals.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              await settleQuickly(deleteIncome(user.uid, income, { accountExists: accounts.accountExists }));
              setConfirmingDelete(false);
              onDone();
              toast.success("Income deleted");
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        />
      ) : null}
    </form>
  );
}
