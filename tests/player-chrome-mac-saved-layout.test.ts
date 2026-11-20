import assert from "node:assert/strict";
import test from "node:test";

// The platform is read once, from storage, so it is set before anything loads.
const store = new Map<string, string>([["dev.os", "macos"]]);
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  },
});

const chrome = await import("../src/lib/player-chrome.ts");
const profiles = await import("../src/lib/player-chrome-profiles.ts");

const stockBeforeMore = chrome.DEFAULT_DEFAULT_CONFIG.controls.filter(
  (control) => control.id !== "more-menu",
);
const save = (controls: unknown, timeFormat = "remaining") => {
  const now = Date.now();
  store.set(
    profiles.PROFILE_DB_KEY,
    JSON.stringify({
      profiles: [
        {
          id: "p1",
          name: "My layout",
          themeId: "default",
          config: { controls, options: { volumeStyle: "slider", timeFormat } },
          createdAt: now,
          modifiedAt: now,
        },
      ],
      active: { default: "p1" },
    }),
  );
};
const bar = () =>
  chrome
    .controlsInSlot(chrome.readPlayerChromeConfig("default"), "bottom-right")
    .map((control) => control.id);

test("on macOS a stock bar saved by the time readout follows the Mac bar, options kept", () => {
  save(stockBeforeMore);
  assert.deepEqual(
    bar(),
    chrome.controlsInSlot(chrome.DEFAULT_MAC_CONFIG, "bottom-right").map((c) => c.id),
  );
  assert.equal(chrome.readPlayerChromeConfig("default").options.timeFormat, "remaining");
});

test("on macOS a layout the user arranged keeps its bar and gains only More", () => {
  save(stockBeforeMore.map((c) => (c.id === "screenshot" ? { ...c, hidden: false } : c)));
  assert.deepEqual(bar(), [
    "pick-another",
    "home-server-quality",
    "audio-menu",
    "subtitle-menu",
    "anime4k-menu",
    "speed-menu",
    "draw-toggle",
    "screenshot",
    "song-id",
    "pip",
    "cast",
    "more-menu",
    "fullscreen",
  ]);
});

test("on macOS an install with nothing saved gets the Mac bar", () => {
  store.delete(profiles.PROFILE_DB_KEY);
  assert.equal(chrome.readPlayerChromeConfig("default"), chrome.DEFAULT_MAC_CONFIG);
});
