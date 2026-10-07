"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Shapes } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";
import { setCategoryArchived } from "@/lib/services/category.service";
import { getErrorMessage } from "@/lib/services/errors";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import type { Category } from "@/types";

import { CategoryFormDialog } from "./category-form-dialog";
import { CategoryIcon } from "./category-icon";

type DialogState = { open: false; category?: Category } | { open: true; category?: Category };

export function CategoriesView() {
  const { user } = useSession();
  const { customCategories, status } = useCategories();
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const active = customCategories.filter((c) => !c.archived);
  const archived = customCategories.filter((c) => c.archived);

  async function toggleArchived(category: Category) {
    const archiving = !category.archived;
    try {
      await setCategoryArchived(user.uid, category.id, archiving);
      toast.success(archiving ? `“${category.name}” archived` : `“${category.name}” restored`, {
        description: archiving ? "Past expenses keep this category." : undefined,
        action: archiving
          ? {
              label: "Undo",
              onClick: () => {
                setCategoryArchived(user.uid, category.id, false).catch((e) =>
                  toast.error(getErrorMessage(e)),
                );
              },
            }
          : undefined,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Categories"
        description="Built-in categories plus your own."
        back={{ href: "/plan", label: "Plan" }}
        action={
          <Button onClick={() => setDialog({ open: true })} className="h-10 rounded-xl">
            <Plus aria-hidden />
            New
          </Button>
        }
      />

      <section aria-labelledby="custom-title" className="space-y-3">
        <h2 id="custom-title" className="text-sm font-medium text-muted-foreground">
          Your categories
        </h2>
        {status === "loading" ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading categories">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Shapes}
            title="No custom categories"
            description="Create categories that match how you spend — coffee, pets, subscriptions."
            action={
              <Button variant="outline" onClick={() => setDialog({ open: true })} className="h-10 rounded-xl">
                <Plus aria-hidden />
                Create category
              </Button>
            }
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {active.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => setDialog({ open: true, category })}
                onToggleArchived={() => toggleArchived(category)}
              />
            ))}
          </ul>
        )}
        {status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load your custom categories. Built-in categories still work.
          </p>
        ) : null}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-title" className="space-y-3">
          <h2 id="archived-title" className="text-sm font-medium text-muted-foreground">
            Archived
          </h2>
          <ul className="divide-y rounded-2xl border bg-card opacity-80">
            {archived.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onToggleArchived={() => toggleArchived(category)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="builtin-title" className="space-y-3">
        <h2 id="builtin-title" className="text-sm font-medium text-muted-foreground">
          Built-in
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DEFAULT_CATEGORIES.map((category) => (
            <li key={category.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <CategoryIcon category={category} size="sm" />
              <span className="truncate text-sm font-medium">{category.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <CategoryFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        category={dialog.category}
      />
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onToggleArchived,
}: {
  category: Category;
  onEdit?: () => void;
  onToggleArchived: () => void;
}) {
  return (
    <li className="flex items-center gap-3 p-3">
      <CategoryIcon category={category} />
      <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
      {onEdit ? (
        <Button variant="ghost" size="icon-lg" onClick={onEdit} aria-label={`Edit ${category.name}`}>
          <Pencil aria-hidden />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={onToggleArchived}
        aria-label={category.archived ? `Restore ${category.name}` : `Archive ${category.name}`}
      >
        {category.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
      </Button>
    </li>
  );
}
