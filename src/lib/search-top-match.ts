import type { Addon } from "./addons";
import type { Meta } from "./cinemeta";
import type { AnimeHit, SearchResults } from "./search";
import { addonConfigurationKey } from "./addon-configuration-key";
import { metadataAddonKey, orderedMetadataAddons } from "./metadata-addons";
import { normalizeSearchQuery } from "./search-query";

// Compare titles without punctuation: "Bleach: Thousand-Year Blood War" and
// "Bleach Thousand Year Blood War" are the same result.
function titleKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function sameSearchTitle(name: string | null | undefined, query: string): boolean {
  if (!name) return false;
  return titleKey(name) === titleKey(query);
}

function animeYear(hit: AnimeHit): number {
  const year = Number(hit.year);
  return Number.isFinite(year) && year > 0 ? year : Number.POSITIVE_INFINITY;
}

export function animeTopMatch(anime: AnimeHit[], query: string): SearchResults["topMatch"] {
  const wanted = titleKey(query);
  if (!wanted) return null;
  const exact = anime.find((a) => titleKey(a.name) === wanted);
  const prefix = anime.filter((a) => wanted.length >= 4 && titleKey(a.name).startsWith(wanted));
  // A franchise prefix like "rascal does not dream of" matches several entries;
  // use the oldest, which is the franchise's base series, not the newest cour.
  const earliest = prefix.sort((a, b) => animeYear(a) - animeYear(b))[0];
  const contains =
    wanted.split(" ").length >= 2 ? anime.filter((a) => titleKey(a.name).includes(wanted)) : [];
  const hit = exact ?? earliest ?? (contains.length === 1 ? contains[0] : undefined);
  if (!hit) return null;
  const id = hit.kitsuId
    ? `kitsu:${hit.kitsuId}`
    : hit.malId
      ? `mal:${hit.malId}`
      : hit.anilistId
        ? `anilist:${hit.anilistId}`
        : null;
  if (!id) return null;
  const meta = {
    id,
    type: "anime",
    name: hit.name,
    poster: hit.poster ?? undefined,
    background: hit.background ?? hit.poster ?? undefined,
    description: hit.overview,
    releaseInfo: hit.year ?? undefined,
    imdbRating: hit.score > 0 ? hit.score.toFixed(1) : undefined,
    malId: hit.malId || undefined,
    animeFormat: hit.format ?? undefined,
  } as Meta;
  return {
    kind: "series",
    meta,
    popularity: 0,
    backdrop: hit.background ?? hit.poster ?? undefined,
    overview: hit.overview,
    voteAverage: hit.score > 0 ? hit.score : undefined,
  };
}

