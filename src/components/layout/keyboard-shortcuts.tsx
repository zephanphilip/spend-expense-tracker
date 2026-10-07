"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Kbd } from "@/components/common/kbd";
import { ResponsiveModal } from "@/components/common/responsive-modal";

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["N"], label: "Add an expense" },
  { keys: ["/"], label: "Search history" },
  { keys: ["G", "H"], label: "Go to Home" },
  { keys: ["G", "E"], label: "Go to History (expenses)" },
  { keys: ["G", "P"], label: "Go to Plan" },
  { keys: ["G", "A"], label: "Go to Analytics" },
  { keys: ["G", "S"], label: "Go to Settings" },
  { keys: ["?"], label: "Show this list" },
];

const GO: Record<string, string> = { h: "/dashboard", e: "/expenses", p: "/plan", a: "/analytics", s: "/settings" };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Desktop keyboard shortcuts. Ignored while typing or when a dialog is open. */
export function KeyboardShortcuts({ onAddExpense }: { onAddExpense: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector("[role=dialog],[role=alertdialog]")) return;
      const key = event.key.toLowerCase();
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        if (GO[key]) {
          event.preventDefault();
          router.push(GO[key]);
        }
        return;
      }
      if (key === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
      } else if (key === "n") {
        event.preventDefault();
        onAddExpense();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelp(true);
      } else if (event.key === "/") {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>("[data-shortcut-search]");
        if (search) search.focus();
        else if (pathname !== "/expenses") router.push("/expenses?focus=search");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAddExpense, router, pathname]);

  return (
    <ResponsiveModal open={help} onOpenChange={setHelp} title="Keyboard shortcuts">
      <ul className="space-y-2 px-5 pt-2 pb-6 md:px-6">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between text-sm">
            <span>{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </ResponsiveModal>
  );
}
