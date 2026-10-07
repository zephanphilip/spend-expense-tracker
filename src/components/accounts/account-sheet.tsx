"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { MoneyField } from "@/components/common/money-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { ACCOUNT_TYPE_META, ACCOUNT_TYPES } from "@/lib/constants/accounts";
import { minorToInputString } from "@/lib/money";
import { createAccount, updateAccount } from "@/lib/services/account.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type AccountFormValues, accountFormSchema } from "@/lib/validation/accounts";
import { NAME_MAX_LENGTH } from "@/lib/validation/finance";
import { toMinorOrNull } from "@/lib/validation/money";
import { useSession } from "@/providers/auth-provider";
import type { Account, AccountInput, AccountType } from "@/types";

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  defaultType?: AccountType;
}

export function AccountSheet({ open, onOpenChange, account, defaultType = "bank" }: AccountSheetProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={account ? "Edit account" : "Add account"} preventAutoFocus={Boolean(account)}>
      {open ? <AccountForm account={account ?? null} defaultType={defaultType} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

function AccountForm({ account, defaultType, onDone }: { account: Account | null; defaultType: AccountType; onDone: () => void }) {
  const { user } = useSession();
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          institution: account.institution ?? "",
          // Editing shows the opening balance (current balance is adjusted via "Adjust balance").
          balance: account.openingBalance ? minorToInputString(Math.abs(account.openingBalance)) : "",
          balanceNegative: account.type === "credit_card" ? account.openingBalance > 0 : account.openingBalance < 0,
          creditLimit: account.creditLimit ? minorToInputString(account.creditLimit) : "",
          statementDay: account.statementDay ? String(account.statementDay) : "",
          dueDay: account.dueDay ? String(account.dueDay) : "",
          active: account.active,
        }
      : { name: "", type: defaultType, institution: "", balance: "", balanceNegative: false, creditLimit: "", statementDay: "", dueDay: "", active: true },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- conditional fields only.
  const type = watch("type");
  const isCard = type === "credit_card";

  const onSubmit = handleSubmit(async (values) => {
    const amount = toMinorOrNull(values.balance) ?? 0;
    // Cards store what you owe as a negative balance; "credit on card" flips it.
    const signed = values.type === "credit_card" ? (values.balanceNegative ? amount : -amount) : values.balanceNegative ? -amount : amount;
    const input: AccountInput = {
      name: values.name.trim(),
      type: values.type,
      institution: values.institution.trim() || null,
      openingBalance: signed,
      active: values.active,
      creditLimit: isCard ? toMinorOrNull(values.creditLimit) : null,
      statementDay: isCard && values.statementDay ? Number(values.statementDay) : null,
      dueDay: isCard && values.dueDay ? Number(values.dueDay) : null,
    };
    try {
      if (account) await settleQuickly(updateAccount(user.uid, account, input));
      else await settleQuickly(createAccount(user.uid, input).committed);
      onDone();
      toast.success(account ? "Account updated" : `${input.name} added`);
    } catch (error) {
      toast.error("Couldn't save account", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        {!account ? (
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Segmented
                name="account-type"
                label="Account type"
                value={field.value}
                onChange={field.onChange}
                options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_META[t].short, icon: ACCOUNT_TYPE_META[t].icon }))}
              />
            )}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FormField id="account-name" label="Name" error={errors.name?.message}>
            <Input
              {...fieldA11y("account-name", errors.name?.message)}
              placeholder={isCard ? "Amex Gold" : type === "cash" ? "Wallet cash" : "Salary account"}
              maxLength={NAME_MAX_LENGTH}
              className="h-11 rounded-xl"
              {...register("name")}
            />
          </FormField>
          <FormField id="account-institution" label={isCard ? "Issuer" : "Institution"} error={errors.institution?.message}>
            <Input
              {...fieldA11y("account-institution", errors.institution?.message)}
              placeholder={type === "wallet" ? "Paytm" : "HDFC"}
              className="h-11 rounded-xl"
              {...register("institution")}
            />
          </FormField>
        </div>

        <FormField
          id="account-balance"
          label={account ? (isCard ? "Opening outstanding" : "Opening balance") : isCard ? "Current outstanding" : "Current balance"}
          error={errors.balance?.message}
          hint={account ? <span className="text-xs text-muted-foreground">Changing it shifts the current balance</span> : undefined}
        >
          <Controller
            control={control}
            name="balance"
            render={({ field }) => <MoneyField {...fieldA11y("account-balance", errors.balance?.message)} value={field.value} onValueChange={field.onChange} />}
          />
        </FormField>
        <Controller
          control={control}
          name="balanceNegative"
          render={({ field }) => (
            <SwitchField
              id="account-negative"
              label={isCard ? "This is a credit balance (overpaid)" : "Overdrawn (negative balance)"}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />

        {isCard ? (
          <>
            <FormField id="account-limit" label="Credit limit" error={errors.creditLimit?.message}>
              <Controller
                control={control}
                name="creditLimit"
                render={({ field }) => (
                  <MoneyField {...fieldA11y("account-limit", errors.creditLimit?.message)} value={field.value} onValueChange={field.onChange} invalid={Boolean(errors.creditLimit)} />
                )}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="account-statement-day" label="Statement day" error={errors.statementDay?.message}>
                <Input {...fieldA11y("account-statement-day", errors.statementDay?.message)} inputMode="numeric" placeholder="20" className="h-11 rounded-xl" {...register("statementDay")} />
              </FormField>
              <FormField id="account-due-day" label="Payment due day" error={errors.dueDay?.message}>
                <Input {...fieldA11y("account-due-day", errors.dueDay?.message)} inputMode="numeric" placeholder="8" className="h-11 rounded-xl" {...register("dueDay")} />
              </FormField>
            </div>
          </>
        ) : null}

        {account ? (
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <SwitchField id="account-active" label="Active" description="Inactive accounts are hidden from pickers but keep their history." checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        ) : null}
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>{account ? "Save changes" : "Add account"}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
