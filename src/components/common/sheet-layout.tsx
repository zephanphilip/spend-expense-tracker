import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Scrollable body of a form inside a ResponsiveModal. */
export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pt-2 pb-4 md:px-6", className)}>
      {children}
    </div>
  );
}

/** Sticky footer that respects the iPhone home indicator. */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 border-t bg-popover px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] keyboard:pb-3 md:px-6 md:pb-6">
      {children}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl text-base">
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
