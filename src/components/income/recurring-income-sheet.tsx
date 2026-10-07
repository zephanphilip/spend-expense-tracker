"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { INCOME_SOURCE_META, INCOME_SOURCES } from "@/lib/constants/income";
import { minorToInputString } from "@/lib/money";
import { monthKey } from "@/lib/months";
import { getErrorMessage } from "@/lib/services/errors";
import {
  createRecurringIncome,
  deleteRecurringIncome,
  updateRecurringIncome,
} from "@/lib/services/income.service";
import { type RecurringIncomeFormValues, recurringIncomeFormSchema } from "@/lib/validation/finance";
import { toMinor } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import { AccountPicker } from "@/components/accounts/account-picker";
import type { RecurringIncome } from "@/types";

interface RecurringIncomeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: RecurringIncome | null;
}

export function RecurringIncomeSheet({ open, onOpenChange, template }: RecurringIncomeSheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={template ? "Edit recurring income" : "New recurring income"}
      description="Shows up each month as expected income you can confirm in one tap."
      preventAutoFocus
    >
      {open ? <RecurringForm template={template ?? null} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function RecurringForm({ template, onDone }: { template: RecurringIncome | null; onDone: () => void }) {
  const { user } = useSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<
    RecurringIncomeFormValues,
    unknown,
    { name: string; source: RecurringIncome["source"]; amount: string; dayOfMonth: number; active: boolean; accountId: string; autoRecord: boolean }
  >({
    resolver: zodResolver(recurringIncomeFormSchema),
    defaultValues: template
      ? {
          name: template.name,
          source: template.source,
          amount: minorToInputString(template.amount),
          dayOfMonth: String(template.dayOfMonth),
          active: template.active,
          accountId: template.accountId ?? "",
          autoRecord: template.autoRecord,
        }
      : { name: "Salary", source: "salary", amount: "", dayOfMonth: "1", active: true, accountId: "", autoRecord: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      name: values.name.trim(),
      source: values.source,
      amount: toMinor(values.amount),
      dayOfMonth: values.dayOfMonth,
      active: values.active,
      startMonth: template?.startMonth ?? monthKey(new Date()),
      accountId: values.accountId || null,
      autoRecord: values.autoRecord,
    };
    try {
      if (template) await settleQuickly(updateRecurringIncome(user.uid, template.id, input));
      else await settleQuickly(createRecurringIncome(user.uid, input).committed);
      onDone();
      toast.success(template ? "Recurring income updated" : "Recurring income added");
    } catch (error) {
      toast.error("Couldn't save", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <FormField id="recurring-name" label="Name" error={errors.name?.message}>
          <Input {...fieldA11y("recurring-name", errors.name?.message)} className="h-11 rounded-xl" {...register("name")} />
        </FormField>
        <Controller
          control={control}
          name="source"
          render={({ field }) => (
            <Segmented
              name="recurring-source"
              label="Income type"
              value={field.value}
              onChange={field.onChange}
              options={INCOME_SOURCES.map((s) => ({ value: s, label: INCOME_SOURCE_META[s].label }))}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="recurring-amount" label="Usual amount" error={errors.amount?.message}>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyField id="recurring-amount" value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.amount)} />
              )}
            />
          </FormField>
          <FormField id="recurring-day" label="Day of month" error={errors.dayOfMonth?.message}>
            <Input
              {...fieldA11y("recurring-day", errors.dayOfMonth?.message)}
              inputMode="numeric"
              className="h-11 rounded-xl"
              {...register("dayOfMonth")}
            />
          </FormField>
        </div>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <AccountPicker name="recurring-account" label="Into account" value={field.value} onChange={field.onChange} types={["bank", "cash", "wallet"]} />
          )}
        />
        <Controller
          control={control}
          name="autoRecord"
          render={({ field }) => (
            <SwitchField
              id="recurring-auto"
              label="Record automatically"
              description="Records the usual amount on the expected day. You can still edit it afterwards."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField
              id="recurring-active"
              label="Active"
              description="Paused incomes stop appearing as expected."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </SheetBody>
      <SheetFooter>
        {template ? (
          <Button type="button" variant="destructive" className="size-12 rounded-xl" onClick={() => setConfirmingDelete(true)} aria-label="Delete recurring income">
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting}>Save</SubmitButton>
      </SheetFooter>
      {template ? (
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={`Stop tracking “${template.name}”?`}
          description="Incomes already recorded from it stay in your history."
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              await settleQuickly(deleteRecurringIncome(user.uid, template.id));
              setConfirmingDelete(false);
              onDone();
              toast.success("Recurring income removed");
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        />
      ) : null}
    </form>
  );
}
