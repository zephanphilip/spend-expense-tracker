import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ActivityReminders } from "@/components/activities/activity-reminders";
import { AppShell } from "@/components/layout/app-shell";
import { QuickAddLaunchRedirect } from "@/components/quick-add/launch-redirect";
import { CategoriesProvider } from "@/providers/categories-provider";
import { ExpenseSheetProvider } from "@/providers/expense-sheet-provider";
import { FinanceProvider } from "@/providers/finance-provider";
import { ActivityProvider } from "@/providers/activity-provider";
import { RemindersProvider } from "@/providers/reminders-provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CategoriesProvider>
        <FinanceProvider>
          <ExpenseSheetProvider>
            <RemindersProvider>
              <ActivityProvider>
                <QuickAddLaunchRedirect />
                <ActivityReminders />
                <AppShell>{children}</AppShell>
              </ActivityProvider>
            </RemindersProvider>
          </ExpenseSheetProvider>
        </FinanceProvider>
      </CategoriesProvider>
    </AuthGuard>
  );
}
