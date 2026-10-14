"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import { ACTIVITY_NOTE_MAX } from "@/lib/constants/activities";
import { atTimeOnDay, type DateKey, fromDateKey, parseTimeOfDay } from "@/lib/activities/dates";
import { isDone } from "@/lib/activities/stats";
import { haptic } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/services/errors";
import { deleteActivityLog, DuplicateLogError, editActivityLog, logActivity, restoreActivityLog } from "@/lib/services/activity.service";
import { cn } from "@/lib/utils";
import { type LogFormValues, logFormSchema, optionalNumber } from "@/lib/validation/activities";
import { useSession } from "@/providers/auth-provider";
import { useActivityTracker } from "@/providers/activity-provider";
import type { ActivityLog } from "@/types/activities";

import { ActivityIcon } from "./activity-icon";
import { whenLabel } from "./use-activity-actions";

export interface LogTarget {
  activityId?: string;
  date?: DateKey;
  log?: ActivityLog;
}

interface LogSheetProps {
  target: LogTarget | null;
  onOpenChange: (open: boolean) => void;
}

/** Add a record for any past day, or correct/delete an existing one. */
export function LogSheet({ target, onOpenChange }: LogSheetProps) {
  const { get } = useActivityTracker();
  const editing = target?.log ?? null;
  const name = editing ? get(editing.activityId)?.name : target?.activityId ? get(target.activityId)?.name : null;
  return (
    <ResponsiveModal
      open={target !== null}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${name ?? "record"}` : name ? `Log ${name}` : "Log activity"}
      description={editing ? "Change the day, time or details — streaks and stats update automatically." : "Record a session — today or any day you missed logging."}
      preventAutoFocus
    >
      {target ? <LogForm target={target} onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveModal>
  );
}

const timeOf = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function LogForm({ target, onDone }: { target: LogTarget; onDone: () => void }) {
  const { user } = useSession();
  const { live, activities, get, index, today } = useActivityTracker();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = target.log ?? null;
  const options = editing && !live.some((a) => a.id === editing.activityId) ? [...live, ...activities.filter((a) => a.id === editing.activityId)] : live;
  const {
    control,
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LogFormValues>({
    resolver: zodResolver(logFormSchema),
    defaultValues: editing
      ? {
          activityId: editing.activityId,
          date: editing.date,
          time: timeOf(editing.completedAt),
          durationMin: editing.durationMin !== null ? String(editing.durationMin) : "",
          quantity: editing.quantity !== null ? String(editing.quantity) : "",
          note: editing.note,
        }
      : { activityId: target.activityId ?? (options.length === 1 ? options[0].id : ""), date: target.date ?? today, time: timeOf(new Date()), durationMin: "", quantity: "", note: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- labels follow the chosen activity.
  const [activityId, date] = watch(["activityId", "date"]);
  const activity = get(activityId);

  const onSubmit = handleSubmit(async (values) => {
    const chosen = get(values.activityId);
    if (!chosen) return setError("activityId", { message: "Pick an activity" });
    if (values.date > today) return setError("date", { message: "That day hasn't happened yet" });
    const input = {
      activityId: chosen.id,
      date: values.date,
      completedAt: atTimeOnDay(values.date, parseTimeOfDay(values.time) ?? 720),
      durationMin: optionalNumber(values.durationMin),
      quantity: optionalNumber(values.quantity),
      note: values.note.trim(),
    };
    try {
      if (editing) {
        const { committed } = editActivityLog(user.uid, chosen, editing, input, (aid, d) => isDone(index, aid, d));
        await settleQuickly(committed);
        toast.success("Record updated", { description: values.date < chosen.startDate ? `${chosen.name} now starts on ${format(fromDateKey(values.date), "d MMM")}.` : undefined });
      } else {
        if (!chosen.multipleEntries && isDone(index, chosen.id, values.date)) {
          return setError("date", { message: `${chosen.name} is already checked off ${whenLabel(values.date, today)} — edit that record instead` });
        }
        const { id, committed } = logActivity(user.uid, chosen, input);
        const result = await settleQuickly(committed);
        if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
        haptic("success");
        toast.success(`${chosen.name} logged ${whenLabel(values.date, today)}`, {
          description:
            result === "pending"
              ? "Saved on this device — will sync when you're back online."
              : values.date < chosen.startDate
                ? `${chosen.name} now starts on ${format(fromDateKey(values.date), "d MMM")}.`
                : undefined,
          action: { label: "Undo", onClick: () => void deleteActivityLog(user.uid, id).catch((e) => toast.error(getErrorMessage(e))) },
        });
      }
      onDone();
    } catch (error) {
      if (error instanceof DuplicateLogError) return setError("date", { message: error.message });
      toast.error("Couldn't save the record", { description: getErrorMessage(error) });
    }
  });

  async function onDelete() {
    if (!editing) return;
    try {
      await settleQuickly(deleteActivityLog(user.uid, editing.id));
      setConfirmDelete(false);
      onDone();
      toast.success("Record deleted", {
        action: { label: "Undo", onClick: () => void restoreActivityLog(user.uid, editing).catch((e) => toast.error(getErrorMessage(e))) },
      });
    } catch (error) {
      toast.error("Couldn't delete", { description: getErrorMessage(error) });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        {options.length > 1 || !activity ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Activity</legend>
            <Controller
              control={control}
              name="activityId"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Activity" aria-invalid={Boolean(errors.activityId) || undefined} className="grid grid-cols-2 gap-2">
                  {options.map((a) => {
                    const checked = field.value === a.id;
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          "flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border px-2 py-1.5 text-sm font-medium transition-colors select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                          checked ? "border-primary bg-primary/8 ring-1 ring-primary dark:bg-primary/15" : "hover:bg-muted",
                        )}
                      >
                        <input type="radio" name="log-activity" value={a.id} checked={checked} onChange={() => field.onChange(a.id)} className="sr-only" />
                        <ActivityIcon activity={a} size="sm" />
                        <span className="min-w-0 truncate">{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.activityId ? <p role="alert" className="mt-1.5 text-sm text-destructive">{errors.activityId.message}</p> : null}
          </fieldset>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <ActivityIcon activity={activity} />
            <div className="min-w-0">
              <p className="truncate font-medium">{activity.name}</p>
              <p className="text-xs text-muted-foreground">{date ? format(fromDateKey(date), "EEEE d MMMM yyyy") : ""}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <FormField id="log-date" label="Day" error={errors.date?.message}>
            <Input {...fieldA11y("log-date", errors.date?.message)} type="date" max={today} className="h-11 rounded-xl" {...register("date")} />
          </FormField>
          <FormField id="log-time" label="Time" error={errors.time?.message}>
            <Input {...fieldA11y("log-time", errors.time?.message)} type="time" className="h-11 rounded-xl" {...register("time")} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="log-duration" label="Minutes (optional)" error={errors.durationMin?.message}>
            <Input
              {...fieldA11y("log-duration", errors.durationMin?.message)}
              inputMode="numeric"
              placeholder={activity?.targetDuration ? String(activity.targetDuration) : "—"}
              className="h-11 rounded-xl"
              {...register("durationMin")}
            />
          </FormField>
          <FormField id="log-quantity" label={`${activity?.unit ? activity.unit.charAt(0).toUpperCase() + activity.unit.slice(1) : "Amount"} (optional)`} error={errors.quantity?.message}>
            <Input
              {...fieldA11y("log-quantity", errors.quantity?.message)}
              inputMode="decimal"
              placeholder={activity?.targetQuantity ? String(activity.targetQuantity) : "—"}
              className="h-11 rounded-xl"
              {...register("quantity")}
            />
          </FormField>
        </div>

        <FormField id="log-note" label="Note (optional)" error={errors.note?.message}>
          <Input {...fieldA11y("log-note", errors.note?.message)} placeholder="Felt great" maxLength={ACTIVITY_NOTE_MAX} autoComplete="off" enterKeyHint="done" className="h-11 rounded-xl" {...register("note")} />
        </FormField>
      </SheetBody>
      <SheetFooter>
        {editing ? (
          <Button type="button" variant="destructive" className="size-12 rounded-xl" onClick={() => setConfirmDelete(true)} aria-label="Delete record">
            <Trash2 className="size-5" aria-hidden />
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting}>{editing ? "Save changes" : "Save record"}</SubmitButton>
      </SheetFooter>
      {editing ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this record?"
          description={`${get(editing.activityId)?.name ?? "This activity"} on ${format(fromDateKey(editing.date), "EEE d MMM")} will no longer count towards streaks and stats.`}
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      ) : null}
    </form>
  );
}
