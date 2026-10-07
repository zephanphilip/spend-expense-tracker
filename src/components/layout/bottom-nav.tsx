"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";

import { isActive, NAV_ITEMS, type NavItem } from "./nav-items";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium outline-none transition-colors focus-visible:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
      {item.label}
    </Link>
  );
}

/** iOS-style tab bar with the primary "Add" action in the thumb zone. */
export function BottomNav() {
  const pathname = usePathname();
  const { openCreate } = useExpenseSheet();
  const [first, second, third, fourth] = NAV_ITEMS;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        <NavLink item={first} pathname={pathname} />
        <NavLink item={second} pathname={pathname} />
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add expense"
            className="flex size-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 outline-none transition-transform active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <NavLink item={third} pathname={pathname} />
        <NavLink item={fourth} pathname={pathname} />
      </div>
    </nav>
  );
}
