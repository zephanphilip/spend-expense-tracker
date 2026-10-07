import { CloudAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, title = "Couldn't load this", onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <CloudAlert className="size-6 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="lg" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
