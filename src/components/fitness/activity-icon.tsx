import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { FITNESS_ICONS } from "@/lib/constants/fitness";
import { cn } from "@/lib/utils";
import type { FitnessActivity } from "@/types/fitness";

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
  activity: Pick<FitnessActivity, "icon" | "color">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = FITNESS_ICONS[activity.icon];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], CATEGORY_COLORS[activity.color].tile, className)}>
      <Icon strokeWidth={2} />
    </span>
  );
}
