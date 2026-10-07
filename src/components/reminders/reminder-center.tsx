"use client";

import { Bell, BellRing, CalendarClock, CreditCard, Gauge, Landmark, Repeat, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import type { Reminder, ReminderKind } from "@/lib/finance/reminders";
import { cn } from "@/lib/utils";

const ICONS: Record<ReminderKind, typeof Bell> = { emi: Landmark, card: CreditCard, recurring: Repeat, budget: Gauge };

export function ReminderBell({ reminders, className }: { reminders: Reminder[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const urgent = reminders.some((r) => r.urgent);
  return (
    <>
      <Button
        variant="outline"
        size="icon-lg"
        className={cn("relative rounded-xl", className)}
        onClick={() => setOpen(true)}
        aria-label={reminders.length ? `Reminders, ${reminders.length}` : "Reminders"}
      >
        {reminders.length ? <BellRing aria-hidden /> : <Bell aria-hidden />}
        {reminders.length ? (
          <span className={cn("absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white", urgent ? "bg-destructive" : "bg-primary")}>
            {reminders.length > 9 ? "9+" : reminders.length}
          </span>
        ) : null}
      </Button>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Reminders" preventAutoFocus>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] keyboard:pb-4 md:px-6 md:pb-6">
          {reminders.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CalendarClock className="size-5" aria-hidden />
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => {
                const Icon = ICONS[r.kind];
                return (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-2xl p-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", r.urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {r.urgent ? <span className="sr-only">Urgent: </span> : null}
                          {r.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">{r.body}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/settings#reminders" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Settings2 className="size-4" aria-hidden />
            Reminder settings
          </Link>
        </div>
      </ResponsiveModal>
    </>
  );
}
