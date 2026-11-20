// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  coerceMacSettings,
  MAC_COLORS,
  MAC_NAV_TRIM,
  macBindingLabel,
  macDefaultBinding,
  macFullscreenMode,
  macLayout,
} from "../src/lib/mac-chrome";

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

test("coerceMacSettings trims the sidebar once and respects later choices", () => {
  const base = { useNativeTitleBar: true, hybridTitleBar: false };
  const first = coerceMacSettings(
    { ...base, navCustomization: { order: [], hidden: ["live", "manga"], renamed: {} } },
    "macos",
  );
  assert.deepEqual(first.navCustomization.hidden, ["live", "manga", "music", "games", "ebook"]);
  assert.equal((first as { _macNavTrimV1?: boolean })._macNavTrimV1, true);
  for (const id of MAC_NAV_TRIM) assert.ok(first.navCustomization.hidden.includes(id));

  // The owner turns Music back on; the saved settings carry the flag.
  const reopened = {
    ...first,
    navCustomization: { ...first.navCustomization, hidden: ["live"] },
  };
  assert.equal(coerceMacSettings(reopened, "macos"), reopened);

  const elsewhere = { ...base, navCustomization: { order: [], hidden: [], renamed: {} } };
  assert.equal(coerceMacSettings(elsewhere, "linux"), elsewhere);
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

test("macDefaultBinding gives Command defaults on macOS only", () => {
  assert.equal(macDefaultBinding("globalUiScaleUp", "ctrl+=", "macos"), "meta+=");
  assert.equal(macDefaultBinding("globalSettingsOpen", "ctrl+s", "macos"), "meta+,");
  assert.equal(macDefaultBinding("globalUiScaleUp", "ctrl+=", "windows"), "ctrl+=");
  // Not in the table: Command+1 belongs to the Go menu, so this one stays.
  assert.equal(macDefaultBinding("playerAnime4kOn", "ctrl+1", "macos"), "ctrl+1");
  assert.equal(macDefaultBinding("playerPlayPause", "Space", "macos"), "Space");
});

test("macBindingLabel writes a binding the Mac way", () => {
  assert.equal(macBindingLabel(["meta", ","]), "\u2318,");
  assert.equal(macBindingLabel(["ctrl", "alt", "R"]), "\u2303\u2325R");
  assert.equal(macBindingLabel(["shift", "meta", "]"]), "\u21E7\u2318]");
  assert.equal(macBindingLabel(["Escape"]), "esc");
  assert.equal(macBindingLabel(["Space"]), "Space");
});
