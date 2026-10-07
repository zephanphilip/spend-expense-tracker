"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Money } from "@/components/common/money";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { goalProgress } from "@/lib/finance/goals";
import { formatMoney } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { addContribution, InsufficientSavingsError } from "@/lib/services/goal.service";
import { NOTE_MAX_LENGTH } from "@/lib/validation/expense";
import { type ContributionFormValues, contributionFormSchema } from "@/lib/validation/finance";
import { toMinor } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { Goal } from "@/types";

interface ContributionSheetProps {
  goal: Goal | null;
  direction?: "add" | "withdraw";
  onOpenChange: (open: boolean) => void;
}

export function ContributionSheet({ goal, direction = "add", onOpenChange }: ContributionSheetProps) {
  return (
    <ResponsiveModal
      open={goal !== null}
      onOpenChange={onOpenChange}
      title={goal ? goal.name : "Add money"}
    >
      {goal ? <ContributionForm key={`${goal.id}-${direction}`} goal={goal} direction={direction} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function ContributionForm({ goal, direction, onDone }: { goal: Goal; direction: "add" | "withdraw"; onDone: () => void }) {
  const { user, currency } = useSession();
  const progress = goalProgress(goal);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: { direction, amount: "", contributedOn: toDateInputValue(new Date()), note: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const minor = toMinor(values.amount);
    if (values.direction === "withdraw" && minor > goal.savedAmount) {
      setError("amount", { message: `You've saved ${formatMoney(goal.savedAmount, currency)} so far` });
      return;
    }
    const contributedAt = fromDateInputValue(values.contributedOn) ?? new Date();
    contributedAt.setHours(new Date().getHours(), new Date().getMinutes());
    try {
      await addContribution(user.uid, goal.id, {
        amount: values.direction === "add" ? minor : -minor,
        note: values.note,
        contributedAt,
      });
      onDone();
      const reached = values.direction === "add" && goal.savedAmount + minor >= goal.targetAmount && !progress.achieved;
      toast.success(
        reached
          ? `🎉 You've reached your goal for ${goal.name}!`
          : `${formatMoney(minor, currency)} ${values.direction === "add" ? "saved towards" : "withdrawn from"} ${goal.name}`,
      );
    } catch (error) {
      toast.error("Couldn't save", {
        description: error instanceof InsufficientSavingsError ? error.message : getErrorMessage(error, "Saving needs a connection. Try again when you're online."),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <p className="text-sm text-muted-foreground">
          <Money amount={goal.savedAmount} className="font-medium text-foreground" /> saved of <Money amount={goal.targetAmount} />
          {progress.remaining > 0 ? (
            <>
              {" · "}
              <Money amount={progress.remaining} /> to go
            </>
          ) : null}
        </p>
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <Segmented
              name="contribution-direction"
              label="Add or withdraw"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "add", label: "Add money", icon: Plus },
                { value: "withdraw", label: "Withdraw", icon: Minus },
              ]}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="contribution-amount" label="Amount" error={errors.amount?.message}>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyField {...fieldA11y("contribution-amount", errors.amount?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.amount)} autoFocus />
              )}
            />
          </FormField>
          <FormField id="contribution-date" label="Date" error={errors.contributedOn?.message}>
            <Input {...fieldA11y("contribution-date", errors.contributedOn?.message)} type="date" className="h-11 rounded-xl" {...register("contributedOn")} />
          </FormField>
        </div>
        <FormField id="contribution-note" label="Note (optional)" error={errors.note?.message}>
          <Input {...fieldA11y("contribution-note", errors.note?.message)} maxLength={NOTE_MAX_LENGTH} className="h-11 rounded-xl" {...register("note")} />
        </FormField>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>Save</SubmitButton>
      </SheetFooter>
    </form>
  );
}
