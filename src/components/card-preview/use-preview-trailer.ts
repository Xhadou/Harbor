import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { heroTrailerLeadIn } from "@/components/hero-size";
import {
  isCardPreviewMuted,
  markPreviewPlaying,
  setCardPreviewMuted,
  subscribeCardPreviewMuted,
} from "@/lib/card-preview/store";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import {
  fetchTrailer,
  resolveTrailerId,
  trailerSrc,
  type Quality,
  type TrailerInfo,
} from "@/lib/trailer";
import { useTrailerVideo } from "@/lib/use-trailer-video";

const VIDEO_CLASS = "absolute inset-0 h-full w-full object-cover";

/**
 * The trailer a card's preview plays. It is looked up once the card is
 * `wanted`, plays once while the card is `open`, and gives the picture back to
 * the artwork when it ends. Mount `slot` where the video should appear.
 */
export function usePreviewTrailer({
  meta,
  wanted,
  open,
  quality = "360p",
}: {
  meta: Meta | null;
  wanted: boolean;
  open: boolean;
  quality?: Quality;
}) {
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey;
  const metaId = meta?.id ?? null;
  const [found, setFound] = useState<{ metaId: string; info: TrailerInfo } | null>(null);
  const [ended, setEnded] = useState(false);
  const muted = useSyncExternalStore(subscribeCardPreviewMuted, isCardPreviewMuted);

  useEffect(() => {
    if (!wanted || !meta || !metaId) return;
    let cancelled = false;
    void resolveTrailerId(meta, tmdbKey)
      // A preview only ever streams: the slow download a full trailer falls back to is no use
      // to a card the pointer may already have left.
      .then((id) => (id && !cancelled ? fetchTrailer(id, quality, false, false) : null))
      .then((info) => {
        if (!cancelled && info) setFound({ metaId, info });
      });
    return () => {
      cancelled = true;
    };
    // `meta` is read for its id and type only; a new object for the same title is not a new lookup.
  }, [wanted, metaId, quality, tmdbKey]);

  useEffect(() => {
    if (!open) setEnded(false);
  }, [open]);

  const info = found && found.metaId === metaId ? found.info : null;
  const { slot, ready } = useTrailerVideo({
    src: info ? trailerSrc(info) : null,
    active: open && !!info && !ended,
    playing: open && !ended,
    muted,
    loop: false,
    startAt: heroTrailerLeadIn(),
    channel: "card",
    className: VIDEO_CLASS,
    onEnded: () => setEnded(true),
    onAutoplayMuted: () => setCardPreviewMuted(true),
  });
  const showing = open && ready && !ended;

  useEffect(() => {
    if (!showing) return;
    return markPreviewPlaying();
  }, [showing]);

  const toggleMuted = useCallback(() => setCardPreviewMuted(!isCardPreviewMuted()), []);

  return { slot, showing, muted, toggleMuted };
}
