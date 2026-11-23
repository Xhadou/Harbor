import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CARD_LIFT_PX,
  CARD_LIFT_SCALE,
  OPEN_CARD_CLEAR_PX,
  liftRoom,
  liftScale,
  openWidthWithin,
} from "../src/lib/card-preview/policy";

test("the lift the stylesheet draws is the lift the row makes room for", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const match = /--mac-lift-scale:\s*([\d.]+);/.exec(css);
  assert.ok(match, "--mac-lift-scale is declared");
  assert.equal(Number(match[1]), CARD_LIFT_SCALE);
});

test("every card in a row grows by the same width", () => {
  for (const rest of [176, 342, 120]) {
    assert.ok(Math.abs(rest * liftScale(rest) - rest - CARD_LIFT_PX) < 1e-9);
  }
  // A poster of the usual size lifts as much in a row as it does in a grid.
  assert.ok(Math.abs(liftScale(176) - CARD_LIFT_SCALE) < 0.001);
});

test("a card that has not opened needs no room", () => {
  assert.equal(liftRoom(176, 176, liftScale(176)), 0);
  assert.equal(liftRoom(150, 176, liftScale(176)), 0);
});

test("an open card keeps the distance to its neighbours a lifted card at rest has", () => {
  const gap = 12;
  for (const [rest, open] of [
    [176, 470],
    [342, 607],
  ]) {
    const scale = liftScale(rest);
    const overflow = (width: number) => (width * (scale - 1)) / 2;
    const distanceAtRest = gap - overflow(rest);
    const distanceOpen = gap + liftRoom(open, rest, scale) - overflow(open);
    assert.ok(Math.abs(distanceOpen - distanceAtRest) < 1e-9);
    assert.ok(Math.abs(distanceAtRest - (gap - CARD_LIFT_PX / 2)) < 1e-9);
  }
});

test("an open card stands further from its neighbours than a lifted one, by the clearance", () => {
  const gap = 12;
  const rest = 176;
  const open = 470;
  const scale = liftScale(rest);
  const overflow = (width: number) => (width * (scale - 1)) / 2;
  const distance = gap + liftRoom(open, rest, scale, OPEN_CARD_CLEAR_PX) - overflow(open);
  assert.ok(Math.abs(distance - (gap - CARD_LIFT_PX / 2 + OPEN_CARD_CLEAR_PX)) < 1e-9);
  // A card that opens in place has not widened and takes no room at all.
  assert.equal(liftRoom(rest, rest, scale, OPEN_CARD_CLEAR_PX), 0);
  for (const limit of [1200, 480, 300]) {
    const width = openWidthWithin(open, rest, limit, scale, OPEN_CARD_CLEAR_PX);
    const room = liftRoom(width, rest, scale, OPEN_CARD_CLEAR_PX);
    assert.ok(width + 2 * room <= Math.max(limit, rest) + 1e-9);
  }
});

test("an open card and its room never pass the limit", () => {
  const rest = 176;
  const scale = liftScale(rest);
  for (const [want, limit] of [
    [470, 1200],
    [470, 480],
    [900, 700],
    [176, 176],
  ]) {
    const width = openWidthWithin(want, rest, limit, scale);
    assert.ok(width <= want);
    assert.ok(width >= rest);
    assert.ok(width + 2 * liftRoom(width, rest, scale) <= Math.max(limit, rest) + 1e-9);
  }
  assert.equal(openWidthWithin(470, 176, 1200, scale), 470);
});
