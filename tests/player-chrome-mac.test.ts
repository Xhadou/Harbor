import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROL_META,
  DEFAULT_DEFAULT_CONFIG,
  DEFAULT_MAC_CONFIG,
  DEFAULT_STREMIO_CONFIG,
  baselineFor,
  controlsInSlot,
  isStockLayoutBeforeMore,
  moreMenuControls,
  type PlayerChromeConfig,
  type PlayerControlId,
} from "../src/lib/player-chrome.ts";

const ids = (config: PlayerChromeConfig, slot: Parameters<typeof controlsInSlot>[1]) =>
  controlsInSlot(config, slot).map((control) => control.id);

const withHidden = (
  config: PlayerChromeConfig,
  changes: Partial<Record<PlayerControlId, boolean>>,
): PlayerChromeConfig => ({
  ...config,
  controls: config.controls.map((control) =>
    control.id in changes ? { ...control, hidden: changes[control.id] } : control,
  ),
});

test("the Mac player bar keeps the agreed controls and moves the rest into More", () => {
  assert.deepEqual(ids(DEFAULT_MAC_CONFIG, "bottom-left"), ["volume", "dvr"]);
  assert.deepEqual(ids(DEFAULT_MAC_CONFIG, "bottom-center"), [
    "prev-episode",
    "seek-back",
    "play-pause",
    "seek-forward",
    "next-episode",
  ]);
  assert.deepEqual(ids(DEFAULT_MAC_CONFIG, "bottom-right"), [
    "pick-another",
    "home-server-quality",
    "audio-menu",
    "subtitle-menu",
    "speed-menu",
    "pip",
    "cast",
    "more-menu",
    "fullscreen",
  ]);
  assert.deepEqual(ids(DEFAULT_MAC_CONFIG, "seek-leading"), ["time-start"]);
  assert.deepEqual(ids(DEFAULT_MAC_CONFIG, "seek-trailing"), ["time-end"]);
});

test("every extra the Mac bar drops is still reachable from More", () => {
  assert.deepEqual(moreMenuControls(DEFAULT_MAC_CONFIG), [
    "chapter-menu",
    "aspect-menu",
    "shader-menu",
    "screenshot",
    "download",
    "song-id",
    "draw-toggle",
  ]);
});

test("More lists only the extras that are not already on the bar", () => {
  const config = withHidden(DEFAULT_MAC_CONFIG, { screenshot: false, download: false });
  assert.deepEqual(moreMenuControls(config), [
    "chapter-menu",
    "aspect-menu",
    "shader-menu",
    "song-id",
    "draw-toggle",
  ]);
});

test("Anime4K gets its own row only when the shader panel that contains it is on the bar", () => {
  const config = withHidden(DEFAULT_MAC_CONFIG, { "shader-menu": false });
  const more = moreMenuControls(config);
  assert.ok(more.includes("anime4k-menu"));
  assert.ok(!more.includes("shader-menu"));
});

test("the Mac layout is the baseline on macOS only, and only for the default theme", () => {
  assert.equal(baselineFor("default", true), DEFAULT_MAC_CONFIG);
  assert.equal(baselineFor("default", false), DEFAULT_DEFAULT_CONFIG);
  assert.equal(baselineFor("stremio", true), DEFAULT_STREMIO_CONFIG);
  assert.equal(baselineFor("stremio", false), DEFAULT_STREMIO_CONFIG);
});

test("other platforms ship More switched off, so their bar is unchanged", () => {
  const entry = DEFAULT_DEFAULT_CONFIG.controls.find((control) => control.id === "more-menu");
  assert.ok(entry, "the default layout knows the control, so the layout editor can show it");
  assert.equal(entry.hidden, true);
  assert.equal(CONTROL_META["more-menu"].defaultSlot, "bottom-right");
  assert.deepEqual(ids(DEFAULT_DEFAULT_CONFIG, "bottom-right"), [
    "pick-another",
    "home-server-quality",
    "audio-menu",
    "subtitle-menu",
    "anime4k-menu",
    "speed-menu",
    "draw-toggle",
    "song-id",
    "pip",
    "cast",
    "fullscreen",
  ]);
});

// Tapping the time readout saves the whole layout, so an install can hold a
// "saved" layout nobody arranged. This is the one such a tap wrote before More.
const stockBeforeMore = DEFAULT_DEFAULT_CONFIG.controls.filter(
  (control) => control.id !== "more-menu",
);

test("the stock bar saved before More existed is recognised as nobody's arrangement", () => {
  assert.equal(isStockLayoutBeforeMore(stockBeforeMore), true);
  assert.equal(isStockLayoutBeforeMore(stockBeforeMore.map((c) => ({ ...c })).reverse()), true);
});

test("a layout saved since More existed is the user's, even when it matches the stock bar", () => {
  assert.equal(isStockLayoutBeforeMore(DEFAULT_DEFAULT_CONFIG.controls), false);
});

test("a layout that differs from the stock bar in any control is the user's own", () => {
  const change = (id: PlayerControlId, patch: object) =>
    stockBeforeMore.map((c) => (c.id === id ? { ...c, ...patch } : c));
  assert.equal(isStockLayoutBeforeMore(change("song-id", { hidden: true })), false);
  assert.equal(isStockLayoutBeforeMore(change("screenshot", { hidden: false })), false);
  assert.equal(isStockLayoutBeforeMore(change("cast", { order: 5 })), false);
  assert.equal(isStockLayoutBeforeMore(change("volume", { slot: "bottom-right" })), false);
  assert.equal(isStockLayoutBeforeMore(change("next-episode", { variant: "condensed" })), false);
  assert.equal(isStockLayoutBeforeMore(stockBeforeMore.slice(1)), false);
  assert.equal(isStockLayoutBeforeMore([]), false);
});
