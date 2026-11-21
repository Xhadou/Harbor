// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { HERO_SCALE, heroTextZoom, heroZoom, layoutInsets } from "../src/chrome/mac/native-layout";
import { registerOnPage, subscribe } from "../src/chrome/mac/native-subscription";
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

const lights = { controlsInset: 92 };

test("layout insets leave a gutter beside a visible sidebar and none when hidden", () => {
  const shownSidebar = { ...lights, titlebarInset: 52, sidebarWidth: 240, sidebarVisible: true };
  assert.deepEqual(layoutInsets(shownSidebar), {
    titlebar: "52px",
    sidebar: "256px",
    controls: "92px",
  });
  const hiddenSidebar = { ...lights, titlebarInset: 28, sidebarWidth: 240, sidebarVisible: false };
  assert.deepEqual(layoutInsets(hiddenSidebar), {
    titlebar: "28px",
    sidebar: "0px",
    controls: "92px",
  });
});

test("layout insets are converted from screen points to CSS pixels under interface zoom", () => {
  const layout = { ...lights, titlebarInset: 52, sidebarWidth: 240, sidebarVisible: true };
  assert.deepEqual(layoutInsets(layout, 0.95), {
    titlebar: "54.74px",
    sidebar: "269.47px",
    controls: "96.84px",
  });
  const unzoomed = { titlebar: "52px", sidebar: "256px", controls: "92px" };
  assert.deepEqual(layoutInsets(layout, 1), unzoomed);
  // A missing or nonsensical scale means no zoom.
  assert.deepEqual(layoutInsets(layout, 0), unzoomed);
});

test("a hero's zoom cancels the interface scale, so it stays the size it has at the hero scale", () => {
  assert.equal(heroZoom(HERO_SCALE), 1);
  // Scale times zoom is what a hero is drawn at: always the hero scale.
  for (const scale of [0.8, 0.95, 1, 1.25, 1.6]) {
    assert.ok(Math.abs(scale * heroZoom(scale) - HERO_SCALE) < 0.001, `scale ${scale}`);
  }
  // A missing or nonsensical scale means no zoom.
  assert.equal(heroZoom(0), heroZoom(1));
  assert.equal(heroZoom(), heroZoom(1));
});

test("a hero's words undo the hero's zoom, so they are the page's size at every scale", () => {
  for (const scale of [0.8, 0.95, 1, 1.25, 1.6]) {
    assert.ok(Math.abs(heroZoom(scale) * heroTextZoom(scale) - 1) < 0.001, `scale ${scale}`);
  }
  assert.equal(heroTextZoom(HERO_SCALE), 1);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test("a subscription reports ready only once the listener is registered", async () => {
  const registered = deferred<() => void>();
  let ready = 0;
  subscribe(
    () => registered.promise,
    () => {},
    () => ready++,
  );
  await Promise.resolve();
  assert.equal(ready, 0);
  registered.resolve(() => {});
  await registered.promise;
  await Promise.resolve();
  assert.equal(ready, 1);
});

test("a subscription dropped before it registers is released and never ready", async () => {
  const registered = deferred<() => void>();
  let ready = 0;
  let released = 0;
  const stop = subscribe(
    () => registered.promise,
    () => {},
    () => ready++,
  );
  stop();
  registered.resolve(() => released++);
  await registered.promise;
  await Promise.resolve();
  assert.deepEqual([ready, released], [0, 1]);
});

test("stopping a registered subscription releases its listener", async () => {
  let released = 0;
  const stop = subscribe(
    () => Promise.resolve(() => released++),
    () => {},
  );
  await Promise.resolve();
  await Promise.resolve();
  stop();
  assert.equal(released, 1);
});

test("a preview page event reaches the handler until the listener is released", async () => {
  const page = new EventTarget();
  const seen: unknown[] = [];
  const release = await registerOnPage(
    page,
    "mac-native://layout",
  )((payload) => seen.push(payload));
  page.dispatchEvent(new CustomEvent("mac-native://layout", { detail: { sidebarWidth: 240 } }));
  release();
  page.dispatchEvent(new CustomEvent("mac-native://layout", { detail: { sidebarWidth: 0 } }));
  assert.deepEqual(seen, [{ sidebarWidth: 240 }]);
});
