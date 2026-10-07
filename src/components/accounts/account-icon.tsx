import { ACCOUNT_TYPE_META } from "@/lib/constants/accounts";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types";

export function AccountIcon({ type, className, size = "md" }: { type: AccountType; className?: string; size?: "sm" | "md" }) {
  const { icon: Icon, tile } = ACCOUNT_TYPE_META[type];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" ? "size-7 rounded-lg [&_svg]:size-3.5" : "size-10 rounded-2xl [&_svg]:size-5",
        tile,
        className,
      )}
    >
      <Icon />
    </span>
  );
}
