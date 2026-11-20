import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultSeekColor,
  sliderShowsBoost,
} from "../src/components/player/transport/transport-utils.ts";

test("elsewhere the volume slider always carries its boost zone when boost is allowed", () => {
  assert.equal(sliderShowsBoost({ boostAllowed: true, volume: 0.4, mac: false }), true);
  assert.equal(sliderShowsBoost({ boostAllowed: true, volume: 1.5, mac: false }), true);
  assert.equal(sliderShowsBoost({ boostAllowed: false, volume: 0.4, mac: false }), false);
});

test("on macOS the volume slider is a plain 0 to 100% one until the volume is boosted", () => {
  assert.equal(sliderShowsBoost({ boostAllowed: true, volume: 0, mac: true }), false);
  assert.equal(sliderShowsBoost({ boostAllowed: true, volume: 1, mac: true }), false);
  assert.equal(sliderShowsBoost({ boostAllowed: true, volume: 1.05, mac: true }), true);
  assert.equal(sliderShowsBoost({ boostAllowed: false, volume: 1.05, mac: true }), false);
});

test("the seek bar is white on macOS unless a colour was chosen, gold elsewhere", () => {
  assert.equal(defaultSeekColor(true), "#ffffff");
  assert.equal(defaultSeekColor(false), "oklch(0.78 0.13 60)");
});
