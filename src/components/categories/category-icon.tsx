import { CATEGORY_COLORS } from "@/lib/constants/colors";
import { CATEGORY_ICONS } from "@/lib/constants/icons";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const SIZES = {
  sm: "size-8 rounded-xl [&_svg]:size-4",
  md: "size-10 rounded-2xl [&_svg]:size-5",
  lg: "size-12 rounded-2xl [&_svg]:size-6",
} as const;

interface CategoryIconProps {
  category: Pick<Category, "icon" | "color">;
  size?: keyof typeof SIZES;
  className?: string;
}

export function CategoryIcon({ category, size = "md", className }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category.icon];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZES[size],
        CATEGORY_COLORS[category.color].tile,
        className,
      )}
    >
      <Icon strokeWidth={2} />
    </span>
  );
}
