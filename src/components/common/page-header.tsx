import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Shows a back link (e.g. to the Plan hub) above the title. */
  back?: { href: string; label: string };
  className?: string;
}

export function PageHeader({ title, description, action, back, className }: PageHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 inline-flex h-8 items-center gap-0.5 rounded-lg pr-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
