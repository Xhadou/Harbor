// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { nativeBackState } from "../src/chrome/mac/native-back-state";

test("off macOS a page keeps its own Back", () => {
  assert.deepEqual(nativeBackState({ mac: false, front: true, enabled: true }), {
    handled: false,
    listening: false,
  });
});

test("outside an opted-in page (a dialog, the player's panel) the page keeps its own Back", () => {
  assert.deepEqual(nativeBackState({ mac: true, front: null, enabled: true }), {
    handled: false,
    listening: false,
  });
});

test("the page in front hands Back to the window and answers it", () => {
  assert.deepEqual(nativeBackState({ mac: true, front: true, enabled: true }), {
    handled: true,
    listening: true,
  });
});

test("a covered page stays without its own Back but does not answer the window's", () => {
  assert.deepEqual(nativeBackState({ mac: true, front: false, enabled: true }), {
    handled: true,
    listening: false,
  });
});

test("a step that is not open right now does not answer", () => {
  assert.deepEqual(nativeBackState({ mac: true, front: true, enabled: false }), {
    handled: true,
    listening: false,
  });
});
