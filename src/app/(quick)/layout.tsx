import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { CategoriesProvider } from "@/providers/categories-provider";

/**
 * Deliberately not the (app) layout: no app shell, navigation, finance listeners, reminders
 * or charts — just auth and categories, so Quick Add is interactive as soon as possible.
 */
export default function QuickLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CategoriesProvider>{children}</CategoriesProvider>
    </AuthGuard>
  );
}
