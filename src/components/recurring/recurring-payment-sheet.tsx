"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AccountPicker } from "@/components/accounts/account-picker";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { CategoryPicker } from "@/components/expenses/category-picker";
import { PaymentMethodPicker } from "@/components/expenses/payment-method-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { frequencyLabel, nextOccurrence } from "@/lib/finance/recurrence";
import { minorToInputString } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { createRecurringPayment, deleteRecurringPayment, updateRecurringPayment } from "@/lib/services/recurring-payment.service";
import { type RecurringPaymentFormValues, recurringPaymentFormSchema } from "@/lib/validation/accounts";
import { NAME_MAX_LENGTH } from "@/lib/validation/finance";
import { toMinor } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { RecurringPayment, RecurringPaymentInput } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: RecurringPayment | null;
}

export function RecurringPaymentSheet({ open, onOpenChange, payment }: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={payment ? "Edit recurring payment" : "New recurring payment"} preventAutoFocus>
      {open ? <Form payment={payment ?? null} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function frequencyOf(p: RecurringPayment): RecurringPaymentFormValues["frequency"] {
  if (p.interval === 1 && (p.unit === "week" || p.unit === "month" || p.unit === "year")) return p.unit;
  return "custom";
}

function Form({ payment, onDone }: { payment: RecurringPayment | null; onDone: () => void }) {
  const { user } = useSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const next = payment ? nextOccurrence({ ...payment, active: true }) : null;
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecurringPaymentFormValues>({
    resolver: zodResolver(recurringPaymentFormSchema),
    defaultValues: payment
      ? {
          name: payment.name,
          amount: minorToInputString(payment.amount),
          categoryId: payment.categoryId,
          paymentMethod: payment.paymentMethod,
          accountId: payment.accountId ?? "",
          frequency: frequencyOf(payment),
          customUnit: payment.unit,
          customInterval: String(payment.interval),
          // Editing shows the *next* due date; saving keeps the schedule unless it changes.
          startOn: toDateInputValue(payment.startDate),
          endOn: payment.endDate ? toDateInputValue(payment.endDate) : "",
          active: payment.active,
          autoPay: payment.autoPay,
        }
      : {
          name: "",
          amount: "",
          categoryId: "",
          paymentMethod: "upi",
          accountId: "",
          frequency: "month",
          customUnit: "day",
          customInterval: "14",
          startOn: toDateInputValue(new Date()),
          endOn: "",
          active: true,
          autoPay: false,
        },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- conditional fields + live label.
  const [frequency, customUnit, customInterval] = watch(["frequency", "customUnit", "customInterval"]);

  const onSubmit = handleSubmit(async (values) => {
    const custom = values.frequency === "custom";
    const input: RecurringPaymentInput = {
      name: values.name.trim(),
      amount: toMinor(values.amount),
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod,
      accountId: values.accountId || null,
      unit: custom ? values.customUnit : values.frequency === "custom" ? "month" : values.frequency,
      interval: custom ? Number(values.customInterval) : 1,
      startDate: fromDateInputValue(values.startOn) ?? new Date(),
      endDate: fromDateInputValue(values.endOn) ?? null,
      active: values.active,
      autoPay: values.autoPay,
    };
    try {
      if (payment) await settleQuickly(updateRecurringPayment(user.uid, payment, input));
      else await settleQuickly(createRecurringPayment(user.uid, input).committed);
      onDone();
      toast.success(payment ? "Recurring payment updated" : `${input.name} added · ${frequencyLabel(input.unit, input.interval)}`);
    } catch (error) {
      toast.error("Couldn't save", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="rp-name" label="Name" error={errors.name?.message}>
            <Input {...fieldA11y("rp-name", errors.name?.message)} placeholder="Netflix" maxLength={NAME_MAX_LENGTH} className="h-11 rounded-xl" {...register("name")} />
          </FormField>
          <FormField id="rp-amount" label="Amount" error={errors.amount?.message}>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => <MoneyField {...fieldA11y("rp-amount", errors.amount?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.amount)} />}
            />
          </FormField>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-muted-foreground">Repeats</legend>
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <Segmented
                name="rp-frequency"
                label="Frequency"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "week", label: "Weekly" },
                  { value: "month", label: "Monthly" },
                  { value: "year", label: "Yearly" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            )}
          />
          {frequency === "custom" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Every</span>
              <Input aria-label="Interval" inputMode="numeric" className="h-11 w-20 rounded-xl" {...register("customInterval")} />
              <select
                aria-label="Unit"
                className="h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-base md:text-sm dark:bg-input/30"
                {...register("customUnit")}
              >
                <option value="day">days</option>
                <option value="week">weeks</option>
                <option value="month">months</option>
                <option value="year">years</option>
              </select>
            </div>
          ) : null}
          <FieldError message={errors.customInterval?.message} />
          {frequency === "custom" && Number(customInterval) >= 1 ? (
            <p className="text-xs text-muted-foreground">{frequencyLabel(customUnit, Number(customInterval))}</p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="rp-start" label={payment ? "Schedule start" : "Next payment"} error={errors.startOn?.message}>
            <Input {...fieldA11y("rp-start", errors.startOn?.message)} type="date" className="h-11 rounded-xl" {...register("startOn")} />
          </FormField>
          <FormField id="rp-end" label="Ends (optional)" error={errors.endOn?.message}>
            <Input {...fieldA11y("rp-end", errors.endOn?.message)} type="date" className="h-11 rounded-xl" {...register("endOn")} />
          </FormField>
        </div>
        {payment && next ? <p className="-mt-3 text-xs text-muted-foreground">Next due {next.toLocaleDateString()}. Changing the start date or frequency restarts the schedule.</p> : null}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Category</legend>
          <Controller control={control} name="categoryId" render={({ field }) => <CategoryPicker name="rp-category" value={field.value} onChange={field.onChange} invalid={Boolean(errors.categoryId)} />} />
          <FieldError message={errors.categoryId?.message} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Paid with</legend>
          <Controller control={control} name="paymentMethod" render={({ field }) => <PaymentMethodPicker name="rp-method" value={field.value} onChange={field.onChange} />} />
        </fieldset>
        <Controller control={control} name="accountId" render={({ field }) => <AccountPicker name="rp-account" label="From account / card" value={field.value} onChange={field.onChange} />} />
        <Controller
          control={control}
          name="autoPay"
          render={({ field }) => (
            <SwitchField
              id="rp-auto"
              label="Record automatically"
              description="Adds the expense on each due date when you open the app — never twice for the same occurrence."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => <SwitchField id="rp-active" label="Active" description="Paused payments don't appear as upcoming." checked={field.value} onCheckedChange={field.onChange} />}
        />
      </SheetBody>
      <SheetFooter>
        {payment ? (
          <Button type="button" variant="destructive" className="size-12 rounded-xl" onClick={() => setConfirmingDelete(true)} aria-label="Delete recurring payment">
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting}>Save</SubmitButton>
      </SheetFooter>
      {payment ? (
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={`Delete ${payment.name}?`}
          description="Past payments stay in your expenses."
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              await settleQuickly(deleteRecurringPayment(user.uid, payment.id));
              setConfirmingDelete(false);
              onDone();
              toast.success("Recurring payment deleted");
            } catch (e) {
              toast.error(getErrorMessage(e));
            }
          }}
        />
      ) : null}
    </form>
  );
}
