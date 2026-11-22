/** Where the person stands in a collection: nothing watched, part way, or all of it. */
export type CollectionStanding = "start" | "next" | "again";

export type CollectionFilm<T> = { film: T; standing: CollectionStanding };

/**
 * The film a collection's card plays: the first released film not yet watched,
 * or the first film when none or all of them have been.
 */
export function pickCollectionFilm<T extends { releaseDate?: string }>(
  parts: readonly T[],
  isWatched: (part: T) => boolean,
  today: string,
): CollectionFilm<T> | null {
  const released = parts.filter((part) => !!part.releaseDate && part.releaseDate <= today);
  const first = released[0];
  if (!first) return null;
  const unwatched = released.find((part) => !isWatched(part));
  if (!unwatched) return { film: first, standing: "again" };
  return { film: unwatched, standing: unwatched === first ? "start" : "next" };
}

/** "2001–2011" for a collection's films, or the one year they share. */
export function collectionYears(parts: readonly { releaseInfo?: string }[]): string | null {
  const years = parts
    .map((part) => Number(part.releaseInfo))
    .filter((year) => Number.isFinite(year) && year > 0);
  if (years.length === 0) return null;
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? String(from) : `${from}–${to}`;
}
