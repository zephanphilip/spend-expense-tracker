"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/fitness", label: "Today" },
  { href: "/fitness/analytics", label: "Analytics" },
];

/** Today / Analytics switch shown under the Fitness header. */
export function FitnessTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Fitness" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-xl text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-background text-foreground shadow-sm dark:bg-input/60" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
