/**
 * How a row of cards is sized on macOS.
 *
 * The Mac app has no interface zoom. A row's cards take their width from the
 * window instead: a poster is about a seventh of the window wide, so a window
 * of any size shows the same six posters and the edge of a seventh, which also
 * says the row goes on. Gaps are tight, so the artwork is what fills the row.
 */

/** The space between two cards of a row, in pixels. */
export const MAC_ROW_GAP = 12;
/** How much of the first card beyond the whole ones stays in view. */
export const MAC_ROW_PEEK = 0.4;
/** A poster's width as a share of the window's. */
const POSTER_SHARE = 0.1377;
/** The poster row every other row is scaled from: its minimum card width. */
const POSTER_MIN = 144;
/** How far a card may shrink or grow from its row's minimum, whatever the window. */
const SCALE_MIN = 1.05;
const SCALE_MAX = 1.6;

/** The width a row's cards aim for in a window this wide. */
export function macCardTarget(min: number, windowWidth: number): number {
  const scale = (windowWidth * POSTER_SHARE) / POSTER_MIN;
  return min * Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

/** The width of each card when `count` whole cards and a part of the next fill `available`. */
function cellFor(available: number, count: number): number {
  return (available - count * MAC_ROW_GAP) / (count + MAC_ROW_PEEK);
}

/**
 * The card width for a row `available` pixels wide: the count of whole cards
 * whose width comes nearest the target, with part of one more in view.
 */
export function macRowFit(
  available: number,
  min: number,
  windowWidth: number,
): { cell: number; count: number } {
  const target = macCardTarget(min, windowWidth);
  const nearest = Math.max(
    1,
    Math.round((available - MAC_ROW_PEEK * target) / (target + MAC_ROW_GAP)),
  );
  let best = { cell: cellFor(available, nearest), count: nearest };
  for (const count of [nearest - 1, nearest + 1]) {
    if (count < 1) continue;
    const cell = cellFor(available, count);
    if (Math.abs(cell - target) < Math.abs(best.cell - target)) best = { cell, count };
  }
  return best;
}