function firstYear(value: string | null | undefined): number | null {
  const match = (value ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/**
 * Whether a film or series from the general catalogue is the same work as a
 * listed anime, so that only the anime entry is shown. A shared title is not
 * enough: "Dune" (2021) is not the animated music video "DUNE". A music video
 * is never a film's twin (the general catalogue does not list them, and they
 * often carry no year to compare). Otherwise years one apart still agree (a
 * season dated by its first or last broadcast), and a missing year agrees with
 * anything.
 */
export function isAnimeTwin(
  meta: { name?: string; releaseInfo?: string | null },
  anime: readonly Pick<AnimeHit, "name" | "year" | "format">[],
): boolean {
  const key = titleKey(meta.name ?? "");
  if (!key) return false;
  const year = firstYear(meta.releaseInfo);
  return anime.some((hit) => {
    if (titleKey(hit.name) !== key || /^music$/i.test(hit.format?.trim() ?? "")) return false;
    const animeYear = firstYear(hit.year);
    return year === null || animeYear === null || Math.abs(year - animeYear) <= 1;
  });
}

// A music video, special or short is rarely what a bare title asks for.
function isMinorAnimeFormat(format: string | null | undefined): boolean {
  if (!format) return false;
  return !/^(tv|movie)$/i.test(format.trim());
}

function topMatchFromMeta(meta: Meta): NonNullable<SearchResults["topMatch"]> {
  const rating = Number(meta.imdbRating);
  return {
    kind: meta.type === "series" ? "series" : "movie",
    meta,
    popularity: 0,
    backdrop: meta.background ?? meta.poster ?? undefined,
    overview: meta.description,
    voteAverage: Number.isFinite(rating) && rating > 0 ? rating : undefined,
  };
}

/**
 * The top match once every source has answered. TMDB models a later anime cour
 * as a season of the franchise, so its match is the older series; an anime
 * with the query's own title is preferred over a configured match with another
 * title. The exception is a minor anime entry (music video, special, short)
 * that shares its title with a film or series in the results: the film leads.
 * `movies` and `series` are the lists as shown, with anime twins already out.
 */
export function chooseTopMatch(input: {
  configured: SearchResults["topMatch"];
  anime: AnimeHit[];
  query: string;
  movies: readonly Meta[];
  series: readonly Meta[];
}): SearchResults["topMatch"] {
  const { configured, anime, query } = input;
  const animeTop = animeTopMatch(anime, query);
  if (!animeTop || sameSearchTitle(configured?.meta.name, query)) return configured;
  if (isMinorAnimeFormat(animeTop.meta.animeFormat)) {
    const namesake = [...input.movies, ...input.series].find((meta) =>
      sameSearchTitle(meta.name, query),
    );
    if (namesake) return configured ?? topMatchFromMeta(namesake);
  }
  return animeTop;
}

export function addonsBeforeTmdb(addons: Addon[], chain: string[]): Addon[] {
  const tmdbAt = chain.indexOf("tmdb");
  if (tmdbAt <= 0) return [];
  const keys = new Set(
    chain
      .slice(0, tmdbAt)
      .filter((id) => id.startsWith("addon:"))
      .map((id) => id.slice("addon:".length)),
  );
  return addons.filter((addon) => keys.has(metadataAddonKey(addon)));
}

export function prioritizedTopMatch({
  chain,
  tmdbTop,
  addonTop,
  earlyAddonTop,
  tmdbEnabled,
}: {
  chain: string[];
  tmdbTop: SearchResults["topMatch"];
  addonTop: SearchResults["topMatch"];
  earlyAddonTop: SearchResults["topMatch"];
  tmdbEnabled: boolean;
}): SearchResults["topMatch"] {
  // The explicit TMDB toggle takes precedence over the metadata source order.
  if (tmdbEnabled && tmdbTop) return tmdbTop;
  if (chain.length === 0) return tmdbEnabled ? (tmdbTop ?? addonTop) : addonTop;
  const tmdbAt = chain.indexOf("tmdb");
  if (tmdbAt < 0) return addonTop;
  return earlyAddonTop ?? (tmdbEnabled ? tmdbTop : null) ?? addonTop;
}

export function addonTopMatch(
  addons: Addon[],
  metas: Meta[],
  query: string,
  order?: string[],
): SearchResults["topMatch"] {
  const wanted = normalizeSearchQuery(query);
  for (const addon of orderedMetadataAddons(addons, order)) {
    const key = metadataAddonKey(addon);
    const matches = metas.filter((meta) => {
      if (
        !meta.id ||
        !meta.name ||
        meta.isCollection ||
        !["movie", "series", "anime"].includes(meta.type)
      )
        return false;
      const origin = meta.addonOrigin;
      if (!origin) return false;
      const originKey =
        origin.configurationKey ?? (origin.base ? addonConfigurationKey(origin.base) : undefined);
      return originKey ? originKey === key : origin.id === addon.manifest.id;
    });
    const score = (meta: Meta) => {
      const name = normalizeSearchQuery(meta.name);
      return name === wanted ? 2 : name.startsWith(wanted) ? 1 : 0;
    };
    matches.sort((a, b) => score(b) - score(a));
    const meta = matches[0];
    if (meta)
      return {
        kind: meta.type === "movie" ? "movie" : "series",
        meta,
        popularity: 0,
        backdrop: meta.background,
        overview: meta.description,
      };
  }
  return null;
}
