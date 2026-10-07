"use client";

import { format } from "date-fns";
import { Landmark, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { useEmiPayments } from "@/hooks/use-finance-queries";
import { emiOverview } from "@/lib/finance/emi";
import { deleteEmi, undoLastEmiPayment } from "@/lib/services/emi.service";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/auth-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";

import { EmiPaymentSheet } from "./emi-payment-sheet";
import { EmiSheet } from "./emi-sheet";

export function EmiDetailView({ emiId }: { emiId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { emis } = useFinance();
  const { accountExists } = useAccounts();
  const payments = useEmiPayments(emiId);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "undo" | null>(null);

  if (emis.status === "loading") return <Skeleton className="h-96 rounded-3xl" aria-label="Loading loan" />;
  if (emis.status === "error") return <ErrorState error={emis.error} onRetry={emis.retry} />;
  const emi = emis.data.find((e) => e.id === emiId);
  if (!emi) {
    return <EmptyState icon={Landmark} title="Loan not found" description="It may have been deleted." />;
  }

  const o = emiOverview(emi);
  const latestRecorded = payments.data?.[0];
  const canUndo = latestRecorded?.installment === emi.paidCount;
  const interestPaid = (payments.data ?? []).reduce((s, p) => s + p.interestPart, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={emi.name}
        description={emi.lender ?? undefined}
        back={{ href: "/emis", label: "EMIs" }}
        action={
          <Button variant="outline" size="icon-lg" className="rounded-xl" onClick={() => setEditing(true)} aria-label="Edit loan">
            <Pencil aria-hidden />
          </Button>
        }
      />

      <section aria-label="Loan balance" className="space-y-4 rounded-3xl bg-primary p-6 text-primary-foreground">
        <div>
          <p className="text-sm text-primary-foreground/70">Outstanding</p>
          <p className="text-4xl font-semibold tracking-tight">
            <Money amount={emi.outstanding} />
          </p>
        </div>
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="Principal repaid"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((o.principalRepaid / emi.principal) * 100)}
            className="h-2.5 overflow-hidden rounded-full bg-primary-foreground/20"
          >
            <div className="h-full rounded-full bg-primary-foreground" style={{ width: `${(o.principalRepaid / emi.principal) * 100}%` }} />
          </div>
          <p className="flex justify-between text-xs text-primary-foreground/75">
            <span>
              <Money amount={o.principalRepaid} /> repaid
            </span>
            <span>
              of <Money amount={emi.principal} />
            </span>
          </p>
        </div>
        {!o.isClosed ? (
          <Button variant="secondary" className="h-11 w-full rounded-xl" onClick={() => setPaying(true)}>
            Pay installment {emi.paidCount + 1} · <Money amount={emi.monthlyAmount} />
          </Button>
        ) : (
          <p className="rounded-xl bg-primary-foreground/10 p-3 text-center text-sm font-medium">Fully repaid 🎉</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Monthly EMI" value={<Money amount={emi.monthlyAmount} />} />
        <Stat label="Interest rate" value={`${(emi.annualRateBps / 100).toFixed(2)}%`} hint="per year" />
        <Stat label="Tenure" value={`${emi.tenureMonths} mo`} hint={`${o.remainingTenure} remaining`} />
        <Stat
          label="Next due"
          value={o.nextDueDate ? format(o.nextDueDate, "d MMM yyyy") : "—"}
          hint={o.isOverdue ? <span className="font-medium text-destructive">Overdue</span> : undefined}
        />
        <Stat label="Start → end" value={format(emi.startDate, "MMM yy")} hint={`ends ${format(o.endDate, "MMM yyyy")}`} />
        <Stat label="Total interest" value={<Money amount={o.totalInterest} />} hint={<>paid so far <Money amount={interestPaid} /></>} />
      </dl>

      <SectionCard id="emi-progress" title="Progress">
        <ProgressBar value={o.progress} tone={o.isClosed ? "ok" : "primary"} label="Installments paid" />
        <p className="mt-2 text-sm text-muted-foreground">
          {emi.paidCount} of {emi.tenureMonths} installments paid ({Math.round(o.progress * 100)}%)
        </p>
      </SectionCard>

      <SectionCard
        id="emi-payments"
        title="Payment history"
        action={
          canUndo ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirm("undo")}>
              <RotateCcw aria-hidden />
              Undo last
            </Button>
          ) : undefined
        }
      >
        {payments.status === "loading" ? <Skeleton className="h-20 rounded-xl" /> : null}
        {payments.status === "error" ? <ErrorState error={payments.error} onRetry={payments.retry} /> : null}
        {payments.status === "success" && payments.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emi.paidCount > 0
              ? `${emi.paidCount} installments were marked paid when the loan was added.`
              : "No payments recorded yet."}
          </p>
        ) : null}
        {payments.data?.length ? (
          <ul className="divide-y">
            {payments.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold tabular-nums">
                  #{p.installment}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Paid {format(p.paidAt, "d MMM yyyy")}</span>
                  <span className={cn("block text-xs text-muted-foreground")}>
                    Due {format(p.dueDate, "d MMM")} · P <Money amount={p.principalPart} /> · I <Money amount={p.interestPart} />
                  </span>
                </span>
                <Money amount={p.amount} className="font-semibold" />
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      <Button variant="outline" className="h-11 w-full rounded-xl text-destructive hover:text-destructive" onClick={() => setConfirm("delete")}>
        <Trash2 aria-hidden />
        Delete loan
      </Button>

      <EmiSheet open={editing} onOpenChange={setEditing} emi={emi} />
      <EmiPaymentSheet emi={paying ? emi : null} onOpenChange={(open) => setPaying(open)} />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        title={`Delete ${emi.name}?`}
        description="The loan and its payment history will be removed. Expenses already logged for it are kept."
        confirmLabel="Delete loan"
        onConfirm={async () => {
          try {
            await deleteEmi(user.uid, emi.id);
            setConfirm(null);
            router.replace("/emis");
            toast.success("Loan deleted");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "undo"}
        onOpenChange={(open) => setConfirm(open ? "undo" : null)}
        title={`Undo installment ${emi.paidCount}?`}
        description="The payment is removed, the balance restored, and its logged expense (if any) deleted."
        confirmLabel="Undo payment"
        icon={RotateCcw}
        onConfirm={async () => {
          try {
            await undoLastEmiPayment(user.uid, emi.id, { accountExists });
            setConfirm(null);
            toast.success("Payment undone");
          } catch (error) {
            toast.error(error instanceof Error && !("code" in error) ? error.message : getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}
