"use client";

import { ArrowLeftRight, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_META } from "@/lib/constants/accounts";
import { cardOutstanding } from "@/lib/finance/accounts";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/providers/finance-provider";
import type { Account } from "@/types";

import { AccountIcon } from "./account-icon";
import { AccountSheet } from "./account-sheet";
import { CardSummary } from "./card-summary";
import { TransferSheet } from "./transfer-sheet";
import { routes } from "@/lib/routes";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function AccountsView() {
  const accounts = useAccounts();
  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [paying, setPaying] = useState<Account | null>(null);

  const assets = accounts.all.filter((a) => a.type !== "credit_card");
  const cards = accounts.all.filter((a) => a.type === "credit_card");
  const balance = assets.filter((a) => a.active).reduce((s, a) => s + a.balance, 0);
  const owed = cards.reduce((s, a) => s + cardOutstanding(a), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounts & cards"
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setAdding(true)} className="h-10 rounded-xl">
            <Plus aria-hidden />
            Add
          </Button>
        }
      />

      {accounts.status === "loading" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading accounts">
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      ) : accounts.status === "error" ? (
        <ErrorState error={accounts.error} onRetry={accounts.retry} />
      ) : accounts.all.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Add your accounts"
          description="Track bank, cash, UPI wallets and credit cards. Expenses and income can then update balances automatically."
          action={
            <Button onClick={() => setAdding(true)} className="mt-2 h-11 rounded-xl px-5">
              Add an account
            </Button>
          }
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Available balance" value={<Money amount={balance} />} hint={plural(assets.filter((a) => a.active).length, "account")} />
            <Stat label="Card outstanding" value={<Money amount={owed} className={owed > 0 ? "text-destructive" : undefined} />} hint={plural(cards.length, "card")} />
          </dl>
          <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setTransferring(true)} disabled={accounts.active.length < 2}>
            <ArrowLeftRight aria-hidden />
            Transfer between accounts
          </Button>

          {assets.length ? (
            <section aria-labelledby="accounts-title" className="space-y-2">
              <h2 id="accounts-title" className="px-1 text-sm font-medium text-muted-foreground">
                Accounts
              </h2>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {assets.map((a) => (
                  <li key={a.id}>
                    <Link href={routes.account(a.id)} className={cn("flex items-center gap-3 p-4 outline-none hover:bg-muted/40 focus-visible:bg-muted/60", !a.active && "opacity-60")}>
                      <AccountIcon type={a.type} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[ACCOUNT_TYPE_META[a.type].label, a.institution, a.active ? null : "Inactive"].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Money amount={a.balance} className={cn("font-semibold", a.balance < 0 && "text-destructive")} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {cards.length ? (
            <section aria-labelledby="cards-title" className="space-y-2">
              <h2 id="cards-title" className="px-1 text-sm font-medium text-muted-foreground">
                Credit cards
              </h2>
              <ul className="space-y-3">
                {cards.map((c) => (
                  <li key={c.id} className={cn("rounded-3xl border bg-card p-4", !c.active && "opacity-60")}>
                    <Link href={routes.account(c.id)} className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <AccountIcon type="credit_card" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.institution ?? "Credit card"}</span>
                      </span>
                      <span className="text-right">
                        <Money amount={cardOutstanding(c)} className="block font-semibold" />
                        <span className="text-xs text-muted-foreground">outstanding</span>
                      </span>
                    </Link>
                    <div className="mt-3">
                      <CardSummary card={c} compact />
                    </div>
                    {cardOutstanding(c) > 0 ? (
                      <Button size="lg" variant="outline" className="mt-3 w-full rounded-xl" onClick={() => setPaying(c)}>
                        Pay card
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <AccountSheet open={adding} onOpenChange={setAdding} />
      <TransferSheet open={transferring} onOpenChange={setTransferring} />
      <TransferSheet open={paying !== null} onOpenChange={(open) => !open && setPaying(null)} payCard={paying} />
    </div>
  );
}
