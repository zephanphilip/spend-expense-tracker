"use client";

import { format } from "date-fns";
import { Minus, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Stat } from "@/components/common/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvestmentHistory } from "@/hooks/use-finance-queries";
import { INVESTMENT_KIND_LABELS } from "@/lib/constants/accounts";
import { investmentReturns } from "@/lib/finance/investments";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteInvestment } from "@/lib/services/investment.service";
import { useSession } from "@/providers/auth-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";
import type { InvestmentTxKind } from "@/types";

import { InvestmentTxSheet } from "./investment-tx-sheet";
import { Returns } from "./returns";

const LABEL: Record<InvestmentTxKind, string> = { BUY: "Invested", SELL: "Sold", VALUATION: "Value updated" };

export function InvestmentDetailView({ investmentId }: { investmentId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { investments } = useFinance();
  const { name } = useAccounts();
  const history = useInvestmentHistory(investmentId);
  const [action, setAction] = useState<InvestmentTxKind | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (investments.status === "loading") return <Skeleton className="h-96 rounded-3xl" aria-label="Loading investment" />;
  if (investments.status === "error") return <ErrorState error={investments.error} onRetry={investments.retry} />;
  const inv = investments.data.find((i) => i.id === investmentId);
  if (!inv) return <EmptyState icon={TrendingUp} title="Investment not found" description="It may have been deleted." />;
  const r = investmentReturns(inv);

  return (
    <div className="space-y-5">
      <PageHeader title={inv.name} description={[INVESTMENT_KIND_LABELS[inv.kind], inv.institution].filter(Boolean).join(" · ")} back={{ href: "/investments", label: "Investments" }} />

      <section aria-label="Holding value" className="space-y-3 rounded-3xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Current value</p>
        <p className="text-4xl font-semibold tracking-tight">
          <Money amount={inv.currentValue} />
        </p>
        <Returns absolute={r.absolute} ratio={r.ratio} className="text-sm font-medium" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button className="h-11 rounded-xl" onClick={() => setAction("BUY")}>
            <Plus aria-hidden />
            Invest
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setAction("SELL")} disabled={inv.currentValue === 0}>
            <Minus aria-hidden />
            Sell
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setAction("VALUATION")}>
            <RefreshCw aria-hidden />
            Value
          </Button>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Invested" value={<Money amount={inv.investedAmount} />} />
        <Stat label="Returns" value={<Returns absolute={r.absolute} ratio={r.ratio} />} />
        <Stat label="Purchased" value={format(inv.purchaseDate, "d MMM yyyy")} />
        <Stat label="Last valued" value={format(inv.lastValuedAt, "d MMM yyyy")} />
        {inv.realizedGain ? <Stat label="Realised gain" value={<Returns absolute={inv.realizedGain} ratio={null} />} className="col-span-2" /> : null}
      </dl>

      <SectionCard id="investment-history" title="History">
        {history.status === "loading" ? <Skeleton className="h-20 rounded-xl" /> : null}
        {history.status === "error" ? <ErrorState error={history.error} onRetry={history.retry} /> : null}
        {history.data?.length ? (
          <ul className="divide-y">
            {history.data.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{LABEL[tx.kind]}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {format(tx.occurredAt, "d MMM yyyy")}
                    {tx.accountId ? ` · ${tx.kind === "BUY" ? "from" : "to"} ${name(tx.accountId)}` : ""}
                    {tx.costBasis !== null ? <> · cost <Money amount={tx.costBasis} /></> : null}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {tx.kind === "BUY" ? "+" : tx.kind === "SELL" ? "−" : "="}
                  <Money amount={tx.amount} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      <Button variant="outline" className="h-11 w-full rounded-xl text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden />
        Delete investment
      </Button>

      <InvestmentTxSheet investment={action ? inv : null} kind={action ?? "BUY"} onOpenChange={(o) => !o && setAction(null)} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${inv.name}?`}
        description="The holding and its history are removed. Money already moved to or from accounts stays as it is."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await deleteInvestment(user.uid, inv.id);
            setDeleting(false);
            router.replace("/investments");
            toast.success("Investment deleted");
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
        }}
      />
    </div>
  );
}
