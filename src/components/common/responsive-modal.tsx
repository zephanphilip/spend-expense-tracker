"use client";

import type { ReactNode } from "react";

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
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

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
