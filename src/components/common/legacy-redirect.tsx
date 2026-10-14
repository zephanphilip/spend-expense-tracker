"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side redirect for renamed routes in the static export (no server to answer with a
 * 301). Keeps the query string and hash, and replaces history so Back doesn't bounce.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${to}${window.location.search}${window.location.hash}`);
  }, [router, to]);
  return (
    <p role="status" className="py-10 text-center text-sm text-muted-foreground">
      Opening Activities…
    </p>
  );
}
