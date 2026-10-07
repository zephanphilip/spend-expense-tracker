"use client";

import { ArrowLeftRight, FileText, Pencil, Scale, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountLedger } from "@/hooks/use-finance-queries";
import { ACCOUNT_TYPE_META } from "@/lib/constants/accounts";
import { accountActivity, activityTotals } from "@/lib/finance/activity";
import { cardOutstanding } from "@/lib/finance/accounts";
import { deleteAccount } from "@/lib/services/account.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";
import { useExpenseSheet } from "@/providers/expense-sheet-provider";
import { useAccounts } from "@/providers/finance-provider";

import { AccountSheet } from "./account-sheet";
import { ActivityList } from "./activity-list";
import { CardSummary } from "./card-summary";
import { ReconcileSheet } from "./reconcile-sheet";
import { StatementSheet } from "./statement-sheet";
import { TransferSheet } from "./transfer-sheet";

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const accounts = useAccounts();
  const ledger = useAccountLedger(accountId);
  const { openEdit } = useExpenseSheet();
  const [sheet, setSheet] = useState<"edit" | "transfer" | "pay" | "statement" | "reconcile" | "delete" | null>(null);
  const account = accounts.get(accountId);

  const items = useMemo(
    () =>
      account
        ? accountActivity(account.id, account.balance, {
            expenses: ledger.expenses,
            incomes: ledger.incomes,
            transfers: ledger.transfers,
            investmentTxs: ledger.investmentTxs,
          })
        : [],
    [account, ledger.expenses, ledger.incomes, ledger.transfers, ledger.investmentTxs],
  );

  if (accounts.status === "loading") return <Skeleton className="h-96 rounded-3xl" aria-label="Loading account" />;
  if (accounts.status === "error") return <ErrorState error={accounts.error} onRetry={accounts.retry} />;
  if (!account) return <EmptyState icon={Wallet} title="Account not found" description="It may have been deleted." />;

  const isCard = account.type === "credit_card";
  const totals = activityTotals(items);

  return (
    <div className="space-y-5">
      <PageHeader
        title={account.name}
        description={[ACCOUNT_TYPE_META[account.type].label, account.institution, account.active ? null : "Inactive"].filter(Boolean).join(" · ")}
        back={{ href: "/accounts", label: "Accounts" }}
        action={
          <Button variant="outline" size="icon-lg" className="rounded-xl" onClick={() => setSheet("edit")} aria-label="Edit account">
            <Pencil aria-hidden />
          </Button>
        }
      />

      <section aria-label={isCard ? "Card outstanding" : "Balance"} className="space-y-4 rounded-3xl bg-primary p-6 text-primary-foreground">
        <div>
          <p className="text-sm text-primary-foreground/70">{isCard ? "Outstanding" : "Balance"}</p>
          <p className="text-4xl font-semibold tracking-tight">
            <Money amount={isCard ? cardOutstanding(account) : account.balance} />
          </p>
          {isCard && account.balance > 0 ? (
            <p className="text-xs text-primary-foreground/75">
              Credit balance <Money amount={account.balance} />
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {isCard ? (
            <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setSheet("pay")} disabled={cardOutstanding(account) === 0}>
              Pay card
            </Button>
          ) : (
            <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setSheet("transfer")}>
              <ArrowLeftRight aria-hidden />
              Transfer
            </Button>
          )}
          <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setSheet(isCard ? "statement" : "reconcile")}>
            {isCard ? <FileText aria-hidden /> : <Scale aria-hidden />}
            {isCard ? "Statement" : "Adjust"}
          </Button>
        </div>
      </section>

      {isCard ? (
        <SectionCard id="card-details" title="Card">
          <CardSummary card={account} />
        </SectionCard>
      ) : null}

      <SectionCard
        id="account-activity"
        title="Activity"
        action={
          items.length ? (
            <span className="text-xs text-muted-foreground">
              in <Money amount={totals.moneyIn} /> · out <Money amount={totals.moneyOut} />
            </span>
          ) : undefined
        }
      >
        {ledger.status === "loading" ? <Skeleton className="h-24 rounded-xl" /> : null}
        {ledger.status === "error" ? <ErrorState error={ledger.error} onRetry={ledger.retry} /> : null}
        {ledger.status === "success" && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet. Pick this account when adding expenses or income, or transfer money in.
          </p>
        ) : null}
        {items.length ? (
          <ActivityList items={items} onSelectExpense={(item) => item.source.kind === "expense" && openEdit(item.source.expense)} />
        ) : null}
        {items.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Opening balance <Money amount={account.openingBalance} />. Right column shows the balance after each entry.
          </p>
        ) : null}
      </SectionCard>

      <div className={isCard ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
        {/* Bank-type accounts already have "Adjust" in the header; cards use it for statements. */}
        {isCard ? (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setSheet("reconcile")}>
            <Scale aria-hidden />
            Adjust outstanding
          </Button>
        ) : null}
        <Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => setSheet("delete")}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>

      <AccountSheet open={sheet === "edit"} onOpenChange={(o) => setSheet(o ? "edit" : null)} account={account} />
      <TransferSheet open={sheet === "transfer"} onOpenChange={(o) => setSheet(o ? "transfer" : null)} from={account} />
      <TransferSheet open={sheet === "pay"} onOpenChange={(o) => setSheet(o ? "pay" : null)} payCard={account} />
      <StatementSheet card={sheet === "statement" ? account : null} onOpenChange={(o) => setSheet(o ? "statement" : null)} />
      <ReconcileSheet account={sheet === "reconcile" ? account : null} onOpenChange={(o) => setSheet(o ? "reconcile" : null)} />
      <ConfirmDialog
        open={sheet === "delete"}
        onOpenChange={(o) => setSheet(o ? "delete" : null)}
        title={`Delete ${account.name}?`}
        description="Expenses and transfers that used it are kept and show “Deleted account”. Consider marking it inactive instead."
        confirmLabel="Delete account"
        onConfirm={async () => {
          try {
            await deleteAccount(user.uid, account.id);
            setSheet(null);
            router.replace("/accounts");
            toast.success("Account deleted");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}
