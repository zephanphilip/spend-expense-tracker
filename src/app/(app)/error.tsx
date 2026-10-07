"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error boundary for app screens: keeps navigation usable and offers a retry. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Screen error", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">This screen hit a problem</h1>
        <p className="text-sm text-muted-foreground">Your data is safe. Try again, or go back to Home.</p>
        {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} className="h-11 rounded-xl">
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href="/dashboard">Home</Link>
        </Button>
      </div>
    </div>
  );
}
