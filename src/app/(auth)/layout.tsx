import { type ReactNode, Suspense } from "react";

import { GuestGuard } from "@/components/auth/guest-guard";
import { SplashScreen } from "@/components/auth/splash-screen";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SplashScreen />}>
      <GuestGuard>{children}</GuestGuard>
    </Suspense>
  );
}
