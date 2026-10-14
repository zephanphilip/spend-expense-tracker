import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { ACTIVITY_ICONS } from "@/lib/constants/activities";
import { cn } from "@/lib/utils";
import type { TrackedActivity } from "@/types/activities";

const SIZES = {
  sm: "size-8 rounded-xl [&_svg]:size-4",
  md: "size-11 rounded-2xl [&_svg]:size-5",
  lg: "size-14 rounded-3xl [&_svg]:size-7",
} as const;

export function ActivityIcon({
  activity,
  size = "md",
  className,
}: {
  activity: Pick<TrackedActivity, "icon" | "color">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = ACTIVITY_ICONS[activity.icon];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], CATEGORY_COLORS[activity.color].tile, className)}>
      <Icon strokeWidth={2} />
    </span>
  );
}
