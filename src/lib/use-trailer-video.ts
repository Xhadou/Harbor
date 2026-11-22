import { useEffect, useRef, useState, type RefObject } from "react";
import {
  claimTrailerVideo,
  releaseTrailerVideo,
  trailerVideoHeldBy,
  type TrailerChannel,
} from "@/lib/trailer-video";

const SRC_DELAY_MS = 120;

export function useTrailerVideo(opts: {
  src: string | null;
  active: boolean;
  playing: boolean;
  muted: boolean;
  volume?: number;
  className: string;
  loop: boolean;
  /** Seconds to skip at the start, and again each time a loop restarts. */
  startAt?: number;
  onEnded?: () => void;
  onAutoplayMuted?: () => void;
  /** Which shared video to play on. A card's preview has its own, beside the page's trailer. */
  channel?: TrailerChannel;
}): {
  slot: RefObject<HTMLDivElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  ready: boolean;
} {
  const {
    src,
    active,
    playing,
    muted,
    volume = 1,
    className,
    loop,
    startAt = 0,
    onEnded,
    onAutoplayMuted,
    channel = "page",
  } = opts;
  const slot = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const token = useRef<object>({});
  const finish = useRef(onEnded);
  finish.current = onEnded;
  const autoplayMuted = useRef(onAutoplayMuted);
  autoplayMuted.current = onAutoplayMuted;
  const [readySource, setReadySource] = useState<string | null>(null);
  const ready = active && !!src && readySource === src;

  useEffect(() => {
    const mount = slot.current;
    if (!src || !active || !mount) return;
    const mine = token.current;
    const node = claimTrailerVideo(mine, mount, channel);
    video.current = node;
    node.className = className;
    node.loop = loop;
    node.playsInline = true;
    const ownsSource = () =>
      video.current === node && trailerVideoHeldBy(mine) && node.getAttribute("src") === src;
    setReadySource(ownsSource() && node.readyState >= 3 ? src : null);
    const onCanPlay = () => {
      if (ownsSource() && node.readyState >= 3) setReadySource(src);
    };
    const onFinish = () => {
      if (ownsSource()) finish.current?.();
    };
    // Skips the lead-in (a trailer's ratings card) unless the clip is too short to spare it.
    const skipLeadIn = () => {
      if (startAt <= 0 || !ownsSource()) return;
      if (Number.isFinite(node.duration) && node.duration < startAt * 4) return;
      if (node.currentTime < startAt - 0.3) node.currentTime = startAt;
    };
    node.addEventListener("canplay", onCanPlay);
    node.addEventListener("ended", onFinish);
    node.addEventListener("loadedmetadata", skipLeadIn);
    node.addEventListener("timeupdate", skipLeadIn);
    const timer = window.setTimeout(() => {
      if (video.current !== node || !trailerVideoHeldBy(mine)) return;
      if (node.getAttribute("src") === src) {
        onCanPlay();
        return;
      }
      node.preload = "auto";
      node.src = src;
    }, SRC_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      node.removeEventListener("canplay", onCanPlay);
      node.removeEventListener("ended", onFinish);
      node.removeEventListener("loadedmetadata", skipLeadIn);
      node.removeEventListener("timeupdate", skipLeadIn);
      video.current = null;
      setReadySource(null);
      releaseTrailerVideo(mine);
    };
  }, [src, active, className, loop, startAt, channel]);

  useEffect(() => {
    const node = video.current;
    const mine = token.current;
    if (!node || !trailerVideoHeldBy(mine)) return;
    node.muted = muted;
    node.volume = volume;
  }, [src, active, className, loop, ready, muted, volume]);

  useEffect(() => {
    const node = video.current;
    const mine = token.current;
    if (!node || !trailerVideoHeldBy(mine)) return;
    if (!playing || !ready || node.getAttribute("src") !== src || node.readyState < 3) {
      node.pause();
      return;
    }
    let cancelled = false;
    node.play().catch((error: unknown) => {
      if (
        cancelled ||
        !trailerVideoHeldBy(mine) ||
        node.getAttribute("src") !== src ||
        (error as { name?: string } | null)?.name !== "NotAllowedError" ||
        node.muted
      ) {
        return;
      }
      node.muted = true;
      autoplayMuted.current?.();
      node.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [src, active, className, loop, playing, ready, muted]);

  return { slot, video, ready };
}
