import { Skeleton } from "@/components/ui/skeleton";

export function ExpenseListSkeleton({ rows = 6, grouped = true }: { rows?: number; grouped?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading expenses" className="space-y-1">
      {grouped ? <Skeleton className="mx-3 mb-3 h-4 w-28" /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-10 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
