import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo withWordmark={false} />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-xs text-sm text-muted-foreground">That page doesn&apos;t exist or has moved.</p>
      <Button asChild className="h-11 rounded-xl">
        <Link href="/dashboard">Go to Home</Link>
      </Button>
    </main>
  );
}
