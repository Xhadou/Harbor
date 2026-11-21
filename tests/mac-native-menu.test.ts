// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { menuCommand } from "../src/chrome/mac/menu-command";

test("go items map to views", () => {
  for (const view of ["home", "discover", "movies", "shows", "library"]) {
    assert.deepEqual(menuCommand(`go-${view}`), { kind: "view", view });
  }
});

test("settings maps to settings view", () => {
  assert.deepEqual(menuCommand("settings"), { kind: "view", view: "settings" });
});

test("others", () => {
  assert.deepEqual(menuCommand("back"), { kind: "back" });
  assert.deepEqual(menuCommand("next-section"), { kind: "cycle-section", step: 1 });
  assert.deepEqual(menuCommand("previous-section"), { kind: "cycle-section", step: -1 });
  assert.deepEqual(menuCommand("toggle-sidebar"), { kind: "toggle-sidebar" });
  assert.deepEqual(menuCommand("find"), { kind: "find" });
  assert.deepEqual(menuCommand("reload"), { kind: "reload" });
  assert.deepEqual(menuCommand("watch-together"), { kind: "watch-together" });
  assert.equal(menuCommand("nope"), null);
  assert.equal(menuCommand("go-nowhere"), null);
});
