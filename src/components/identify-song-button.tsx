import { useState } from "react";
import { AudioLines } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { identifyNowPlaying } from "@/lib/song-id";
import { Tooltip } from "@/components/player/transport/tooltip";
import { useT } from "@/lib/i18n";

/** Song identification as an action, for a button or a menu row. */
export function useIdentifySong() {
  const { settings } = useSettings();
  const [pending, setPending] = useState(false);

  const identify = async () => {
    if (pending) return;
    setPending(true);
    try {
      await identifyNowPlaying({
        provider: settings.songIdProvider,
        auddKey: settings.auddKey ?? "",
        aiKey: settings.songIdAiKey ?? "",
        aiModel: settings.songIdAiModel ?? "",
      });
    } finally {
      setPending(false);
    }
  };

  return { enabled: settings.songIdEnabled, pending, identify };
}

export function IdentifySongButton({
  className,
  tight,
  editing,
  iconUrl,
}: {
  className?: string;
  tight?: boolean;
  editing?: boolean;
  iconUrl?: string;
}) {
  const t = useT();
  const { enabled, pending, identify } = useIdentifySong();

  if (!enabled && !editing) return null;

  return (
    <Tooltip label={t("Identify song")}>
      <button
        type="button"
        onClick={identify}
        disabled={pending}
        aria-label={t("Identify song")}
        className={
          className ??
          "mac-player-btn pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 disabled:opacity-50"
        }
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            draggable={false}
            className={`h-[22px] w-[22px] select-none object-contain ${pending ? "animate-pulse" : ""}`}
          />
        ) : (
          <AudioLines
            size={tight ? 18 : 22}
            strokeWidth={1.9}
            className={pending ? "animate-pulse" : undefined}
          />
        )}
      </button>
    </Tooltip>
  );
}
