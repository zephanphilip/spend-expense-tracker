"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithEmail } from "@/lib/services/auth.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type SignUpValues, signUpSchema } from "@/lib/validation/auth";

export function SignUpForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUpWithEmail(values);
      toast.success("Welcome to Ledger!");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="displayName" label="Name" error={errors.displayName?.message}>
        <Input
          {...fieldA11y("displayName", errors.displayName?.message)}
          autoComplete="name"
          placeholder="Your name"
          className="h-12 rounded-xl px-3.5"
          {...register("displayName")}
        />
      </FormField>
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
      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input
          {...fieldA11y("password", errors.password?.message)}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="h-12 rounded-xl px-3.5"
          {...register("password")}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl text-base">
        {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Create account
      </Button>
    </form>
  );
}
