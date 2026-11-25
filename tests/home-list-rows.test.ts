// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { withoutListRows } from "../src/lib/home-customization.ts";

test("Home's list rows become collection rows and keep their place, name and settings", () => {
  const moved = withoutListRows({
    order: ["continue", "list-a", "collection-b", "trending"],
    hidden: ["list-c"],
    renamed: { "list-a": "Weekend", trending: "Hot" },
    numerals: ["list-a"],
    heroSource: "list-a",
    customSources: [],
    listRows: ["a", "c"],
  });
  assert.deepEqual(moved.listRows, []);
  assert.deepEqual(moved.order, ["continue", "collection-a", "collection-b", "trending"]);
  assert.deepEqual(moved.hidden, ["collection-c"]);
  assert.deepEqual(moved.renamed, { "collection-a": "Weekend", trending: "Hot" });
  assert.deepEqual(moved.numerals, ["collection-a"]);
  assert.equal(moved.heroSource, "collection-a");
});

test("a list row already shown as a collection row is not listed twice", () => {
  const moved = withoutListRows({
    order: ["list-a", "collection-a"],
    hidden: [],
    renamed: {},
    numerals: [],
    heroSource: null,
    customSources: [],
    listRows: ["a"],
  });
  assert.deepEqual(moved.order, ["collection-a"]);
});
