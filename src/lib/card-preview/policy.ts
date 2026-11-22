/**
 * When a card opens into its preview. The first card waits for the pointer to
 * rest on it, so passing over a row opens nothing. Once one preview has been
 * open, the next card opens almost at once: the two cards then swap in one
 * movement and the row under the pointer does not shift twice.
 */

/** How long the pointer rests on a card before the first preview opens. */
export const PREVIEW_REST_MS = 700;
/** How long a card takes to open, or to change places with the card that opens next. */
export const PREVIEW_OPEN_MS = 680;
/** The curve it follows: it starts gently and settles, where the row's own curve leaps. */
export const PREVIEW_OPEN_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
/** How long a card takes to close when no other card opens in its place. */
export const PREVIEW_CLOSE_MS = 560;
/** The curve it closes on: it moves off without a pause and spends most of its time settling. */
export const PREVIEW_CLOSE_EASE = "cubic-bezier(0.3, 0, 0.1, 1)";
/** How long a trailer takes to give the picture, and its sound, back to the artwork. */
export const PREVIEW_TRAILER_OUT_MS = 280;
/** How long it rests on the next card while a preview is, or has just been, open. */
export const PREVIEW_HANDOFF_MS = 100;
/** How long after a preview closes the next card still counts as "the next card". */
export const PREVIEW_WARM_MS = 400;
/** How long a preview stays open after the pointer leaves it. Longer than the hand-off. */
export const PREVIEW_LEAVE_MS = 160;
/** The same wait when the pointer left the row altogether: no card is about to take over. */
export const PREVIEW_LEAVE_AWAY_MS = 60;
/** How long the pointer rests before the trailer is looked up, ahead of the card opening. */
export const PREVIEW_LOOKUP_MS = 150;

/**
 * The wait before a card opens, given how long ago a preview was last open
 * (`null`: none yet; `0`: one is open now).
 */
export function previewOpenDelay(sinceLastOpenMs: number | null): number {
  if (sinceLastOpenMs !== null && sinceLastOpenMs <= PREVIEW_WARM_MS) return PREVIEW_HANDOFF_MS;
  return PREVIEW_REST_MS;
}

export type PreviewMotion = { ms: number; ease: string };

/**
 * How the cards of a row change width. While a card is open, every card moves
 * on the opening curve, so a card that closes because its neighbour opens gives
 * up exactly the width the neighbour takes and the rest of the row stays still.
 * A card that closes with nothing opening after it has its own, shorter return.
 */
export function previewMotion(cardOpen: boolean): PreviewMotion {
  return cardOpen
    ? { ms: PREVIEW_OPEN_MS, ease: PREVIEW_OPEN_EASE }
    : { ms: PREVIEW_CLOSE_MS, ease: PREVIEW_CLOSE_EASE };
}

/** The four numbers of a `cubic-bezier(...)` curve, or null for anything else. */
export function bezierPoints(ease: string): [number, number, number, number] | null {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(ease.trim());
  if (!match) return null;
  const points = match[1].split(",").map((part) => Number(part));
  if (points.length !== 4 || points.some((value) => !Number.isFinite(value))) return null;
  return [points[0], points[1], points[2], points[3]];
}

/**
 * How far along a CSS curve is at `t` (0 to 1): what the browser computes for
 * a transition, for the script that has to move in step with one.
 */
export function easeProgress(ease: string, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const points = bezierPoints(ease);
  if (!points) return t;
  const [x1, y1, x2, y2] = points;
  const along = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  // The curve gives x and y for a parameter s; find the s whose x is t.
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (along(x1, x2, mid) < t) low = mid;
    else high = mid;
  }
  return along(y1, y2, (low + high) / 2);
}
