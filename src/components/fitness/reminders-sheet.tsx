"use client";

import { BellRing, Info } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Input } from "@/components/ui/input";
import { FITNESS_NOTIFY_KEY } from "@/hooks/use-fitness-reminders";
import { useLocalPreference } from "@/hooks/use-local-preference";
import { notificationsSupported } from "@/hooks/use-reminder-notifications";
import { settleQuickly } from "@/lib/async";
import { currentSchedule, describeSchedule } from "@/lib/fitness/schedule";
import { getErrorMessage } from "@/lib/services/errors";
import { saveFitnessReminders } from "@/lib/services/fitness.service";
import { useSession } from "@/providers/auth-provider";
import { useFitness } from "@/providers/fitness-provider";

import { ActivityIcon } from "./activity-icon";

export function RemindersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Reminders" description="Pick a time for each activity. You're only reminded on days it's due and not done." preventAutoFocus>
      {open ? <RemindersForm onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

const noop = () => () => {};

function RemindersForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const { live } = useFitness();
  const [draft, setDraft] = useState(() => Object.fromEntries(live.map((a) => [a.id, { enabled: a.reminderEnabled, time: a.reminderTime ?? "07:00" }])));
  const [pending, setPending] = useState(false);
  const [notify, setNotify] = useLocalPreference<boolean>(FITNESS_NOTIFY_KEY, false);
  const supported = useSyncExternalStore(noop, notificationsSupported, () => false);
  const permission = useSyncExternalStore(noop, () => (notificationsSupported() ? Notification.permission : "denied"), () => "default");
  const standalone = useSyncExternalStore(noop, () => window.matchMedia("(display-mode: standalone)").matches, () => false);

  // Permission is only requested here, after the user turns notifications on.
  async function toggleNotifications(on: boolean) {
    if (!on) return setNotify(false);
    if (!supported) {
      toast.error("Notifications aren't available here", { description: "On iPhone, add Spend to your Home Screen first (Share → Add to Home Screen), then turn this on from there." });
      return;
    }
    const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (result === "granted") {
      setNotify(true);
      toast.success("Notifications on", { description: "You'll get them while Spend is open, or the next time you open it." });
    } else toast.error("Notifications are blocked", { description: "Allow them for Spend in your device settings. In-app reminders still work." });
  }

  async function save() {
    const changes = live
      .filter((a) => draft[a.id] && (draft[a.id].enabled !== a.reminderEnabled || (draft[a.id].enabled && draft[a.id].time !== a.reminderTime)))
      .map((a) => ({ id: a.id, reminderEnabled: draft[a.id].enabled, reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(draft[a.id].time) ? draft[a.id].time : null }));
    if (changes.some((c) => c.reminderEnabled && !c.reminderTime)) {
      toast.error("Pick a time for every reminder that's on.");
      return;
    }
    setPending(true);
    try {
      if (changes.length) await settleQuickly(saveFitnessReminders(user.uid, changes));
      toast.success(changes.length ? "Reminders saved" : "No changes");
      onDone();
    } catch (error) {
      toast.error("Couldn't save reminders", { description: getErrorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetBody>
        {live.length === 0 ? <p className="text-sm text-muted-foreground">Add an activity first.</p> : null}
        <ul className="divide-y rounded-3xl border bg-card px-4">
          {live.map((a) => {
            const d = draft[a.id];
            return (
              <li key={a.id} className="space-y-2 py-3">
                <div className="flex items-center gap-3">
                  <ActivityIcon activity={a} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.status === "paused" ? "Paused" : describeSchedule(currentSchedule(a))}</span>
                  </span>
                  <SwitchField id={`rem-${a.id}`} label={`Remind me about ${a.name}`} checked={d.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, [a.id]: { ...d, enabled } })} className="shrink-0 [&>span:first-child]:sr-only" />
                </div>
                {d.enabled ? (
                  <Input
                    type="time"
                    aria-label={`${a.name} reminder time`}
                    value={d.time}
                    onChange={(e) => setDraft({ ...draft, [a.id]: { ...d, time: e.target.value } })}
                    className="h-11 rounded-xl"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 rounded-3xl border bg-card p-4">
          <SwitchField
            id="fitness-notify"
            label="Device notifications"
            description={
              permission === "denied" && supported
                ? "Blocked in your device settings."
                : !supported && !standalone
                  ? "On iPhone, add Spend to your Home Screen to allow notifications."
                  : "Show a notification when a reminder is due."
            }
            checked={notify && permission === "granted"}
            onCheckedChange={(on) => void toggleNotifications(on)}
          />
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Reminders appear while Spend is open or the next time you open it — there&apos;s no push server, so they can&apos;t arrive while the app is fully closed. The
              Fitness tab always shows what&apos;s due.
            </span>
          </p>
        </div>
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={pending}>
          <BellRing className="size-5" aria-hidden />
          Save reminders
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}
