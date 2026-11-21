export type CardBadge = "status" | "award" | "dub";

/**
 * The one badge a poster carries on macOS, when it could carry several: what
 * is true of the title right now (new, in cinemas, back on screens), else what
 * it won, else that a dub exists. Null when it has none of them.
 */
export function oneCardBadge(has: Record<CardBadge, boolean>): CardBadge | null {
  if (has.status) return "status";
  if (has.award) return "award";
  if (has.dub) return "dub";
  return null;
}
