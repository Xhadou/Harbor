// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { NAV_SYMBOLS } from "../src/chrome/mac/nav-symbols";
import {
  findSidebarTarget,
  sidebarVisible,
  toNativeSidebarItems,
} from "../src/chrome/mac/sidebar-items";

const entry = (id: string, primary: boolean, gated = false) => ({
  item: { id, label: `nav.${id}`, view: id },
  primary,
  gated,
});
const t = (key: string) => `T:${key}`;
const opts = { renamed: {}, kid: false, reminderCount: 0 };

test("every nav item has a symbol", () => {
  const source = readFileSync(new URL("../src/chrome/nav-items.tsx", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^\s{4}id: "([a-z]+)",$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 21);
  for (const id of ids) {
    const symbol = (NAV_SYMBOLS as Record<string, string>)[id];
    assert.ok(typeof symbol === "string" && symbol.length > 0, id);
  }
});

test("maps entries with translated titles", () => {
  const items = toNativeSidebarItems(
    [entry("home", true), entry("library", false)],
    "home",
    t,
    opts,
  );
  assert.deepEqual(items, [
    {
      id: "home",
      title: "T:nav.home",
      symbol: "house",
      section: "primary",
      active: true,
      gated: false,
    },
    {
      id: "library",
      title: "T:nav.library",
      symbol: "books.vertical",
      section: "collections",
      active: false,
      gated: false,
    },
  ]);
});

test("rename wins over translation", () => {
  const items = toNativeSidebarItems([entry("home", true)], "home", t, {
    ...opts,
    renamed: { home: "Start" },
  });
  assert.equal(items[0].title, "Start");
});

test("gated carried through", () => {
  const items = toNativeSidebarItems([entry("settings", false, true)], "home", t, opts);
  assert.equal(items[0].gated, true);
});

test("calendar badge", () => {
  const withBadge = toNativeSidebarItems([entry("calendar", false)], "home", t, {
    ...opts,
    reminderCount: 3,
  });
  assert.equal(withBadge[0].badge, 3);
  const without = toNativeSidebarItems([entry("calendar", false)], "home", t, opts);
  assert.equal("badge" in without[0], false);
});

test("kid play entry", () => {
  const items = toNativeSidebarItems([entry("kids", true)], "kids", t, { ...opts, kid: true });
  assert.deepEqual(items.at(-1), {
    id: "kids-play",
    title: "Play",
    symbol: "play.circle",
    section: "primary",
    active: false,
    gated: false,
  });
});

test("a selected id resolves to its view and whether a PIN is needed", () => {
  const entries = [entry("home", true), entry("settings", false, true)];
  assert.deepEqual(findSidebarTarget(entries, "settings"), { view: "settings", gated: true });
  assert.deepEqual(findSidebarTarget(entries, "home"), { view: "home", gated: false });
  assert.equal(findSidebarTarget(entries, "nope"), null);
});

test("native sidebar shows where the React sidebar did, and never over hidden chrome", () => {
  const shown = {
    settingsTop: false,
    playerActive: false,
    standaloneLive: false,
    pickerTop: false,
    immersive: false,
    chromeHidden: false,
  };
  assert.equal(sidebarVisible(shown), true);
  for (const key of Object.keys(shown)) {
    assert.equal(sidebarVisible({ ...shown, [key]: true }), false, key);
  }
});
