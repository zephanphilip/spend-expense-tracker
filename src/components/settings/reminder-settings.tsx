"use client";

import { BellRing } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { SwitchField } from "@/components/common/switch-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLocalPreference } from "@/hooks/use-local-preference";
import { NOTIFY_PREF_KEY, notificationsSupported } from "@/hooks/use-reminder-notifications";
import { useReminderPrefs } from "@/hooks/use-reminders";
import { REMINDER_KINDS, type ReminderKind } from "@/lib/finance/reminders";

const LABELS: Record<ReminderKind, { label: string; description: string }> = {
  emi: { label: "EMI due dates", description: "Before each loan installment is due" },
  card: { label: "Credit card bills", description: "Before the statement is due (needs statement amount)" },
  recurring: { label: "Recurring payments", description: "Rent, subscriptions and other schedules" },
  budget: { label: "Budget warnings", description: "At 80% and when over a budget" },
};

const noop = () => () => {};

export function ReminderSettings() {
  const [prefs, setPrefs] = useReminderPrefs();
  const [notify, setNotify] = useLocalPreference<boolean>(NOTIFY_PREF_KEY, false);
  const supported = useSyncExternalStore(noop, notificationsSupported, () => false);
  const permission = useSyncExternalStore(noop, () => (notificationsSupported() ? Notification.permission : "denied"), () => "default");
  const standalone = useSyncExternalStore(noop, () => window.matchMedia("(display-mode: standalone)").matches, () => false);

  async function enableNotifications(on: boolean) {
    if (!on) return setNotify(false);
    if (!supported) {
      toast.error("Notifications aren't available here", { description: "On iPhone, add Spend to your Home Screen first (Share → Add to Home Screen)." });
      return;
    }
    const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (result === "granted") {
      setNotify(true);
      toast.success("Notifications on", { description: "You'll be reminded when you open Spend." });
    } else toast.error("Notifications are blocked", { description: "Allow them for this site in your browser settings." });
  }

  return (
    <section id="reminders" aria-labelledby="reminders-title" className="scroll-mt-6 space-y-3">
      <h2 id="reminders-title" className="text-sm font-medium text-muted-foreground">
        Reminders
      </h2>
      <div className="space-y-3 rounded-3xl border bg-card p-4">
        {REMINDER_KINDS.map((kind) => (
          <SwitchField
            key={kind}
            id={`reminder-${kind}`}
            label={LABELS[kind].label}
            description={LABELS[kind].description}
            checked={prefs.enabled[kind]}
            onCheckedChange={(v) => setPrefs({ ...prefs, enabled: { ...prefs.enabled, [kind]: v } })}
          />
        ))}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Label htmlFor="reminder-lead">Remind me</Label>
          <select
            id="reminder-lead"
            value={prefs.leadDays}
            onChange={(e) => setPrefs({ ...prefs, leadDays: Number(e.target.value) })}
            className="h-10 rounded-xl border border-input bg-transparent px-3 text-base md:text-sm dark:bg-input/30"
          >
            {[0, 1, 2, 3, 5, 7].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? "On the due day" : `${d} day${d === 1 ? "" : "s"} before`}
              </option>
            ))}
          </select>
        </div>
        <div className="border-t pt-3">
          <SwitchField
            id="reminder-notify"
            label="Device notifications"
            description={
              permission === "denied"
                ? "Blocked in your browser settings."
                : !standalone && /iPhone|iPad/.test(typeof navigator === "undefined" ? "" : navigator.userAgent)
                  ? "On iPhone, add Spend to your Home Screen to allow notifications."
                  : "Shown when you open Spend, once per reminder per day."
            }
            checked={notify && permission === "granted"}
            onCheckedChange={(v) => void enableNotifications(v)}
          />
          {notify && permission === "granted" ? (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => navigator.serviceWorker.ready.then((r) => r.showNotification("Spend reminders are on", { body: "This is how reminders will look.", icon: "/icons/icon-192.png" }))}>
              <BellRing aria-hidden />
              Send a test
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
