"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ColorPicker } from "@/components/categories/icon-color-fields";
import { fieldA11y, FormField } from "@/components/common/form-field";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Segmented } from "@/components/common/segmented";
import { FieldError, SheetBody, SheetFooter, SubmitButton } from "@/components/common/sheet-layout";
import { SwitchField } from "@/components/common/switch-field";
import { Input } from "@/components/ui/input";
import { settleQuickly } from "@/lib/async";
import {
  ACTIVITY_TEMPLATES,
  FITNESS_DESCRIPTION_MAX,
  FITNESS_ICON_KEYS,
  FITNESS_ICONS,
  FITNESS_NAME_MAX,
  FITNESS_UNIT_MAX,
  FREQUENCY_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants/fitness";
import { currentSchedule, describeSchedule } from "@/lib/fitness/schedule";
import { getErrorMessage } from "@/lib/services/errors";
import { createFitnessActivity, updateFitnessActivity } from "@/lib/services/fitness.service";
import { cn } from "@/lib/utils";
import { type ActivityFormValues, activityFormSchema, optionalNumber } from "@/lib/validation/fitness";
import { useSession } from "@/providers/auth-provider";
import { useFitness } from "@/providers/fitness-provider";
import type { FitnessActivity, FitnessActivityInput, ScheduleInput } from "@/types/fitness";

import { ActivityIcon } from "./activity-icon";

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: FitnessActivity | null;
  onCreated?: (id: string) => void;
}

export function ActivitySheet({ open, onOpenChange, activity, onCreated }: ActivitySheetProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={activity ? "Edit activity" : "New activity"}
      description={activity ? undefined : "A habit you want to keep up — you can fine-tune it later."}
      preventAutoFocus={Boolean(activity)}
    >
      {open ? <ActivityForm activity={activity ?? null} onDone={() => onOpenChange(false)} onCreated={onCreated} /> : null}
    </ResponsiveModal>
  );
}

function defaults(activity: FitnessActivity | null, today: string): ActivityFormValues {
  if (!activity) {
    return {
      name: "",
      description: "",
      icon: "run",
      color: "orange",
      kind: "daily",
      days: [1, 3, 5],
      perWeek: 3,
      every: 2,
      reminderEnabled: false,
      reminderTime: "07:00",
      startDate: today,
      endDate: "",
      targetDuration: "",
      targetQuantity: "",
      unit: "",
      multipleEntries: false,
    };
  }
  const s = currentSchedule(activity);
  return {
    name: activity.name,
    description: activity.description,
    icon: activity.icon,
    color: activity.color,
    kind: s.kind === "none" ? "daily" : s.kind,
    days: s.kind === "weekdays" ? s.days : [1, 3, 5],
    perWeek: s.perWeek ?? 3,
    every: s.every ?? 2,
    reminderEnabled: activity.reminderEnabled,
    reminderTime: activity.reminderTime ?? "07:00",
    startDate: activity.startDate,
    endDate: activity.endDate ?? "",
    targetDuration: activity.targetDuration ? String(activity.targetDuration) : "",
    targetQuantity: activity.targetQuantity ? String(activity.targetQuantity) : "",
    unit: activity.unit ?? "",
    multipleEntries: activity.multipleEntries,
  };
}

function scheduleOf(v: ActivityFormValues): ScheduleInput {
  return {
    kind: v.kind,
    days: v.kind === "weekdays" ? v.days : [],
    perWeek: v.kind === "perWeek" ? v.perWeek : null,
    every: v.kind === "interval" ? v.every : null,
  };
}

