// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { placeShownForSearch } from "../src/lib/search-sections";

test("macOS search leaves out a place hidden from the sidebar", () => {
  const hidden = ["music", "ebook"];
  assert.equal(placeShownForSearch("music", hidden, true), false);
  assert.equal(placeShownForSearch("ebook", hidden, true), false);
  assert.equal(placeShownForSearch("sports", hidden, true), true);
  assert.equal(placeShownForSearch("movies", [], true), true);
});

test("other platforms search every place whatever the sidebar shows", () => {
  assert.equal(placeShownForSearch("music", ["music"], false), true);
});
