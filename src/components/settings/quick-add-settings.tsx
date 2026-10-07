"use client";

import { Copy, Zap } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { useLocalPreference } from "@/hooks/use-local-preference";
import { quickAddUrl } from "@/lib/quick-add/deep-link";
import { DEFAULT_QUICK_ADD_PREFS, homeScreenAppUrl, QUICK_ADD_PREFS_KEY, type QuickAddPreferences } from "@/lib/quick-add/preferences";

const noop = () => () => {};

function CopyField({ value, label }: { value: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-foreground select-all">{value}</code>
      <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-lg" onClick={copy} aria-label={`Copy ${label}`}>
        <Copy aria-hidden />
      </Button>
    </div>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="text-foreground">{children}</strong>;

export function QuickAddSettings() {
  const [prefs, setPrefs] = useLocalPreference<QuickAddPreferences>(QUICK_ADD_PREFS_KEY, DEFAULT_QUICK_ADD_PREFS);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = origin ? quickAddUrl({}, origin) : "";
  const appUrl = origin ? homeScreenAppUrl(origin) : "";
  const update = (patch: Partial<QuickAddPreferences>) => setPrefs({ ...prefs, ...patch });

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
          description="Opening Spend from the Home Screen or a Back Tap shortcut starts on Quick Add."
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
          <div className="mt-3 space-y-4 text-muted-foreground">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">In the Home Screen app (recommended)</h3>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  Turn on <B>Open the app into Quick Add</B> above.
                  {!prefs.launchOnOpen ? (
                    <Button type="button" variant="link" className="ml-1 h-auto p-0 align-baseline" onClick={() => update({ launchOnOpen: true })}>
                      Turn it on
                    </Button>
                  ) : null}
                </li>
                <li>
                  In <B>Shortcuts</B>, make a shortcut with <B>Open URLs</B> and this link:
                </li>
              </ol>
              <CopyField value={appUrl} label="Home Screen app link" />
              <p className="text-xs">
                Opens the installed app (not Safari) with your usual sign-in. iOS can&apos;t pass an amount this way, so you type it in
                Quick Add.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">In Safari, with the amount pre-filled</h3>
              <p>
                <B>Ask for Input</B> (Number) → <B>Open URLs</B> with this link + <code className="rounded bg-background px-1">?amount=</code>{" "}
                + the answer. Quick Add opens on the category step. Sign in once in Safari too.
              </p>
              <CopyField value={url} label="Quick Add link" />
            </div>
            <p>
              Then: Settings → Accessibility → Touch → <B>Back Tap</B> → Double Tap → pick the shortcut.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