function ActivityForm({ activity, onDone, onCreated }: { activity: FitnessActivity | null; onDone: () => void; onCreated?: (id: string) => void }) {
  const { user } = useSession();
  const { today } = useFitness();
  const [advanced, setAdvanced] = useState(Boolean(activity && (activity.description || activity.targetDuration || activity.targetQuantity || activity.endDate || activity.multipleEntries)));
  const [appearance, setAppearance] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({ resolver: zodResolver(activityFormSchema), defaultValues: defaults(activity, today) });
  // eslint-disable-next-line react-hooks/incompatible-library -- live preview of icon, schedule and reminder.
  const v = watch();
  const scheduleLocked = Boolean(activity && activity.status !== "active");

  const onSubmit = handleSubmit(async (values) => {
    const input: FitnessActivityInput = {
      name: values.name.trim(),
      description: values.description.trim(),
      icon: values.icon,
      color: values.color,
      startDate: values.startDate,
      endDate: values.endDate || null,
      schedule: scheduleOf(values),
      reminderEnabled: values.reminderEnabled,
      reminderTime: values.reminderEnabled || values.reminderTime ? values.reminderTime || null : null,
      targetDuration: optionalNumber(values.targetDuration),
      targetQuantity: optionalNumber(values.targetQuantity),
      unit: values.unit.trim() || null,
      multipleEntries: values.multipleEntries,
    };
    try {
      if (activity) {
        await settleQuickly(updateFitnessActivity(user.uid, activity, input, today));
        toast.success(`${input.name} updated`);
      } else {
        const { id, committed } = createFitnessActivity(user.uid, input);
        const result = await settleQuickly(committed);
        if (result === "pending") committed.catch((e) => toast.error(getErrorMessage(e)));
        toast.success(`${input.name} added`, { description: describeSchedule(input.schedule) });
        onCreated?.(id);
      }
      onDone();
    } catch (error) {
      toast.error("Couldn't save the activity", { description: getErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        {!activity ? (
          <div role="group" aria-label="Quick start" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:-mx-6 md:px-6">
            {ACTIVITY_TEMPLATES.map((t) => {
              const picked = v.name === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => {
                    setValue("name", t.name, { shouldValidate: true });
                    setValue("icon", t.icon);
                    setValue("color", t.color);
                    setValue("targetDuration", t.targetDuration ? String(t.targetDuration) : "");
                    setValue("targetQuantity", t.targetQuantity ? String(t.targetQuantity) : "");
                    setValue("unit", t.unit ?? "");
                  }}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
                    picked ? "border-primary bg-primary/8 ring-1 ring-primary dark:bg-primary/15" : "bg-background hover:bg-muted",
                  )}
                >
                  <ActivityIcon activity={t} size="sm" className="size-7 rounded-full" />
                  {t.name}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={() => setAppearance((o) => !o)}
            aria-expanded={appearance}
            aria-label="Change icon and colour"
            className="rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ActivityIcon activity={v} size="lg" />
          </button>
          <div className="flex-1">
            <FormField id="activity-name" label="Activity" error={errors.name?.message}>
              <Input
                {...fieldA11y("activity-name", errors.name?.message)}
                placeholder="Jogging"
                maxLength={FITNESS_NAME_MAX}
                autoComplete="off"
                autoFocus={!activity}
                enterKeyHint="done"
                className="h-11 rounded-xl"
                {...register("name")}
              />
            </FormField>
          </div>
        </div>

        {appearance ? (
          <div className="space-y-4 rounded-2xl bg-muted/50 p-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Icon</legend>
              <Controller
                control={control}
                name="icon"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
                    {FITNESS_ICON_KEYS.map((key) => {
                      const Icon = FITNESS_ICONS[key];
                      const checked = field.value === key;
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                            checked ? "bg-primary text-primary-foreground" : "hover:bg-background",
                          )}
                        >
                          <input type="radio" name="activity-icon" value={key} checked={checked} onChange={() => field.onChange(key)} className="sr-only" aria-label={key} />
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
              <Controller control={control} name="color" render={({ field }) => <ColorPicker name="activity-color" value={field.value} onChange={field.onChange} />} />
            </fieldset>
          </div>
        ) : null}

        <fieldset disabled={scheduleLocked} className="space-y-3 disabled:opacity-60">
          <legend className="mb-2 text-sm font-medium">How often</legend>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Segmented
                name="activity-kind"
                label="How often"
                value={field.value}
                onChange={field.onChange}
                options={FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.short }))}
              />
            )}
          />
          {v.kind === "weekdays" ? (
            <Controller
              control={control}
              name="days"
              render={({ field }) => (
                <div role="group" aria-label="Days" className="flex justify-between gap-1">
                  {WEEKDAYS.map((d) => {
                    const on = field.value.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={on}
                        aria-label={d.label}
                        onClick={() => field.onChange(on ? field.value.filter((x) => x !== d.value) : [...field.value, d.value])}
                        className={cn(
                          "flex size-11 items-center justify-center rounded-full text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          ) : null}
          {v.kind === "perWeek" ? (
            <Controller control={control} name="perWeek" render={({ field }) => <Stepper value={field.value} min={1} max={7} onChange={field.onChange} label={(n) => `${n} day${n === 1 ? "" : "s"} a week`} />} />
          ) : null}
          {v.kind === "interval" ? (
            <Controller control={control} name="every" render={({ field }) => <Stepper value={field.value} min={2} max={60} onChange={field.onChange} label={(n) => `Every ${n} days`} />} />
          ) : null}
          <FieldError id="days-error" message={errors.days?.message} />
          {scheduleLocked ? (
            <p className="text-xs text-muted-foreground">Resume this activity to change its schedule.</p>
          ) : activity ? (
            <p className="text-xs text-muted-foreground">A new schedule applies from today — past days keep the schedule they had.</p>
          ) : null}
        </fieldset>

        <div className="space-y-3 rounded-2xl border p-3.5">
          <Controller
            control={control}
            name="reminderEnabled"
            render={({ field }) => (
              <SwitchField id="activity-reminder" label="Daily reminder" description="A nudge on days it's due, if it isn't done yet." checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          {v.reminderEnabled ? (
            <FormField id="activity-reminder-time" label="Remind me at" error={errors.reminderTime?.message}>
              <Input {...fieldA11y("activity-reminder-time", errors.reminderTime?.message)} type="time" className="h-11 rounded-xl" {...register("reminderTime")} />
            </FormField>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((o) => !o)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between rounded-xl py-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          More options
          <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} aria-hidden />
        </button>

        {advanced ? (
          <div className="space-y-4">
            <FormField id="activity-description" label="Description (optional)" error={errors.description?.message}>
              <Input {...fieldA11y("activity-description", errors.description?.message)} placeholder="Around the park" maxLength={FITNESS_DESCRIPTION_MAX} className="h-11 rounded-xl" {...register("description")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="activity-start" label="Starts" error={errors.startDate?.message}>
                <Input {...fieldA11y("activity-start", errors.startDate?.message)} type="date" className="h-11 rounded-xl" {...register("startDate")} />
              </FormField>
              <FormField id="activity-end" label="Ends (optional)" error={errors.endDate?.message}>
                <Input {...fieldA11y("activity-end", errors.endDate?.message)} type="date" min={v.startDate} className="h-11 rounded-xl" {...register("endDate")} />
              </FormField>
            </div>
            <FormField id="activity-duration" label="Target minutes (optional)" error={errors.targetDuration?.message}>
              <Input {...fieldA11y("activity-duration", errors.targetDuration?.message)} inputMode="numeric" placeholder="20" className="h-11 rounded-xl" {...register("targetDuration")} />
            </FormField>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <FormField id="activity-quantity" label="Target amount (optional)" error={errors.targetQuantity?.message}>
                <Input {...fieldA11y("activity-quantity", errors.targetQuantity?.message)} inputMode="decimal" placeholder="5000" className="h-11 rounded-xl" {...register("targetQuantity")} />
              </FormField>
              <FormField id="activity-unit" label="Unit" error={errors.unit?.message}>
                <Input {...fieldA11y("activity-unit", errors.unit?.message)} placeholder="steps" maxLength={FITNESS_UNIT_MAX} className="h-11 rounded-xl" {...register("unit")} />
              </FormField>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Targets are for reference — checking an activity off never requires them.</p>
            <Controller
              control={control}
              name="multipleEntries"
              render={({ field }) => (
                <SwitchField
                  id="activity-multi"
                  label="Several sessions a day"
                  description="Log each session separately instead of one check-in per day."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <SubmitButton pending={isSubmitting}>
          {activity ? "Save changes" : (
            <>
              <Check className="size-5" aria-hidden />
              Add activity
            </>
          )}
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: (n: number) => string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Fewer"
        className="flex size-10 items-center justify-center rounded-xl bg-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 dark:bg-input/60"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span aria-live="polite" className="text-sm font-semibold tabular-nums">
        {label(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="More"
        className="flex size-10 items-center justify-center rounded-xl bg-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 dark:bg-input/60"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
