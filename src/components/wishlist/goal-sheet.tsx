"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/categories/category-icon";
import { ColorPicker, IconPicker } from "@/components/categories/icon-color-fields";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { fromDateInputValue, toDateInputValue } from "@/lib/dates";
import { minorToInputString } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { createGoal, updateGoal } from "@/lib/services/goal.service";
import { type GoalFormValues, goalFormSchema, NAME_MAX_LENGTH } from "@/lib/validation/finance";
import { toMinor, toMinorOrNull } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { Goal, GoalInput } from "@/types";

interface GoalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}

export function GoalSheet({ open, onOpenChange, goal }: GoalSheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? "Edit wish" : "New wish"}
      description={goal ? undefined : "Something you're saving up for."}
      preventAutoFocus={Boolean(goal)}
    >
      {open ? <GoalForm goal={goal ?? null} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const { user } = useSession();
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal
      ? {
          name: goal.name,
          icon: goal.icon,
          color: goal.color,
          targetAmount: minorToInputString(goal.targetAmount),
          targetOn: goal.targetDate ? toDateInputValue(goal.targetDate) : "",
          initialSaved: "",
        }
      : { name: "", icon: "phone", color: "violet", targetAmount: "", targetOn: "", initialSaved: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- live icon preview only.
  const [icon, color] = watch(["icon", "color"]);

  const onSubmit = handleSubmit(async (values) => {
    const input: GoalInput = {
      name: values.name.trim(),
      icon: values.icon,
      color: values.color,
      targetAmount: toMinor(values.targetAmount),
      targetDate: fromDateInputValue(values.targetOn) ?? null,
    };
    try {
      if (goal) {
        await settleQuickly(updateGoal(user.uid, goal.id, input));
        toast.success("Wish updated");
      } else {
        const { committed } = createGoal(user.uid, input, toMinorOrNull(values.initialSaved) ?? 0);
        const result = await settleQuickly(committed);
        if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
        toast.success(`“${input.name}” added to your wishlist`);
      }
      onDone();
    } catch (error) {
      toast.error("Couldn't save", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="flex items-end gap-3">
          <CategoryIcon category={{ icon, color }} size="lg" />
          <div className="flex-1">
            <FormField id="goal-name" label="What do you want?" error={errors.name?.message}>
              <Input
                {...fieldA11y("goal-name", errors.name?.message)}
                placeholder="New phone"
                maxLength={NAME_MAX_LENGTH}
                autoFocus={!goal}
                className="h-11 rounded-xl"
                {...register("name")}
              />
            </FormField>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="goal-target" label="Target amount" error={errors.targetAmount?.message}>
            <Controller
              control={control}
              name="targetAmount"
              render={({ field }) => (
                <MoneyField {...fieldA11y("goal-target", errors.targetAmount?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.targetAmount)} />
              )}
            />
          </FormField>
          <FormField id="goal-date" label="By (optional)" error={errors.targetOn?.message}>
            <Input {...fieldA11y("goal-date", errors.targetOn?.message)} type="date" className="h-11 rounded-xl" {...register("targetOn")} />
          </FormField>
        </div>
        {!goal ? (
          <FormField id="goal-initial" label="Already saved (optional)" error={errors.initialSaved?.message}>
            <Controller
              control={control}
              name="initialSaved"
              render={({ field }) => (
                <MoneyField {...fieldA11y("goal-initial", errors.initialSaved?.message)} value={field.value} onValueChange={field.onChange} />
              )}
            />
          </FormField>
        ) : null}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Icon</legend>
          <Controller control={control} name="icon" render={({ field }) => <IconPicker name="goal-icon" value={field.value} onChange={field.onChange} />} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <Controller control={control} name="color" render={({ field }) => <ColorPicker name="goal-color" value={field.value} onChange={field.onChange} />} />
        </fieldset>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>{goal ? "Save changes" : "Add wish"}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
