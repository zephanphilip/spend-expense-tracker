"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Money } from "@/components/common/money";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { computeEmi, dueDateFor } from "@/lib/finance/emi";
import { minorToInputString, parseAmountToMinor } from "@/lib/money";
import { createEmi, EmiTermsLockedError, updateEmi } from "@/lib/services/emi.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type EmiFormValues, emiFormSchema } from "@/lib/validation/finance";
import { toMinor, toMinorOrNull } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { Emi, EmiInput } from "@/types";

interface EmiSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emi?: Emi | null;
  onCreated?: (id: string) => void;
}

export function EmiSheet({ open, onOpenChange, emi, onCreated }: EmiSheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={emi ? "Edit loan" : "Add a loan / EMI"}
      description={emi && emi.paidCount > 0 ? "Terms are locked once payments are recorded." : "We'll calculate the EMI from the rate and tenure."}
      preventAutoFocus
    >
      {open ? (
        <EmiForm
          emi={emi ?? null}
          onDone={(id) => {
            onOpenChange(false);
            if (id) onCreated?.(id);
          }}
        />
      ) : null}
    </ResponsiveModal>
  );
}

const bpsFromRate = (rate: string) => Math.round(Number(rate || 0) * 100);

function EmiForm({ emi, onDone }: { emi: Emi | null; onDone: (id?: string) => void }) {
  const { user } = useSession();
  const locked = Boolean(emi && emi.paidCount > 0);
  const [defaults] = useState<EmiFormValues>(() =>
    emi
      ? {
          name: emi.name,
          lender: emi.lender ?? "",
          principal: minorToInputString(emi.principal),
          rate: String(emi.annualRateBps / 100),
          tenureMonths: String(emi.tenureMonths),
          monthlyAmount: minorToInputString(emi.monthlyAmount),
          startOn: toDateInputValue(emi.startDate),
          alreadyPaid: String(emi.paidCount),
        }
      : { name: "", lender: "", principal: "", rate: "", tenureMonths: "", monthlyAmount: "", startOn: toDateInputValue(new Date()), alreadyPaid: "" },
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmiFormValues>({ resolver: zodResolver(emiFormSchema), defaultValues: defaults });

  // eslint-disable-next-line react-hooks/incompatible-library -- live calculation preview only.
  const [principal, rate, tenure, monthly, startOn] = watch(["principal", "rate", "tenureMonths", "monthlyAmount", "startOn"]);
  const principalMinor = parseAmountToMinor(principal) ?? 0;
  const tenureMonths = Number(tenure) || 0;
  const computed = computeEmi(principalMinor, bpsFromRate(rate), tenureMonths);
  const effectiveMonthly = toMinorOrNull(monthly) ?? computed;
  const start = fromDateInputValue(startOn);
  const canPreview = principalMinor > 0 && tenureMonths > 0 && effectiveMonthly > 0;

  const onSubmit = handleSubmit(async (values) => {
    const input: EmiInput = {
      name: values.name.trim(),
      lender: values.lender.trim() || null,
      principal: toMinor(values.principal),
      annualRateBps: bpsFromRate(values.rate),
      tenureMonths: Number(values.tenureMonths),
      monthlyAmount:
        toMinorOrNull(values.monthlyAmount) ??
        computeEmi(toMinor(values.principal), bpsFromRate(values.rate), Number(values.tenureMonths)),
      startDate: fromDateInputValue(values.startOn) ?? new Date(),
    };
    try {
      if (emi) {
        await updateEmi(user.uid, emi.id, input);
        onDone();
        toast.success("Loan updated");
      } else {
        const { id, committed } = createEmi(user.uid, input, Number(values.alreadyPaid || 0));
        const result = await settleQuickly(committed);
        if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
        onDone(id);
        toast.success(`${input.name} added`);
      }
    } catch (error) {
      toast.error("Couldn't save loan", {
        description: error instanceof EmiTermsLockedError ? error.message : getErrorMessage(error),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="emi-name" label="Name" error={errors.name?.message}>
            <Input {...fieldA11y("emi-name", errors.name?.message)} placeholder="Car loan" className="h-11 rounded-xl" {...register("name")} />
          </FormField>
          <FormField id="emi-lender" label="Lender (optional)" error={errors.lender?.message}>
            <Input {...fieldA11y("emi-lender", errors.lender?.message)} placeholder="HDFC" className="h-11 rounded-xl" {...register("lender")} />
          </FormField>
        </div>

        <fieldset disabled={locked} className="space-y-5 disabled:opacity-60">
          <FormField id="emi-principal" label="Loan amount (principal)" error={errors.principal?.message}>
            <Controller
              control={control}
              name="principal"
              render={({ field }) => (
                <MoneyField {...fieldA11y("emi-principal", errors.principal?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.principal)} />
              )}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="emi-rate" label="Interest (% p.a.)" error={errors.rate?.message}>
              <Input {...fieldA11y("emi-rate", errors.rate?.message)} inputMode="decimal" placeholder="10.5" className="h-11 rounded-xl" {...register("rate")} />
            </FormField>
            <FormField id="emi-tenure" label="Tenure (months)" error={errors.tenureMonths?.message}>
              <Input {...fieldA11y("emi-tenure", errors.tenureMonths?.message)} inputMode="numeric" placeholder="60" className="h-11 rounded-xl" {...register("tenureMonths")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="emi-start" label="First EMI date" error={errors.startOn?.message}>
              <Input {...fieldA11y("emi-start", errors.startOn?.message)} type="date" className="h-11 rounded-xl" {...register("startOn")} />
            </FormField>
            <FormField id="emi-monthly" label="Monthly EMI" error={errors.monthlyAmount?.message}>
              <Controller
                control={control}
                name="monthlyAmount"
                render={({ field }) => (
                  <MoneyField
                    {...fieldA11y("emi-monthly", errors.monthlyAmount?.message)}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={computed ? minorToInputString(computed) : "Auto"}
                  />
                )}
              />
            </FormField>
          </div>
          {!emi ? (
            <FormField id="emi-paid" label="Installments already paid" error={errors.alreadyPaid?.message}>
              <Input {...fieldA11y("emi-paid", errors.alreadyPaid?.message)} inputMode="numeric" placeholder="0" className="h-11 rounded-xl" {...register("alreadyPaid")} />
            </FormField>
          ) : null}
        </fieldset>

        {canPreview ? (
          <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-3 text-center text-xs">
            <div>
              <dt className="text-muted-foreground">EMI</dt>
              <dd className="mt-0.5 text-sm font-semibold"><Money amount={effectiveMonthly} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total interest</dt>
              <dd className="mt-0.5 text-sm font-semibold"><Money amount={Math.max(effectiveMonthly * tenureMonths - principalMinor, 0)} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ends</dt>
              <dd className="mt-0.5 text-sm font-semibold">{start ? format(dueDateFor(start, tenureMonths), "MMM yyyy") : "—"}</dd>
            </div>
          </dl>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>{emi ? "Save changes" : "Add loan"}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
