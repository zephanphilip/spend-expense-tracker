"use client";

import { Copy, Zap } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { useLocalPreference } from "@/hooks/use-local-preference";
import { quickAddUrl } from "@/lib/quick-add/deep-link";
import { DEFAULT_QUICK_ADD_PREFS, QUICK_ADD_PREFS_KEY, type QuickAddPreferences } from "@/lib/quick-add/preferences";

const noop = () => () => {};

export function QuickAddSettings() {
  const [prefs, setPrefs] = useLocalPreference<QuickAddPreferences>(QUICK_ADD_PREFS_KEY, DEFAULT_QUICK_ADD_PREFS);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = origin ? quickAddUrl({}, origin) : "";
  const update = (patch: Partial<QuickAddPreferences>) => setPrefs({ ...prefs, ...patch });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Quick Add link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <section aria-labelledby="quick-add-title" className="space-y-3">
      <h2 id="quick-add-title" className="text-sm font-medium text-muted-foreground">
        Quick Add
      </h2>
      <div className="space-y-4 rounded-3xl border bg-card p-5">
        <Button asChild className="h-11 w-full rounded-xl">
          <Link href="/quick-add">
            <Zap aria-hidden />
            Open Quick Add
          </Link>
        </Button>
        <SwitchField
          id="qa-launch"
          label="Open the app into Quick Add"
          description="Launching Ledger from the Home Screen starts on Quick Add."
          checked={prefs.launchOnOpen}
          onCheckedChange={(launchOnOpen) => update({ launchOnOpen })}
        />
        <SwitchField
          id="qa-note"
          label="Ask for a note"
          description="Turn off to skip the note step."
          checked={prefs.askNote}
          onCheckedChange={(askNote) => update({ askNote })}
        />
        <SwitchField
          id="qa-one-tap"
          label="One-tap save"
          description="Save as soon as you pick how you paid — no confirm screen."
          checked={prefs.oneTapSave}
          onCheckedChange={(oneTapSave) => update({ oneTapSave })}
        />
        <details className="group rounded-2xl bg-muted/50 p-4 text-sm">
          <summary className="cursor-pointer font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Launch with Back Tap or Shortcuts
          </summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                In the <strong className="text-foreground">Shortcuts</strong> app, create a shortcut with{" "}
                <strong className="text-foreground">Open URLs</strong> and paste the link below.
              </li>
              <li>
                Faster: start with <strong className="text-foreground">Ask for Input</strong> (Number), then open the link with{" "}
                <code className="rounded bg-background px-1">?amount=</code> + the answer — Quick Add opens on the category step.
              </li>
              <li>
                Settings → Accessibility → Touch → <strong className="text-foreground">Back Tap</strong> → Double Tap → pick the
                shortcut.
              </li>
            </ol>
            <p>
              iOS opens shortcut links in Safari rather than the Home Screen app, so sign in once in Safari too. Add{" "}
              <code className="rounded bg-background px-1">&amp;category=food&amp;method=upi</code> to pre-fill more.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-foreground select-all">{url}</code>
              <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-lg" onClick={copy} aria-label="Copy Quick Add link">
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
