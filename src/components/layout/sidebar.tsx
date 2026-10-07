"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/common/kbd";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { ReminderBell } from "@/components/reminders/reminder-center";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";
import { useReminderList } from "@/providers/reminders-provider";

import { Logo } from "./logo";
import { isActive, NAV_ITEMS, PLAN_ITEMS, PLAN_SECTIONS } from "./nav-items";
import { UserAvatar } from "./user-avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { openCreate } = useExpenseSheet();
  const { user, profile } = useSession();
  const name = profile?.displayName ?? user.displayName;
  const reminders = useReminderList();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r bg-muted/30 px-4 py-6 md:flex">
      <div className="mb-8 flex items-center justify-between px-2">
        <Link href="/dashboard" className="outline-none">
          <Logo />
        </Link>
        <ReminderBell reminders={reminders} className="size-9" />
      </div>
      <Button onClick={openCreate} className="mb-6 h-11 justify-between rounded-xl px-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <Plus className="size-4" aria-hidden />
          Add expense
        </span>
        <Kbd className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">N</Kbd>
      </Button>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/plan" ? pathname === "/plan" : isActive(pathname, item);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              {item.label}
            </Link>
          );
          if (item.href !== "/plan") return link;
          return (
            <div key={item.href} className="space-y-0.5">
              {link}
              <div className="ml-5 space-y-2 border-l pl-2">
                {PLAN_SECTIONS.map((section) => (
                  <div key={section}>
                    <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground/70 uppercase">{section}</p>
                    <ul className="space-y-0.5">
                      {PLAN_ITEMS.filter((sub) => sub.section === section).map((sub) => {
                        const subActive = isActive(pathname, sub.href);
                        return (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              aria-current={subActive ? "page" : undefined}
                              className={cn(
                                "flex h-8 items-center rounded-lg px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                                subActive
                                  ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {sub.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <Link
        href="/settings"
        className="mt-auto flex items-center gap-3 rounded-xl p-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={name} email={user.email} photoURL={user.photoURL} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name || "Your account"}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
      </Link>
    </aside>
  );
}
