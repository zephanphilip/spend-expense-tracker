"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleQuickly } from "@/lib/async";
import { CATEGORY_COLOR_KEYS, CATEGORY_COLORS } from "@/lib/constants/colors";
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS } from "@/lib/constants/icons";
import { createCategory, updateCategory } from "@/lib/services/category.service";
import { getErrorMessage } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import {
  CATEGORY_NAME_MAX_LENGTH,
  type CategoryFormValues,
  categorySchema,
} from "@/lib/validation/category";
import { useSession } from "@/providers/auth-provider";
import { useCategories } from "@/providers/categories-provider";
import type { Category } from "@/types";

import { CategoryIcon } from "./category-icon";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit an existing custom category; omit to create. */
  category?: Category;
  onSaved?: (id: string) => void;
}

export function CategoryFormDialog({ open, onOpenChange, category, onSaved }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On phones, pin to the top so the keyboard never covers the form. */}
      <DialogContent className="top-[max(1rem,env(safe-area-inset-top))] max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top))-1rem)] translate-y-0 overflow-y-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2">
        {open ? (
          <CategoryForm
            category={category}
            onDone={(id) => {
              onOpenChange(false);
              if (id) onSaved?.(id);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: Category;
  onDone: (id?: string) => void;
}) {
  const { user } = useSession();
  const { categories } = useCategories();
  const isEdit = Boolean(category);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, icon: category.icon, color: category.color }
      : { name: "", icon: "sparkles", color: "violet" },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- live preview only.
  const preview = watch();

  const onSubmit = handleSubmit(async (values) => {
    const duplicate = categories.some(
      (c) => c.id !== category?.id && c.name.toLowerCase() === values.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setError("name", { message: "You already have a category with that name" });
      return;
    }
    try {
      if (category) {
        await settleQuickly(updateCategory(user.uid, category.id, values));
        toast.success("Category updated");
        onDone(category.id);
      } else {
        const { id, committed } = createCategory(user.uid, values);
        const result = await settleQuickly(committed);
        if (result === "pending") {
          committed.catch((error) => toast.error(getErrorMessage(error)));
        }
        toast.success(`“${values.name.trim()}” created`);
        onDone(id);
      }
    } catch (error) {
      toast.error("Couldn't save category", { description: getErrorMessage(error) });
    }
  });

  return (
    <form
      onSubmit={(event) => {
        // This form is portaled out of the expense form, but React events still bubble
        // through portals; don't let a submit here also submit the parent expense.
        event.stopPropagation();
        void onSubmit(event);
      }}
      noValidate
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {isEdit ? "Edit category" : "New category"}
        </DialogTitle>
        <DialogDescription>Pick a name, icon and colour.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <CategoryIcon category={preview} size="lg" />
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            autoComplete="off"
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="e.g. Coffee"
            className="h-11 rounded-xl"
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "category-name-error" : undefined}
            {...register("name")}
          />
        </div>
      </div>
      {errors.name ? (
        <p id="category-name-error" role="alert" className="-mt-3 text-sm text-destructive">
          {errors.name.message}
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Icon" className="grid grid-cols-7 gap-1">
              {CATEGORY_ICON_KEYS.map((key) => {
                const Icon = CATEGORY_ICONS[key];
                const checked = field.value === key;
                return (
                  <label
                    key={key}
                    className={cn(
                      "flex aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      checked ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={key}
                      checked={checked}
                      onChange={() => field.onChange(key)}
                      className="sr-only"
                      aria-label={key.charAt(0).toUpperCase() + key.slice(1)}
                    />
                    <Icon className="size-5" aria-hidden />
                  </label>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_KEYS.map((key) => {
                const checked = field.value === key;
                return (
                  <label
                    key={key}
                    className={cn(
                      "flex size-9 cursor-pointer items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition-shadow has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      CATEGORY_COLORS[key].solid,
                      checked && "ring-2 ring-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="color"
                      value={key}
                      checked={checked}
                      onChange={() => field.onChange(key)}
                      className="sr-only"
                      aria-label={CATEGORY_COLORS[key].label}
                    />
                    {checked ? <Check className="size-4" aria-hidden /> : null}
                  </label>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-xl text-base">
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isEdit ? "Save changes" : "Create category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
