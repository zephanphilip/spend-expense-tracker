"use client";

import { format } from "date-fns";
import { Archive, ArchiveRestore, Heart, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/categories/category-icon";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SectionCard } from "@/components/common/section-card";
import { Stat } from "@/components/common/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoalContributions } from "@/hooks/use-finance-queries";
import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { goalProgress } from "@/lib/finance/goals";
import { formatMoney } from "@/lib/money";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteContribution, deleteGoal, setGoalArchived } from "@/lib/services/goal.service";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useFinance } from "@/providers/finance-provider";
import type { GoalContribution } from "@/types";

import { ContributionSheet } from "./contribution-sheet";
import { GoalSheet } from "./goal-sheet";

export function GoalDetailView({ goalId }: { goalId: string }) {
  const router = useRouter();
  const { user, currency } = useSession();
  const { goals } = useFinance();
  const contributions = useGoalContributions(goalId);
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<"add" | "withdraw" | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const [removing, setRemoving] = useState<GoalContribution | null>(null);

  if (goals.status === "loading") return <Skeleton className="h-96 rounded-3xl" aria-label="Loading wish" />;
  if (goals.status === "error") return <ErrorState error={goals.error} onRetry={goals.retry} />;
  const goal = goals.data.find((g) => g.id === goalId);
  if (!goal) return <EmptyState icon={Heart} title="Wish not found" description="It may have been deleted." />;

  const p = goalProgress(goal);
  const archived = goal.status === "archived";

  return (
    <div className="space-y-5">
      <PageHeader
        title={goal.name}
        back={{ href: "/wishlist", label: "Wishlist" }}
        action={
          <Button variant="outline" size="icon-lg" className="rounded-xl" onClick={() => setEditing(true)} aria-label="Edit wish">
            <Pencil aria-hidden />
          </Button>
        }
      />

      <section aria-label="Savings progress" className="space-y-4 rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <CategoryIcon category={goal} size="lg" />
          <div>
            <p className="text-3xl font-semibold tracking-tight">
              <Money amount={goal.savedAmount} />
            </p>
            <p className="text-sm text-muted-foreground">
              of <Money amount={goal.targetAmount} /> · {p.percent}%
            </p>
          </div>
        </div>
        <ProgressBar value={p.ratio} colorClassName={p.achieved ? "bg-emerald-500" : CATEGORY_COLORS[goal.color].solid} label={`${goal.name} saved`} />
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 rounded-xl" onClick={() => setDirection("add")} disabled={archived}>
            <Plus aria-hidden />
            Add money
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setDirection("withdraw")} disabled={goal.savedAmount === 0 || archived}>
            <Minus aria-hidden />
            Withdraw
          </Button>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Remaining" value={p.achieved ? "Reached 🎉" : <Money amount={p.remaining} />} />
        <Stat
          label="Target date"
          value={goal.targetDate ? format(goal.targetDate, "d MMM yyyy") : "—"}
          hint={p.isPastDue ? <span className="font-medium text-destructive">Past due</span> : p.monthsLeft ? `${p.monthsLeft} months left` : undefined}
        />
        {p.perMonth ? <Stat label="Save per month" value={<Money amount={p.perMonth} />} hint="to hit the date" className="col-span-2" /> : null}
      </dl>

      <SectionCard id="contributions" title="Contribution history">
        {contributions.status === "loading" ? <Skeleton className="h-20 rounded-xl" /> : null}
        {contributions.status === "error" ? <ErrorState error={contributions.error} onRetry={contributions.retry} /> : null}
        {contributions.status === "success" && contributions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contributions yet.</p>
        ) : null}
        {contributions.data?.length ? (
          <ul className="divide-y">
            {contributions.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.note || (c.amount > 0 ? "Added" : "Withdrawn")}</span>
                  <span className="block text-xs text-muted-foreground">{format(c.contributedAt, "d MMM yyyy")}</span>
                </span>
                <span className={cn("font-semibold tabular-nums", c.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {c.amount > 0 ? "+" : "−"}
                  <Money amount={Math.abs(c.amount)} />
                </span>
                <Button variant="ghost" size="icon" onClick={() => setRemoving(c)} aria-label="Remove contribution">
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={async () => {
            try {
              await setGoalArchived(user.uid, goal.id, !archived);
              toast.success(archived ? "Wish restored" : "Wish archived");
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? "Restore" : "Archive"}
        </Button>
        <Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => setDeletingGoal(true)}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>

      <GoalSheet open={editing} onOpenChange={setEditing} goal={goal} />
      <ContributionSheet goal={direction ? goal : null} direction={direction ?? "add"} onOpenChange={(open) => !open && setDirection(null)} />
      <ConfirmDialog
        open={deletingGoal}
        onOpenChange={setDeletingGoal}
        title={`Delete ${goal.name}?`}
        description="The wish and its contribution history will be removed."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await deleteGoal(user.uid, goal.id);
            setDeletingGoal(false);
            router.replace("/wishlist");
            toast.success("Wish deleted");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this entry?"
        description={removing ? `${formatMoney(Math.abs(removing.amount), currency)} will be ${removing.amount > 0 ? "taken off" : "added back to"} your saved total.` : ""}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deleteContribution(user.uid, goal.id, removing);
            setRemoving(null);
            toast.success("Entry removed");
          } catch (error) {
            toast.error(error instanceof Error && error.name === "InsufficientSavingsError" ? error.message : getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}
