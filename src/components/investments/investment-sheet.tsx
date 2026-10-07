"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AccountPicker } from "@/components/accounts/account-picker";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { INVESTMENT_KIND_LABELS, INVESTMENT_KINDS } from "@/lib/constants/accounts";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { getErrorMessage } from "@/lib/services/errors";
import { createInvestment } from "@/lib/services/investment.service";
import { type InvestmentFormValues, investmentFormSchema } from "@/lib/validation/accounts";
import { NAME_MAX_LENGTH } from "@/lib/validation/finance";
import { toMinor, toMinorOrNull } from "@/lib/validation/money";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";

export function InvestmentSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Add investment" description="Existing holding or a new purchase.">
      {open ? <InvestmentForm onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function InvestmentForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: { name: "", kind: "mutual_fund", institution: "", invested: "", currentValue: "", purchasedOn: toDateInputValue(new Date()), accountId: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const invested = toMinor(values.invested);
    try {
      const { committed } = createInvestment(user.uid, {
        name: values.name,
        kind: values.kind,
        institution: values.institution || null,
        invested,
        currentValue: toMinorOrNull(values.currentValue) ?? invested,
        purchaseDate: fromDateInputValue(values.purchasedOn) ?? new Date(),
        accountId: values.accountId || null,
      });
      const result = await settleQuickly(committed);
      if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
      onDone();
      toast.success(`${values.name.trim()} added`);
    } catch (error) {
      toast.error("Couldn't save investment", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Type</legend>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Investment type" className="flex flex-wrap gap-2">
                {INVESTMENT_KINDS.map((k) => (
                  <label
                    key={k}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      field.value === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <input type="radio" name="investment-kind" value={k} checked={field.value === k} onChange={() => field.onChange(k)} className="sr-only" />
                    {INVESTMENT_KIND_LABELS[k]}
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="investment-name" label="Name" error={errors.name?.message}>
            <Input {...fieldA11y("investment-name", errors.name?.message)} placeholder="Nifty 50 Index" maxLength={NAME_MAX_LENGTH} className="h-11 rounded-xl" {...register("name")} />
          </FormField>
          <FormField id="investment-institution" label="Platform (optional)" error={errors.institution?.message}>
            <Input {...fieldA11y("investment-institution", errors.institution?.message)} placeholder="Zerodha" className="h-11 rounded-xl" {...register("institution")} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="investment-invested" label="Amount invested" error={errors.invested?.message}>
            <Controller
              control={control}
              name="invested"
              render={({ field }) => <MoneyField {...fieldA11y("investment-invested", errors.invested?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.invested)} />}
            />
          </FormField>
          <FormField id="investment-current" label="Current value" error={errors.currentValue?.message}>
            <Controller
              control={control}
              name="currentValue"
              render={({ field }) => <MoneyField {...fieldA11y("investment-current", errors.currentValue?.message)} value={field.value} onValueChange={field.onChange} placeholder="Same" />}
            />
          </FormField>
        </div>
        <FormField id="investment-date" label="Purchase date" error={errors.purchasedOn?.message}>
          <Input {...fieldA11y("investment-date", errors.purchasedOn?.message)} type="date" className="h-11 rounded-xl" {...register("purchasedOn")} />
        </FormField>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <div className="space-y-1">
              <AccountPicker name="investment-account" label="Paid from (new purchases)" value={field.value} onChange={field.onChange} types={["bank", "wallet", "cash"]} />
              <p className="text-xs text-muted-foreground">Leave as None for holdings you bought before using the app.</p>
            </div>
          )}
        />
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>Add investment</SubmitButton>
      </SheetFooter>
    </form>
  );
}
