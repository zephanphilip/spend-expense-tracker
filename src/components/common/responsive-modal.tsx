"use client";

import { type ReactNode, useEffect, useRef } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** Gap above a keyboard-lifted sheet: clears the status bar / Dynamic Island. */
const KEYBOARD_TOP_GAP = "max(0.5rem, env(safe-area-inset-top))";

/** Scrolls the focused field into the visible part of its nearest scrollable ancestor. */
function revealFocusedField(container: HTMLElement | null) {
  const field = document.activeElement;
  if (!container || !(field instanceof HTMLElement) || !container.contains(field)) return;
  let scroller = field.parentElement;
  while (scroller && scroller !== container) {
    const { overflowY } = getComputedStyle(scroller);
    if ((overflowY === "auto" || overflowY === "scroll") && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === container) return;
  const view = scroller.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  const margin = 16;
  if (rect.top < view.top + margin) scroller.scrollTop -= view.top + margin - rect.top;
  else if (rect.bottom > view.bottom - margin) scroller.scrollTop += rect.bottom - (view.bottom - margin);
}

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Visually hide the header (it stays available to screen readers). */
  hideHeader?: boolean;
  /** Don't move focus into the first field on open (avoids popping the keyboard). */
  preventAutoFocus?: boolean;
  className?: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  hideHeader = false,
  preventAutoFocus = false,
  className,
  children,
}: ResponsiveModalProps) {
  const isDesktop = useIsDesktop();
  const contentRef = useRef<HTMLDivElement>(null);
  const keyboard = useKeyboardInset(open && !isDesktop);

  // Once the sheet has been lifted above the keyboard, bring the field being typed into back
  // into view (iOS scrolled for the old, taller sheet). Also covers moving between fields.
  useEffect(() => {
    if (!keyboard) return;
    const frame = requestAnimationFrame(() => revealFocusedField(contentRef.current));
    return () => cancelAnimationFrame(frame);
  }, [keyboard]);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn("flex max-h-[min(90dvh,52rem)] flex-col gap-0 p-0 sm:max-w-md", className)}
          onOpenAutoFocus={preventAutoFocus ? (event) => event.preventDefault() : undefined}
        >
          <DialogHeader className={cn("px-6 pt-6 pb-2", hideHeader && "sr-only")}>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        ref={contentRef}
        style={
          keyboard
            ? { bottom: keyboard.bottom, maxHeight: `calc(${keyboard.height}px - ${KEYBOARD_TOP_GAP})` }
            : undefined
        }
        onFocus={() => {
          if (keyboard) requestAnimationFrame(() => revealFocusedField(contentRef.current));
        }}
        className={cn(
          "data-[vaul-drawer-direction=bottom]:max-h-[94dvh] data-[vaul-drawer-direction=bottom]:rounded-t-3xl",
          className,
        )}
        onOpenAutoFocus={preventAutoFocus ? (event) => event.preventDefault() : undefined}
      >
        <DrawerHeader className={cn("px-5 pt-3 pb-1 text-left", hideHeader && "sr-only")}>
          <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
