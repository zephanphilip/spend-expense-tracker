"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendPasswordReset } from "@/lib/services/auth.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type ResetPasswordValues, resetPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await sendPasswordReset(email);
      setSentTo(email);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 rounded-2xl border bg-card p-5 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        <p className="text-sm">
          If an account exists for <strong>{sentTo}</strong>, a reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@example.com"
          className="h-12 rounded-xl px-3.5"
          {...register("email")}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl text-base">
        {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Send reset link
      </Button>
    </form>
  );
}
