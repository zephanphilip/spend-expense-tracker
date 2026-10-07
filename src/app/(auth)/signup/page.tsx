import type { Metadata } from "next";
import Link from "next/link";

import { AuthDivider, AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Log an expense in under five seconds."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton />
        <AuthDivider />
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
