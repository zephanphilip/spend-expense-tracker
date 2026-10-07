"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fieldA11y, FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { QuickAddSettings } from "@/components/settings/quick-add-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/constants/currencies";
import { signOut } from "@/lib/services/auth.service";
import { getErrorMessage } from "@/lib/services/errors";
import { updateUserProfile } from "@/lib/services/user.service";
import { cn } from "@/lib/utils";
import { type ProfileFormValues, profileSchema } from "@/lib/validation/profile";
import { useSession } from "@/providers/auth-provider";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function SettingsView() {
  const { user, profile, currency } = useSession();
  const name = profile?.displayName ?? user.displayName ?? "";

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" />

      <section aria-labelledby="profile-title" className="space-y-4 rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} email={user.email} photoURL={user.photoURL} className="size-14" />
          <div className="min-w-0">
            <h2 id="profile-title" className="truncate text-lg font-semibold">
              {name || "Your profile"}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        {/* Remount when the profile arrives so the form starts from saved values. */}
        <ProfileForm key={`${name}:${currency}`} uid={user.uid} defaults={{ displayName: name, currency }} />
      </section>

      <QuickAddSettings />

      <AppearanceSection />

      <ReminderSettings />

      <section aria-labelledby="account-title" className="space-y-3">
        <h2 id="account-title" className="text-sm font-medium text-muted-foreground">
          Account
        </h2>
        <SignOutButton />
      </section>
    </div>
  );
}

function ProfileForm({ uid, defaults }: { uid: string; defaults: ProfileFormValues }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await settleQuickly(updateUserProfile(uid, values));
      reset(values);
      toast.success("Profile saved");
    } catch (error) {
      toast.error("Couldn't save profile", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="displayName" label="Name" error={errors.displayName?.message}>
        <Input
          {...fieldA11y("displayName", errors.displayName?.message)}
          autoComplete="name"
          className="h-11 rounded-xl"
          {...register("displayName")}
        />
      </FormField>
      <FormField id="currency" label="Currency" error={errors.currency?.message}>
        <div className="relative">
          {/* Native select: wheel picker on iOS, full keyboard support everywhere. */}
          <select
            {...fieldA11y("currency", errors.currency?.message)}
            className="h-11 w-full appearance-none rounded-xl border border-input bg-transparent pr-10 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            {...register("currency")}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCIES[code].label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </FormField>
      <p className="text-xs text-muted-foreground">
        Changing currency relabels amounts; it doesn&apos;t convert them.
      </p>
      <Button type="submit" disabled={!isDirty || isSubmitting} className="h-11 rounded-xl px-5">
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save profile
      </Button>
    </form>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section aria-labelledby="appearance-title" className="space-y-3">
      <h2 id="appearance-title" className="text-sm font-medium text-muted-foreground">
        Appearance
      </h2>
      <div role="radiogroup" aria-labelledby="appearance-title" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {THEMES.map(({ value, label, icon: Icon }) => {
          const checked = theme === value;
          return (
            <label
              key={value}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                checked ? "bg-background shadow-sm dark:bg-input/60" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={checked}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              {label}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="h-11 w-full rounded-xl text-destructive hover:text-destructive"
      onClick={async () => {
        setPending(true);
        try {
          await signOut();
        } catch (error) {
          toast.error(getErrorMessage(error));
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
      Sign out
    </Button>
  );
}
