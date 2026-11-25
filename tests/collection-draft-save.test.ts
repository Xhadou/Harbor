// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { registerHooks } from "node:module";
import { passThrough } from "./_module-hooks.ts";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";

// Supply Vite's environment only at the configuration boundary when running in Node.
const endpointsUrl = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    return url === endpointsUrl
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : passThrough(url, context, nextLoad);
  },
});

class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

let storage = new MemoryStorage();
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
});

const collections = await import("../src/lib/collections.ts");

test("saving a draft creates the collection only then, in one write", () => {
  storage.setItem("harbor.profiles.v1", JSON.stringify({ activeId: null, profiles: [] }));
  assert.equal(collections.readCollections().length, 0);
  const item = { id: "tt1", type: "movie" as const, name: "One" };
  assert.equal(
    collections.saveCollectionDraft("new-id", {
      name: "  Heists ",
      description: "Best ones",
      items: [item],
      tags: ["crime"],
      numbered: true,
    }),
    true,
  );
  const [saved] = collections.readCollections();
  assert.equal(saved.id, "new-id");
  assert.equal(saved.name, "Heists");
  assert.equal(saved.numbered, true);
  assert.deepEqual(saved.tags, ["crime"]);
  assert.deepEqual(
    saved.items.map((entry: { id: string }) => entry.id),
    ["tt1"],
  );
});

test("saving a draft of an existing collection replaces its fields and keeps the rest", () => {
  storage.setItem("harbor.profiles.v1", JSON.stringify({ activeId: null, profiles: [] }));
  storage.setItem(
    "harbor.collections.v1",
    JSON.stringify([
      { id: "c1", name: "Old", items: [], shared: true, createdAt: 1, updatedAt: 1 },
    ]),
  );
  collections.saveCollectionDraft("c1", { name: "New", items: [], description: "" });
  const [saved] = collections.readCollections();
  assert.equal(saved.name, "New");
  assert.equal(saved.shared, true, "sharing is not the editor's to change");
  assert.equal(saved.description, undefined);
  assert.equal(saved.createdAt, 1);
});

test("a draft with no name, or past the limit, is not saved", () => {
  storage.setItem("harbor.profiles.v1", JSON.stringify({ activeId: null, profiles: [] }));
  assert.equal(collections.saveCollectionDraft("x", { name: "  ", items: [] }), false);
  storage.setItem(
    "harbor.collections.v1",
    JSON.stringify(
      Array.from({ length: collections.MAX_COLLECTIONS }, (_, i) => ({
        id: `c${i}`,
        name: `C${i}`,
        items: [],
      })),
    ),
  );
  assert.equal(collections.saveCollectionDraft("one-more", { name: "More", items: [] }), false);
});
