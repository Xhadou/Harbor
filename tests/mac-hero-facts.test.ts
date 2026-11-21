import assert from "node:assert/strict";
import test from "node:test";
import { heroFacts } from "../src/lib/hero-facts";

test("a hero's facts read when, how long, what kind", () => {
  assert.deepEqual(
    heroFacts({ releaseInfo: "2026", runtime: "173 min", genres: ["Drama", "Romance", "War"] }),
    ["2026", "173 min", "Drama, Romance"],
  );
});

test("a missing fact leaves no gap", () => {
  assert.deepEqual(heroFacts({ releaseInfo: "2025–" }), ["2025–"]);
  assert.deepEqual(heroFacts({ runtime: " 47 min ", genres: [] }), ["47 min"]);
  assert.deepEqual(heroFacts({ genres: ["", "Anime"] }), ["Anime"]);
  assert.deepEqual(heroFacts({}), []);
});
