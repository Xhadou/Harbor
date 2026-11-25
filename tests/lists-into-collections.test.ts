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

// The move runs once per session, so each case loads the store afresh.
let loads = 0;
const freshCollections = () => import(`../src/lib/collections.ts?case=${++loads}`);

const profiles = (activeId: string | null) =>
  JSON.stringify({
    activeId,
    profiles: activeId ? [{ id: activeId, settingsLinked: false }] : [],
  });
const list = (id: string, items: object[] = []) => ({
  id,
  name: `List ${id}`,
  description: "Notes",
  createdAt: 10,
  updatedAt: 20,
  items,
});
const listItem = { id: "tt1", type: "movie", name: "One", altTitle: "Uno", addedAt: 123 };

test("a profile's lists join its collections, which keep their own, and the lists stay in place", async () => {
  storage.setItem("harbor.profiles.v1", profiles("a"));
  const lists = JSON.stringify([list("list-a", [listItem])]);
  storage.setItem("harbor.customlists.v1.a", lists);
  storage.setItem(
    "harbor.collections.a",
    JSON.stringify([{ id: "own", name: "Own", items: [], createdAt: 1, updatedAt: 30 }]),
  );
  const collections = await freshCollections();
  const read = collections.readCollections();
  assert.deepEqual(
    read.map((entry: { id: string }) => entry.id),
    ["own", "list-a"],
  );
  const moved = read.find((entry: { id: string }) => entry.id === "list-a");
  assert.equal(moved.description, "Notes");
  assert.equal(moved.items[0].altTitle, "Uno");
  assert.equal(moved.items[0].addedAt, 123);
  assert.equal(storage.getItem("harbor.customlists.v1.a"), lists, "the old snapshot is untouched");
});

test("the shared and older per-profile list snapshots go to the matching collections", async () => {
  storage.setItem("harbor.profiles.v1", profiles(null));
  storage.setItem("harbor.customlists.v1", JSON.stringify([list("shared")]));
  storage.setItem("harbor.customlists.b", JSON.stringify([list("older-b")]));
  const collections = await freshCollections();
  assert.deepEqual(
    collections.readCollections().map((entry: { id: string }) => entry.id),
    ["shared"],
  );
  assert.deepEqual(
    JSON.parse(storage.getItem("harbor.collections.b")!).map((entry: { id: string }) => entry.id),
    ["older-b"],
  );
});

test("moving again adds nothing twice, and a restored snapshot is moved again", async () => {
  storage.setItem("harbor.profiles.v1", profiles(null));
  storage.setItem("harbor.customlists.v1", JSON.stringify([list("one")]));
  (await freshCollections()).readCollections();
  (await freshCollections()).readCollections();
  assert.deepEqual(
    JSON.parse(storage.getItem("harbor.collections.v1")!).map((entry: { id: string }) => entry.id),
    ["one"],
  );
  // An older backup brings the lists back with one more in them.
  storage.setItem("harbor.customlists.v1", JSON.stringify([list("one"), list("two")]));
  const ids = (await freshCollections())
    .readCollections()
    .map((entry: { id: string }) => entry.id)
    .sort();
  assert.deepEqual(ids, ["one", "two"]);
});
