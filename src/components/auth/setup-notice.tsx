import { Settings2 } from "lucide-react";

import { missingFirebaseConfigKeys } from "@/lib/firebase/config";

/** Shown in development when Firebase env vars are missing, instead of a crash. */
export function SetupNotice() {
  const envName = (key: string) =>
    `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Settings2 className="size-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Connect Firebase to continue</h1>
          <p className="text-sm text-muted-foreground">
            Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
            <code className="rounded bg-muted px-1">.env.local</code>, fill in your Firebase web app
            config and restart the dev server.
          </p>
        </div>
        <ul className="space-y-1 rounded-xl bg-muted p-3 font-mono text-xs">
          {missingFirebaseConfigKeys.map((key) => (
            <li key={key}>{envName(key)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
