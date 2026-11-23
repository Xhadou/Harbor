import { AvatarImage } from "@/components/avatar-image";
import { avatarFace } from "./account-avatar";
import { useT } from "@/lib/i18n";
import { type Profile } from "@/lib/profiles";
import type { User } from "@/lib/stremio";
import type { Author } from "@/lib/theme-auth";

export function ProfileAvatar({
  profile,
  user,
  fallbackAvatar,
  size = "md",
}: {
  profile: Profile | null;
  user: User | null;
  fallbackAvatar: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const face = avatarFace({ profile, user, fallbackAvatar });

  if (face.kind === "initials") {
    const textDim =
      size === "lg"
        ? "text-base font-bold"
        : size === "sm"
          ? "text-[10px] font-bold"
          : "text-xs font-semibold";
    return (
      <div
        className={`${dim} shrink-0 overflow-hidden rounded-full flex items-center justify-center text-white shadow-sm ring-1 ring-edge`}
        style={{ backgroundColor: face.color, boxShadow: `0 0 0 2px ${face.color}` }}
      >
        <span className={textDim}>{face.initials}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dim} shrink-0 overflow-hidden rounded-full bg-elevated`}
      style={face.ring ? { boxShadow: `0 0 0 2px ${face.ring}` } : undefined}
    >
      <AvatarImage src={face.src} className="h-full w-full object-cover" />
    </div>
  );
}

export function SubtitleText({ author }: { author: Author | null }) {
  const t = useT();
  return <>{t(author ? "Signed in to Harbor" : "Signed out of Harbor")}</>;
}
