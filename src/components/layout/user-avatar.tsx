import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

interface UserAvatarProps {
  name: string | null;
  email: string | null;
  photoURL: string | null;
  className?: string;
}

export function UserAvatar({ name, email, photoURL, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-9", className)}>
      {photoURL ? <AvatarImage src={photoURL} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
