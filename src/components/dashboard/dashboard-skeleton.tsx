import { ExpenseListSkeleton } from "@/components/expenses/expense-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-4">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-60 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </div>
      <div className="rounded-3xl border p-2">
        <ExpenseListSkeleton rows={4} grouped={false} />
      </div>
    </div>
  );
}
