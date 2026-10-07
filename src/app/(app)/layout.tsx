import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { QuickAddLaunchRedirect } from "@/components/quick-add/launch-redirect";
import { CategoriesProvider } from "@/providers/categories-provider";
import { ExpenseSheetProvider } from "@/providers/expense-sheet-provider";
import { FinanceProvider } from "@/providers/finance-provider";
import { RemindersProvider } from "@/providers/reminders-provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CategoriesProvider>
        <FinanceProvider>
          <ExpenseSheetProvider>
            <RemindersProvider>
              <QuickAddLaunchRedirect />
              <AppShell>{children}</AppShell>
            </RemindersProvider>
          </ExpenseSheetProvider>
        </FinanceProvider>
      </CategoriesProvider>
    </AuthGuard>
  );
}
