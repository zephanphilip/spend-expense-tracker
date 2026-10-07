"use client";

import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import { ResponsiveModal } from "@/components/common/responsive-modal";
import { ExpenseForm } from "@/components/expenses/expense-form";
import type { Expense } from "@/types";

interface ExpenseSheetContextValue {
  openCreate: () => void;
  openEdit: (expense: Expense) => void;
}

const ExpenseSheetContext = createContext<ExpenseSheetContextValue | null>(null);

interface SheetState {
  open: boolean;
  expense: Expense | null;
  /** Bumped on every open so the form always starts fresh. */
  session: number;
}

export function ExpenseSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>({ open: false, expense: null, session: 0 });

  const openCreate = useCallback(
    () => setState((s) => ({ open: true, expense: null, session: s.session + 1 })),
    [],
  );
  const openEdit = useCallback(
    (expense: Expense) => setState((s) => ({ open: true, expense, session: s.session + 1 })),
    [],
  );
  // Keep `expense` while closing so the content doesn't change mid-animation.
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const value = useMemo(() => ({ openCreate, openEdit }), [openCreate, openEdit]);
  const isEdit = state.expense !== null;

  return (
    <ExpenseSheetContext value={value}>
      {children}
      <ResponsiveModal
        open={state.open}
        onOpenChange={(open) => (open ? undefined : close())}
        title={isEdit ? "Edit expense" : "Add expense"}
        description={isEdit ? undefined : "Amount, category, done."}
        hideHeader={!isEdit}
        preventAutoFocus={isEdit}
      >
        <ExpenseForm key={state.session} expense={state.expense} onDone={close} />
      </ResponsiveModal>
    </ExpenseSheetContext>
  );
}

export function useExpenseSheet(): ExpenseSheetContextValue {
  const context = use(ExpenseSheetContext);
  if (!context) throw new Error("useExpenseSheet must be used inside <ExpenseSheetProvider>");
  return context;
}
