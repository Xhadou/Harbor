import { useAuth } from "@/lib/auth";
import { isNuvioProviderActive } from "@/lib/nuvio/nuvio-client";
import { useProfiles, type Profile } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import type { User } from "@/lib/stremio";

export type AvatarInputs = {
  profile: Profile | null;
  user: User | null;
  fallbackAvatar: string | null;
};

/** What a profile's picture shows: an image (null means the default cat), or initials on the profile's colour. */
export type AvatarFace =
  | { kind: "image"; src: string | null; ring: string | null }
  | { kind: "initials"; initials: string; color: string };

export function avatarFace({ profile, user, fallbackAvatar }: AvatarInputs): AvatarFace {
  const src = profile?.avatar ?? fallbackAvatar ?? user?.avatar ?? null;
  if (!src && profile?.name && profile?.color) {
    return {
      kind: "initials",
      initials: (profile.name.slice(0, 2) || "P").toUpperCase(),
      color: profile.color,
    };
  }
  return { kind: "image", src, ring: profile?.color ?? null };
}

export function useIsNuvioAccount(): boolean {
  const { settings } = useSettings();
  return (
    settings.accountProvider === "nuvio" ||
    (typeof isNuvioProviderActive === "function" ? isNuvioProviderActive() : false)
  );
}

/** The inputs the account menu's own picture is drawn from. */
export function useAccountAvatarInputs(): AvatarInputs {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const isNuvio = useIsNuvioAccount();
  const harborAvatar = settings.harborAvatar?.startsWith("/kids/avatars/")
    ? null
    : settings.harborAvatar;
  return {
    profile: activeProfile,
    user: isNuvio ? null : user,
    fallbackAvatar: isNuvio ? null : harborAvatar,
  };
}
