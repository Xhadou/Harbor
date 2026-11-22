import { isMacDesktop } from "@/lib/platform";

/**
 * What the card previews share across the app: when one was last open (the
 * next card opens sooner), whether one is playing (the page's own trailer
 * waits), and whether the person turned their sound on.
 */

let openCount = 0;
let lastOpenAt: number | null = null;

/** A preview opened; the returned call marks it closed. */
export function markPreviewOpen(): () => void {
  openCount += 1;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    lastOpenAt = performance.now();
  };
}

/** Milliseconds since a preview was last open: 0 while one is, null before the first. */
export function sinceLastPreviewMs(): number | null {
  if (openCount > 0) return 0;
  return lastOpenAt === null ? null : performance.now() - lastOpenAt;
}

let playing = 0;
const playingSubs = new Set<() => void>();

/** A preview's video came on screen; the returned call marks it gone. */
export function markPreviewPlaying(): () => void {
  playing += 1;
  if (playing === 1) for (const fn of playingSubs) fn();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    playing = Math.max(0, playing - 1);
    if (playing === 0) for (const fn of playingSubs) fn();
  };
}

export function isCardPreviewPlaying(): boolean {
  return playing > 0;
}

export function subscribeCardPreviewPlaying(fn: () => void): () => void {
  playingSubs.add(fn);
  return () => playingSubs.delete(fn);
}

let muted = true;
const mutedSubs = new Set<() => void>();

export function isCardPreviewMuted(): boolean {
  return muted;
}

export function setCardPreviewMuted(next: boolean): void {
  if (muted === next) return;
  muted = next;
  for (const fn of mutedSubs) fn();
}

export function subscribeCardPreviewMuted(fn: () => void): () => void {
  mutedSubs.add(fn);
  return () => mutedSubs.delete(fn);
}

/** Card previews are a macOS behaviour, and the person can turn them off. */
export function cardPreviewsOn(settings: { cardPreviews: boolean }): boolean {
  return settings.cardPreviews && isMacDesktop();
}
