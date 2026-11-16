// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { layoutInsets } from "../src/chrome/mac/native-layout";
import { searchHiddenFor, toolbarPayload } from "../src/chrome/mac/toolbar-payload";

const shown = { playerActive: false, immersive: false, canGoBack: false, searchHidden: false };

test("toolbar hidden during playback", () => {
  assert.deepEqual(toolbarPayload({ ...shown, playerActive: true, canGoBack: true }), {
    visible: false,
    canGoBack: true,
    searchVisible: false,
  });
});

test("toolbar hidden when immersive", () => {
  assert.equal(toolbarPayload({ ...shown, immersive: true }).visible, false);
});

test("toolbar visible otherwise", () => {
  assert.deepEqual(toolbarPayload(shown), {
    visible: true,
    canGoBack: false,
    searchVisible: true,
  });
});

test("search field follows the web app's own search availability", () => {
  assert.equal(toolbarPayload({ ...shown, searchHidden: true }).searchVisible, false);
});

test("global search is hidden on views with their own search, in settings, pickers and kid mode", () => {
  const base = { view: "home", topKind: "home", connecting: false, kid: false };
  assert.equal(searchHiddenFor(base), false);
  for (const view of ["music", "games", "addons", "settings"]) {
    assert.equal(searchHiddenFor({ ...base, view }), true, view);
  }
  assert.equal(searchHiddenFor({ ...base, topKind: "picker" }), true);
  assert.equal(searchHiddenFor({ ...base, connecting: true }), true);
  assert.equal(searchHiddenFor({ ...base, kid: true }), true);
});

test("layout insets leave a gutter beside a visible sidebar and none when hidden", () => {
  assert.deepEqual(layoutInsets({ titlebarInset: 52, sidebarWidth: 240, sidebarVisible: true }), {
    titlebar: "52px",
    sidebar: "256px",
  });
  assert.deepEqual(layoutInsets({ titlebarInset: 28, sidebarWidth: 240, sidebarVisible: false }), {
    titlebar: "28px",
    sidebar: "0px",
  });
});

test("layout insets are converted from screen points to CSS pixels under interface zoom", () => {
  const layout = { titlebarInset: 52, sidebarWidth: 240, sidebarVisible: true };
  assert.deepEqual(layoutInsets(layout, 0.95), { titlebar: "54.74px", sidebar: "269.47px" });
  assert.deepEqual(layoutInsets(layout, 1), { titlebar: "52px", sidebar: "256px" });
  // A missing or nonsensical scale means no zoom.
  assert.deepEqual(layoutInsets(layout, 0), { titlebar: "52px", sidebar: "256px" });
});
