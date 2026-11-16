// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { coerceMacSettings, MAC_COLORS, macFullscreenMode, macLayout } from "../src/lib/mac-chrome";

test("coerceMacSettings forces native title bar on macOS", () => {
  const input = { useNativeTitleBar: false, hybridTitleBar: true, other: 1 };
  const out = coerceMacSettings(input, "macos");
  assert.deepEqual(out, { useNativeTitleBar: true, hybridTitleBar: false, other: 1 });
  assert.deepEqual(input, { useNativeTitleBar: false, hybridTitleBar: true, other: 1 });
});

test("coerceMacSettings leaves other platforms alone", () => {
  const input = { useNativeTitleBar: false, hybridTitleBar: true };
  assert.equal(coerceMacSettings(input, "windows"), input);
});

test("coerceMacSettings keeps the same object when nothing changes", () => {
  const input = { useNativeTitleBar: true, hybridTitleBar: false };
  assert.equal(coerceMacSettings(input, "macos"), input);
});

test("macLayout forces sidebar on macOS", () => {
  assert.equal(macLayout("royal", "macos"), "sidebar");
  assert.equal(macLayout("royal", "linux"), "royal");
});

test("macFullscreenMode never strips the system frame on macOS", () => {
  assert.equal(macFullscreenMode("borderless", "macos"), "fullscreen");
  assert.equal(macFullscreenMode("maximized", "macos"), "maximized");
  assert.equal(macFullscreenMode("fullscreen", "macos"), "fullscreen");
  assert.equal(macFullscreenMode("borderless", "windows"), "borderless");
});

test("coerceMacSettings turns on the full-bleed hero on macOS when the setting exists", () => {
  const input = { useNativeTitleBar: true, hybridTitleBar: false, heroFull: false };
  assert.deepEqual(coerceMacSettings(input, "macos"), { ...input, heroFull: true });
  assert.equal(coerceMacSettings(input, "linux"), input);
  const without = { useNativeTitleBar: true, hybridTitleBar: false };
  assert.equal("heroFull" in coerceMacSettings(without, "macos"), false);
});

test("coerceMacSettings pins the one dark look on macOS", () => {
  const theme = {
    preset: "cool-grey",
    backgroundImage: "bg.png",
    backgroundDim: 0.65,
    fontPair: "sentient-switzer",
    customFontId: "abc",
    customColors: null,
  };
  const input = { useNativeTitleBar: true, hybridTitleBar: false, theme };
  const out = coerceMacSettings(input, "macos");
  assert.deepEqual(out.theme, {
    preset: "custom",
    backgroundImage: null,
    backgroundDim: 0.65,
    fontPair: "system",
    customFontId: null,
    customColors: MAC_COLORS,
  });
  assert.equal(input.theme.preset, "cool-grey");
  assert.equal(coerceMacSettings(input, "windows"), input);
  // Already pinned: nothing to change, same object back.
  assert.equal(coerceMacSettings(out, "macos"), out);
});
