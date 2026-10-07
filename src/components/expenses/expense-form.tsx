"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleQuickly } from "@/lib/async";
import { haptic } from "@/lib/haptics";
import { defaultAccountFor, readLastPaymentMethod, rememberExpenseChoices } from "@/lib/expense-preferences";
import { toDateTimeLocalValue } from "@/lib/dates";
import {
  currencySymbol,
  formatMoney,
  fractionDigits,
  minorToInputString,
  parseAmountToMinor,
  sanitizeAmountInput,
} from "@/lib/money";
import {
  createExpense,
  deleteExpense,
  restoreExpense,
  updateExpense,
} from "@/lib/services/expense.service";
import { getErrorMessage } from "@/lib/services/errors";
import {
  type ExpenseFormValues,
  expenseFormSchema,
  NOTE_MAX_LENGTH,
  toExpenseInput,
} from "@/lib/validation/expense";
import { useSession } from "@/providers/auth-provider";
import { AccountPicker } from "@/components/accounts/account-picker";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts } from "@/providers/finance-provider";
import type { Account, Expense } from "@/types";

import { AmountInput } from "./amount-input";
import { CategoryPicker } from "./category-picker";
import { DateTimeField } from "./date-time-field";
import { DeleteExpenseDialog } from "./delete-expense-dialog";
import { PaymentMethodPicker } from "./payment-method-picker";

function initialValues(expense: Expense | null, accounts: readonly Account[]): ExpenseFormValues {
  if (expense) {
    return {
      amount: minorToInputString(expense.amount),
      categoryId: expense.categoryId,
      paymentMethod: expense.paymentMethod,
      note: expense.note,
      occurredAt: toDateTimeLocalValue(expense.occurredAt),
      accountId: expense.accountId ?? "",
    };
  }
  // Most people pay the same way most of the time — start from their last choice.
  const paymentMethod = readLastPaymentMethod();
  return {
    amount: "",
    categoryId: "",
    paymentMethod,
    note: "",
    occurredAt: toDateTimeLocalValue(new Date()),
    accountId: defaultAccountFor(paymentMethod, accounts),
  };
}

interface ExpenseFormProps {
  /** `null` to create a new expense. */
  expense: Expense | null;
  onDone: () => void;
}

export function ExpenseForm({ expense, onDone }: ExpenseFormProps) {
  const { user, currency } = useSession();
  const { getCategory } = useCategories();
  const accounts = useAccounts();
  const [defaults] = useState(() => initialValues(expense, accounts.all));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isEdit = expense !== null;
  const digits = fractionDigits(currency);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaults,
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- watch() is used for a live label only.
  const amountMinor = parseAmountToMinor(watch("amount") ?? "") ?? 0;
  const describe = (minor: number, categoryId: string) =>
    `${formatMoney(minor, currency)} · ${getCategory(categoryId).name}`;

  // Guards against double submission from rapid taps before React re-renders the
  // disabled button (each submit would otherwise create a new client-side id).
  const submitting = useRef(false);
  const onSubmit = handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const input = toExpenseInput(values);
      if (isEdit) {
        const result = await settleQuickly(
          updateExpense(user.uid, expense, input, { accountExists: accounts.accountExists }),
        );
        onDone();
        toast.success("Expense updated", {
          description: result === "pending" ? "Will sync when you're back online." : undefined,
        });
        return;
      }

      const { id, committed } = createExpense(user.uid, input, { accountExists: accounts.accountExists });
      rememberExpenseChoices(input);
      const result = await settleQuickly(committed);
      if (result === "pending") {
        committed.catch((error) =>
          toast.error("An expense couldn't be synced", { description: getErrorMessage(error) }),
        );
      }
      onDone();
      haptic("success");
      toast.success(`${describe(input.amount, input.categoryId)} added`, {
        description: result === "pending" ? "Saved offline — will sync when you're back online." : undefined,
        action: {
          label: "Undo",
          onClick: () => {
            deleteExpense(user.uid, { ...input, id, accountId: input.accountId ?? null }, { accountExists: accounts.accountExists }).catch(
              (error) => toast.error(getErrorMessage(error)),
            );
          },
        },
      });
    } catch (error) {
      haptic("warning");
      toast.error(isEdit ? "Couldn't update expense" : "Couldn't save expense", {
        description: getErrorMessage(error),
      });
    } finally {
      submitting.current = false;
    }
  });

  async function onDelete() {
    if (!expense) return;
    try {
      await settleQuickly(deleteExpense(user.uid, expense, { accountExists: accounts.accountExists }));
      setConfirmingDelete(false);
      onDone();
      toast.success("Expense deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            restoreExpense(user.uid, expense, { accountExists: accounts.accountExists }).catch((error) =>
              toast.error(getErrorMessage(error)),
            );
          },
        },
      });
    } catch (error) {
      toast.error("Couldn't delete expense", { description: getErrorMessage(error) });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-1 pb-4 md:px-6">
        <div className="space-y-3">
          <Label htmlFor="amount" className="sr-only">
            Amount
          </Label>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <AmountInput
                ref={field.ref}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(raw) => field.onChange(sanitizeAmountInput(raw, digits))}
                currencySymbol={currencySymbol(currency)}
                invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                autoFocus={!isEdit}
              />
            )}
          />
          {errors.amount ? (
            <p id="amount-error" role="alert" className="text-center text-sm text-destructive">
              {errors.amount.message}
            </p>
          ) : null}
          <Controller
            control={control}
            name="occurredAt"
            render={({ field }) => (
              <DateTimeField
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.occurredAt)}
                showResetToNow={!isEdit && Boolean(dirtyFields.occurredAt)}
              />
            )}
          />
          {errors.occurredAt ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {errors.occurredAt.message}
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Category</legend>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <CategoryPicker
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.categoryId)}
                describedBy={errors.categoryId ? "category-error" : undefined}
              />
            )}
          />
          {errors.categoryId ? (
            <p id="category-error" role="alert" className="text-sm text-destructive">
              {errors.categoryId.message}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Paid with</legend>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <PaymentMethodPicker
                value={field.value}
                onChange={(method) => {
                  field.onChange(method);
                  // Follow the payment method unless the user picked an account themselves.
                  if (!isEdit && !dirtyFields.accountId) {
                    setValue("accountId", defaultAccountFor(method, accounts.all));
                  }
                }}
              />
            )}
          />
        </fieldset>

        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <AccountPicker
              name="expense-account"
              label="From account"
              value={field.value}
              onChange={(id) => setValue("accountId", id, { shouldDirty: true })}
            />
          )}
        />

        <div className="space-y-2">
          <Label htmlFor="note" className="text-sm font-medium text-muted-foreground">
            Note <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id="note"
            placeholder="What was it for?"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={NOTE_MAX_LENGTH}
            className="h-11 rounded-xl px-3.5"
            aria-invalid={Boolean(errors.note) || undefined}
            {...register("note")}
          />
          {errors.note ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.note.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 border-t bg-popover px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] keyboard:pb-3 md:px-6 md:pb-6">
        {isEdit ? (
          <Button
            type="button"
            variant="destructive"
            className="size-12 rounded-xl"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete expense"
          >
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-xl text-base">
          {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {isEdit
            ? "Save changes"
            : amountMinor > 0
              ? `Save ${formatMoney(amountMinor, currency)}`
              : "Save expense"}
        </Button>
      </div>

      {expense ? (
        <DeleteExpenseDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          summary={describe(expense.amount, expense.categoryId)}
          onConfirm={onDelete}
        />
      ) : null}
    </form>
  );
}
