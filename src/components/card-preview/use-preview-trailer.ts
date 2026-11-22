import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { heroTrailerLeadIn } from "@/components/hero-size";
import { PREVIEW_TRAILER_OUT_MS } from "@/lib/card-preview/policy";
import {
  holdPreviewVideo,
  isCardPreviewMuted,
  markPreviewPlaying,
  previewVideoWaitMs,
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
 * the artwork when it ends. When the card closes the trailer keeps running for
 * a moment while its picture and sound fade, so the artwork returns through a
 * dissolve and not a cut. Mount `slot` where the video should appear.
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

  // `leaving`: the card has closed and its trailer is fading out. `cleared`: the card that
  // closed before this one opened has let go of the video the two share.
  const [leaving, setLeaving] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setLeaving(!open);
    if (open) {
      setEnded(false);
      // Coming back to a card that is still fading its own trailer: the video is already its.
      if (leaving) setCleared(true);
    } else {
      setCleared(false);
    }
  }
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    // Asked a moment later, so a card closing in the same update has said it is fading.
    let timer = window.setTimeout(() => {
      const wait = previewVideoWaitMs();
      if (wait <= 0) setCleared(true);
      else timer = window.setTimeout(() => setCleared(true), wait);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const info = found && found.metaId === metaId ? found.info : null;
  const held = (open && cleared) || leaving;
  const { slot, ready, video } = useTrailerVideo({
    src: info ? trailerSrc(info) : null,
    active: held && !!info && !ended,
    playing: held && !ended,
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

  useEffect(() => {
    if (!leaving) return;
    const node = video.current;
    const timer = window.setTimeout(() => setLeaving(false), PREVIEW_TRAILER_OUT_MS);
    if (!node) return () => window.clearTimeout(timer);
    holdPreviewVideo(PREVIEW_TRAILER_OUT_MS);
    // The sound goes down with the picture.
    const from = node.volume;
    const startedAt = performance.now();
    let frame = 0;
    const quieten = () => {
      if (video.current !== node) return;
      const t = Math.min(1, (performance.now() - startedAt) / PREVIEW_TRAILER_OUT_MS);
      node.volume = from * (1 - t);
      if (t < 1) frame = requestAnimationFrame(quieten);
    };
    if (!node.muted) frame = requestAnimationFrame(quieten);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      // The pointer came back before the trailer was gone: it plays on at its own volume.
      if (openRef.current && video.current === node) node.volume = from;
    };
  }, [leaving, video]);

  const toggleMuted = useCallback(() => setCardPreviewMuted(!isCardPreviewMuted()), []);

  // `present`: the video is in the card, playing or fading out; its sound control stays with it.
  return { slot, showing, present: held && ready && !ended, muted, toggleMuted };
}
