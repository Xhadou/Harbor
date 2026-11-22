/**
 * When a card opens into its preview. The first card waits for the pointer to
 * rest on it, so passing over a row opens nothing. Once one preview has been
 * open, the next card opens almost at once: the two cards then swap in one
 * movement and the row under the pointer does not shift twice.
 */

/** How long the pointer rests on a card before the first preview opens. */
export const PREVIEW_REST_MS = 500;
/** How long it rests on the next card while a preview is, or has just been, open. */
export const PREVIEW_HANDOFF_MS = 100;
/** How long after a preview closes the next card still counts as "the next card". */
export const PREVIEW_WARM_MS = 400;
/** How long a preview stays open after the pointer leaves it. Longer than the hand-off. */
export const PREVIEW_LEAVE_MS = 160;
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
