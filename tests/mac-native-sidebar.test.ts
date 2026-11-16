// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { NAV_SYMBOLS } from "../src/chrome/mac/nav-symbols";
import {
  buildNativeSidebar,
  findSidebarTarget,
  profileInitials,
  sidebarVisible,
} from "../src/chrome/mac/sidebar-items";

const entry = (id: string, primary: boolean, gated = false) => ({
  item: { id, label: `nav.${id}`, view: id },
  primary,
  gated,
});
const t = (key: string) => `T:${key}`;
const opts = { renamed: {}, kid: false, reminderCount: 0, customOrder: false };

test("every nav item has a symbol", () => {
  const source = readFileSync(new URL("../src/chrome/nav-items.tsx", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^\s{4}id: "([a-z]+)",$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 21);
  for (const id of ids) {
    const symbol = (NAV_SYMBOLS as Record<string, string>)[id];
    assert.ok(typeof symbol === "string" && symbol.length > 0, id);
  }
});

test("maps entries into Apple TV-style groups with translated titles", () => {
  const { items, sections } = buildNativeSidebar(
    [entry("home", true), entry("library", false), entry("music", false)],
    "home",
    t,
    opts,
  );
  assert.deepEqual(items, [
    {
      id: "home",
      title: "T:nav.home",
      symbol: "house",
      section: "browse",
      active: true,
      gated: false,
    },
    {
      id: "library",
      title: "T:nav.library",
      symbol: "books.vertical",
      section: "library",
      active: false,
      gated: false,
    },
    {
      id: "music",
      title: "T:nav.music",
      symbol: "music.note",
      section: "more",
      active: false,
      gated: false,
    },
  ]);
  assert.deepEqual(sections, [
    { id: "browse", title: null },
    { id: "library", title: "T:Library" },
    { id: "more", title: "T:More" },
  ]);
});

const harborDefaultOrder = [
  "home",
  "discover",
  "catalogs",
  "plugins",
  "movies",
  "shows",
  "anime",
  "manga",
  "ebook",
  "music",
  "games",
  "live",
  "calendar",
  "library",
  "collections",
  "downloads",
  "addons",
].map((id) => entry(id, false));

test("without a custom order, each group uses the designed order", () => {
  const { items } = buildNativeSidebar(harborDefaultOrder, "home", t, opts);
  const ids = (section: string) => items.filter((i) => i.section === section).map((i) => i.id);
  assert.deepEqual(ids("browse"), ["home", "discover", "movies", "shows", "anime", "live"]);
  assert.deepEqual(ids("library"), ["library", "collections", "downloads", "calendar"]);
  assert.deepEqual(ids("more"), [
    "catalogs",
    "music",
    "games",
    "manga",
    "ebook",
    "addons",
    "plugins",
  ]);
});

test("a custom navigation order is kept inside each group", () => {
  const { items } = buildNativeSidebar(harborDefaultOrder, "home", t, {
    ...opts,
    customOrder: true,
  });
  const ids = (section: string) => items.filter((i) => i.section === section).map((i) => i.id);
  assert.deepEqual(ids("library"), ["calendar", "library", "collections", "downloads"]);
});

test("settings moves to the foot instead of the list", () => {
  const { items, settings } = buildNativeSidebar(
    [entry("home", true), entry("settings", false, true)],
    "settings",
    t,
    opts,
  );
  assert.deepEqual(
    items.map((i) => i.id),
    ["home"],
  );
  assert.equal(settings?.id, "settings");
  assert.equal(settings?.active, true);
  assert.equal(settings?.gated, true);
  assert.equal(buildNativeSidebar([entry("home", true)], "home", t, opts).settings, null);
});

test("rename wins over translation", () => {
  const { items } = buildNativeSidebar([entry("home", true)], "home", t, {
    ...opts,
    renamed: { home: "Start" },
  });
  assert.equal(items[0].title, "Start");
});

test("gated carried through", () => {
  const { items } = buildNativeSidebar([entry("addons", false, true)], "home", t, opts);
  assert.equal(items[0].gated, true);
});

test("calendar badge", () => {
  const withBadge = buildNativeSidebar([entry("calendar", false)], "home", t, {
    ...opts,
    reminderCount: 3,
  }).items;
  assert.equal(withBadge[0].badge, 3);
  const without = buildNativeSidebar([entry("calendar", false)], "home", t, opts).items;
  assert.equal("badge" in without[0], false);
});

test("kid play entry", () => {
  const { items } = buildNativeSidebar([entry("kids", true)], "kids", t, { ...opts, kid: true });
  assert.deepEqual(items.at(-1), {
    id: "kids-play",
    title: "Play",
    symbol: "play.circle",
    section: "browse",
    active: false,
    gated: false,
  });
});

test("initials come from the first letters of a profile name", () => {
  assert.equal(profileInitials("Pratyush"), "PR");
  assert.equal(profileInitials("guest 6988"), "G6");
  assert.equal(profileInitials("  "), "?");
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
