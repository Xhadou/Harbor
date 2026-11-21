// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { cardBadgeCaption } from "../src/lib/card-badge-caption";

test("a score reads as who gave it, then the number", () => {
  assert.equal(cardBadgeCaption({ kind: "rating", source: "imdb", value: "7.6" }), "IMDb 7.6");
  assert.equal(cardBadgeCaption({ kind: "rating", source: "mal", value: "8.1" }), "MAL 8.1");
  assert.equal(cardBadgeCaption({ kind: "rating", source: "tmdb", value: "7.0" }), "TMDB 7.0");
  assert.equal(cardBadgeCaption({ kind: "rt", value: 91 }), "Rotten Tomatoes 91%");
  assert.equal(cardBadgeCaption({ kind: "audience", value: 88.4 }), "Audience 88%");
  assert.equal(cardBadgeCaption({ kind: "metacritic", value: 74 }), "Metacritic 74");
  assert.equal(cardBadgeCaption({ kind: "trakt", value: 81.2 }), "Trakt 81%");
  assert.equal(cardBadgeCaption({ kind: "simkl", value: 7.4 }), "Simkl 7");
});

test("Letterboxd is shown out of five, as on the poster chip elsewhere", () => {
  assert.equal(cardBadgeCaption({ kind: "letterboxd", value: 7.8 }), "Letterboxd 3.9");
});
