import type { Meta } from "@/lib/cinemeta";
import { externalWatchedIds } from "@/lib/feed/external-watched";
import { movieWatchedIds } from "@/lib/movie-watched";
import { recentlyPlayed } from "@/lib/playback-history";
import { tmdbCollection, tmdbImdbId } from "@/lib/providers/tmdb";
import { watchedFlagIds } from "@/lib/watched-flag";
import { isTitleWatched } from "@/lib/watched-title";
import { collectionYears, pickCollectionFilm, type CollectionFilm } from "./collection-pick";

export type { CollectionStanding } from "./collection-pick";

export type CollectionPreview = CollectionFilm<Meta> & { count: number; years: string | null };

/** What a collection card's preview shows and plays, read from TMDB and the watch history. */
export async function collectionPreview(
  tmdbKey: string,
  collectionId: number,
): Promise<CollectionPreview | null> {
  const collection = await tmdbCollection(tmdbKey, collectionId).catch(() => null);
  if (!collection) return null;
  // History is kept under IMDb ids as often as TMDB ones; knowing both lets either match.
  await Promise.allSettled(collection.parts.map((part) => tmdbImdbId(tmdbKey, part.id)));
  const external = externalWatchedIds();
  const lookup = {
    watchedFlags: watchedFlagIds(),
    movieWatched: movieWatchedIds(),
    stremioWatched: external,
    traktKeys: external,
    localWatched: recentlyPlayed(),
  };
  const picked = pickCollectionFilm(
    collection.parts,
    (part) => isTitleWatched(part, lookup),
    new Date().toISOString().slice(0, 10),
  );
  if (!picked) return null;
  return { ...picked, count: collection.parts.length, years: collectionYears(collection.parts) };
}
