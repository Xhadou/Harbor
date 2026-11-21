// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  animeTopMatch,
  chooseTopMatch,
  isAnimeTwin,
  sameSearchTitle,
} from "../src/lib/search-top-match.ts";
import type { Meta } from "../src/lib/cinemeta.ts";
import type { AnimeHit } from "../src/lib/search.ts";

function hit(name: string, kitsuId: number, year: string): AnimeHit {
  return {
    malId: kitsuId,
    kitsuId,
    format: "TV",
    name,
    year,
    poster: null,
    background: null,
    overview: "",
    score: 8.5,
  };
}

test("an exact or prefix anime title becomes the top match", () => {
  const hits = [
    hit("Rascal Does Not Dream of Santa Claus", 48917, "2025"),
    hit("Rascal Does Not Dream of Bunny Girl Senpai", 41056, "2018"),
    hit("Bleach: Thousand-Year Blood War", 41467, "2022"),
    hit("Bleach: Thousand-Year Blood War - The Separation", 49900, "2023"),
  ];

  assert.equal(animeTopMatch(hits, "Rascal Does Not Dream of Santa Claus")?.meta.id, "kitsu:48917");
  assert.equal(animeTopMatch(hits, "rascal does not dream of")?.meta.id, "kitsu:41056");
  assert.equal(animeTopMatch(hits, "santa claus")?.meta.id, "kitsu:48917");
  assert.equal(
    animeTopMatch(hits, "bleach thousand")?.meta.name,
    "Bleach: Thousand-Year Blood War",
  );
});

test("an exact top match keeps its source", () => {
  assert.equal(sameSearchTitle("Bleach", "bleach"), true);
  assert.equal(sameSearchTitle("Bleach", "bleach thousand"), false);
  assert.equal(
    sameSearchTitle("Rascal Does Not Dream of Bunny Girl Senpai", "rascal santa claus"),
    false,
  );
});

test("a film is an anime's twin only when title and year agree", () => {
  const anime = [hit("DUNE", 1, "2009"), hit("One Piece", 2, "1999"), hit("Mushishi", 3, "")];
  assert.equal(isAnimeTwin({ name: "Dune", releaseInfo: "2021" }, anime), false);
  assert.equal(isAnimeTwin({ name: "One Piece", releaseInfo: "1999-" }, anime), true);
  assert.equal(isAnimeTwin({ name: "One Piece", releaseInfo: "2000" }, anime), true);
  assert.equal(isAnimeTwin({ name: "One Piece", releaseInfo: "2023-" }, anime), false);
  // Without a year on one side the title decides, as it always did.
  assert.equal(isAnimeTwin({ name: "One Piece" }, anime), true);
  assert.equal(isAnimeTwin({ name: "Mushishi", releaseInfo: "2005" }, anime), true);
  assert.equal(isAnimeTwin({ name: "" }, anime), false);
  assert.equal(isAnimeTwin({ name: "Arrival", releaseInfo: "2016" }, anime), false);
  // A music video often has no year at all; it is still not the film.
  const video = [{ ...hit("DUNE", 4, ""), year: null, format: "MUSIC" }];
  assert.equal(isAnimeTwin({ name: "Dune", releaseInfo: "2021" }, video), false);
  assert.equal(isAnimeTwin({ name: "Dune" }, video), false);
});

test("a music video does not outrank the film that shares its title", () => {
  const video = { ...hit("DUNE", 1, "2009"), format: "MUSIC" };
  const film = { id: "tt1160419", type: "movie", name: "Dune", releaseInfo: "2021" } as Meta;
  const sequel = { id: "tt15239678", type: "movie", name: "Dune: Part Two" } as Meta;
  const top = chooseTopMatch({
    configured: null,
    anime: [video],
    query: "dune",
    movies: [sequel, film],
    series: [],
  });
  assert.equal(top?.meta.id, "tt1160419");
  assert.equal(top?.kind, "movie");
  // With no film of that title the video is still the best there is.
  assert.equal(
    chooseTopMatch({
      configured: null,
      anime: [video],
      query: "dune",
      movies: [sequel],
      series: [],
    })?.meta.id,
    "kitsu:1",
  );
});

test("a television anime keeps the top over a namesake, and a configured exact match wins", () => {
  const show = hit("One Piece", 2, "1999");
  const liveAction = { id: "tt11737520", type: "series", name: "One Piece" } as Meta;
  assert.equal(
    chooseTopMatch({
      configured: null,
      anime: [show],
      query: "one piece",
      movies: [],
      series: [liveAction],
    })?.meta.id,
    "kitsu:2",
  );
  const configured = { kind: "series" as const, meta: liveAction, popularity: 9 };
  assert.equal(
    chooseTopMatch({ configured, anime: [show], query: "one piece", movies: [], series: [] }),
    configured,
  );
  assert.equal(
    chooseTopMatch({ configured: null, anime: [], query: "one piece", movies: [], series: [] }),
    null,
  );
});
