"use client";

import { type ReactNode, useEffect } from "react";

import { useRecurringAutomation } from "@/hooks/use-recurring-automation";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";

import { BottomNav } from "./bottom-nav";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NetworkStatus } from "./network-status";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { openCreate } = useExpenseSheet();
  useRecurringAutomation();

  // PWA shortcut / deep link: /dashboard?add=expense opens the Add sheet straight away.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") === "expense") {
      url.searchParams.delete("add");
      window.history.replaceState(null, "", url.pathname + url.search);
      openCreate();
    }
  }, [openCreate]);

  return (
    <div className="flex min-h-dvh">
      <NetworkStatus />
      <KeyboardShortcuts onAddExpense={openCreate} />
      <Sidebar />
      <main
        id="main"
        className="min-w-0 flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:px-10 md:pt-10 md:pb-12"
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
