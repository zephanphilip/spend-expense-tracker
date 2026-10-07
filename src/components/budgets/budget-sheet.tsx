"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/categories/category-icon";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { settleQuickly } from "@/lib/async";
import { minorToInputString } from "@/lib/money";
import { formatMonth } from "@/lib/months";
import { deleteBudget, saveBudget } from "@/lib/services/budget.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type BudgetFormValues, budgetFormSchema } from "@/lib/validation/finance";
import { toMinorOrNull } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import type { Budget, MonthKey } from "@/types";

interface BudgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: MonthKey;
  /** Budget in effect for the month (own or carried over), used as the starting values. */
  current: Budget | null;
  /** True when `current` is the month's own document (so it can be removed). */
  hasOwnBudget: boolean;
}

export function BudgetSheet(props: BudgetSheetProps) {
  return (
    <ResponsiveModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Budget for ${formatMonth(props.month)}`}
      description="Leave a field blank for no limit. Budgets carry forward to later months."
      preventAutoFocus
    >
      {props.open ? <BudgetForm {...props} /> : null}
    </ResponsiveModal>
  );
}

function BudgetForm({ month, current, hasOwnBudget, onOpenChange }: BudgetSheetProps) {
  const { user } = useSession();
  const { categories } = useCategories();
  const toInput = (minor: number | null | undefined) => (minor ? minorToInputString(minor) : "");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      overall: toInput(current?.overall),
      categories: Object.fromEntries(categories.map((c) => [c.id, toInput(current?.categories[c.id])])),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const limits: Record<string, number> = {};
    for (const [id, value] of Object.entries(values.categories)) {
      const minor = toMinorOrNull(value);
      if (minor) limits[id] = minor;
    }
    // Keep limits for archived categories that aren't shown in the form.
    for (const [id, minor] of Object.entries(current?.categories ?? {})) {
      if (!categories.some((c) => c.id === id)) limits[id] = minor;
    }
    try {
      await settleQuickly(saveBudget(user.uid, month, { overall: toMinorOrNull(values.overall), categories: limits }));
      onOpenChange(false);
      toast.success(`Budget saved for ${formatMonth(month)}`);
    } catch (error) {
      toast.error("Couldn't save budget", { description: getErrorMessage(error) });
    }
  });

  async function onRemove() {
    try {
      await settleQuickly(deleteBudget(user.uid, month));
      onOpenChange(false);
      toast.success(`${formatMonth(month)} now uses the previous month's budget`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <div className="space-y-2">
          <Label htmlFor="budget-overall">Overall monthly budget</Label>
          <Controller
            control={control}
            name="overall"
            render={({ field }) => (
              <MoneyField
                id="budget-overall"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.overall)}
              />
            )}
          />
          <FieldError message={errors.overall?.message} />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Category limits</legend>
          <ul className="divide-y rounded-2xl border">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-3 py-2">
                <CategoryIcon category={category} size="sm" />
                <Label htmlFor={`budget-${category.id}`} className="min-w-0 flex-1 truncate font-normal">
                  {category.name}
                </Label>
                <Controller
                  control={control}
                  name={`categories.${category.id}`}
                  render={({ field }) => (
                    <MoneyField
                      id={`budget-${category.id}`}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="No limit"
                      className="w-36"
                      invalid={Boolean(errors.categories?.[category.id])}
                    />
                  )}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      </SheetBody>
      <SheetFooter>
        {hasOwnBudget ? (
          <Button
            type="button"
            variant="destructive"
            className="size-12 rounded-xl"
            onClick={onRemove}
            aria-label={`Remove ${formatMonth(month)} budget`}
          >
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting}>Save budget</SubmitButton>
      </SheetFooter>
    </form>
  );
}
