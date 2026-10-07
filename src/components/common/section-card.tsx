import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionCardProps {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Titled card used across dashboard and plan screens. */
export function SectionCard({ id, title, href, linkLabel = "See all", action, className, children }: SectionCardProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("rounded-3xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-semibold">
          {title}
        </h2>
        {action}
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {linkLabel} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
