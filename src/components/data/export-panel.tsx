"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { EXPORT_LABELS, EXPORT_TYPES, type ExportType, exportFileName, exporters, toCsv } from "@/lib/csv/export";
import { fetchAllExpenses, fetchAllIncomes } from "@/lib/services/data.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts, useFinance } from "@/providers/finance-provider";
import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";

import { downloadText } from "./download";

export function ExportPanel() {
  const { user } = useSession();
  const { getCategory, customCategories } = useCategories();
  const { name } = useAccounts();
  const finance = useFinance();
  const [busy, setBusy] = useState<ExportType | null>(null);

  async function exportType(type: ExportType) {
    setBusy(type);
    try {
      const lookups = { category: getCategory, accountName: (id: string | null) => name(id) };
      let rows;
      switch (type) {
        case "expenses":
          rows = exporters.expenses(await fetchAllExpenses(user.uid), lookups);
          break;
        case "incomes":
          rows = exporters.incomes(await fetchAllIncomes(user.uid), lookups);
          break;
        case "budgets":
          rows = exporters.budgets(finance.budgets.data ?? [], lookups);
          break;
        case "emis":
          rows = exporters.emis(finance.emis.data ?? []);
          break;
        case "accounts":
          rows = exporters.accounts(finance.accounts.data ?? []);
          break;
        case "investments":
          rows = exporters.investments(finance.investments.data ?? []);
          break;
        case "recurring":
          rows = exporters.recurring(finance.recurringPayments.data ?? [], lookups);
          break;
        case "wishlist":
          rows = exporters.wishlist(finance.goals.data ?? []);
          break;
        case "categories":
          rows = exporters.categories([...DEFAULT_CATEGORIES, ...customCategories]);
          break;
      }
      downloadText(exportFileName(type), toCsv(rows));
      toast.success(`${EXPORT_LABELS[type]} exported`, { description: `${rows.length - 1} rows` });
    } catch (error) {
      toast.error("Export failed", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard id="export" title="Export">
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">CSV files open in Excel, Numbers and Google Sheets. Amounts are plain numbers.</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EXPORT_TYPES.map((type) => (
          <li key={type}>
            <Button variant="outline" className="h-11 w-full justify-start rounded-xl" onClick={() => exportType(type)} disabled={busy !== null}>
              {busy === type ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
              {EXPORT_LABELS[type]}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
