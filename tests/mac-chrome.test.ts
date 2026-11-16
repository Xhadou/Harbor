// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { coerceMacSettings, macFullscreenMode, macLayout } from "../src/lib/mac-chrome";

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
