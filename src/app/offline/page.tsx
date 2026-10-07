import type { Metadata } from "next";

import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo withWordmark={false} />
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Reconnect to open this page. Anything you&apos;ve already added is saved on this device and
        will sync automatically.
      </p>
    </main>
  );
}
