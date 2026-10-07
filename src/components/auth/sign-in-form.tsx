"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithEmail } from "@/lib/services/auth.service";
import { getErrorMessage } from "@/lib/services/errors";
import { type SignInValues, signInSchema } from "@/lib/validation/auth";

export function SignInForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await signInWithEmail(email, password);
      // GuestGuard redirects once the auth state updates.
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

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
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        hint={
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        }
      >
        <Input
          {...fieldA11y("password", errors.password?.message)}
          type="password"
          autoComplete="current-password"
          className="h-12 rounded-xl px-3.5"
          {...register("password")}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl text-base">
        {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Sign in
      </Button>
    </form>
  );
}
