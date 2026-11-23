import assert from "node:assert/strict";
import test from "node:test";
import { MAC_ROW_GAP, MAC_ROW_PEEK, macCardTarget, macRowFit } from "../src/lib/mac-row-fit";

const filled = (available: number, cell: number, count: number) =>
  count * (cell + MAC_ROW_GAP) + MAC_ROW_PEEK * cell - available;

test("a poster row shows six posters and part of a seventh at the reference window", () => {
  // Measured against the reference app on 2026-11-23: a 1282 pt window, posters 176.5 pt wide.
  const fit = macRowFit(1206, 144, 1282);
  assert.equal(fit.count, 6);
  assert.ok(Math.abs(fit.cell - 176.5) < 2, `poster ${fit.cell}`);
});

test("posters grow with the window instead of adding columns", () => {
  // The same app full screen on the same display: 1470 pt wide, posters 198 pt.
  const fit = macRowFit(1394, 144, 1470);
  assert.equal(fit.count, 6);
  assert.ok(fit.cell > 195 && fit.cell < 210, `poster ${fit.cell}`);
});

test("a narrower page, with the sidebar open, drops a poster and keeps their size close", () => {
  const fit = macRowFit(950, 144, 1282);
  assert.equal(fit.count, 5);
  assert.ok(Math.abs(fit.cell - macCardTarget(144, 1282)) < 20, `poster ${fit.cell}`);
});

test("the cards and the part-shown one fill the row exactly", () => {
  for (const [available, min, width] of [
    [1206, 144, 1282],
    [950, 144, 1282],
    [1394, 232, 1470],
    [600, 144, 700],
    [2400, 144, 2560],
  ]) {
    const fit = macRowFit(available, min, width);
    assert.ok(Math.abs(filled(available, fit.cell, fit.count)) < 0.001);
    assert.ok(fit.count >= 1);
  }
});

test("a card never leaves the range its row's minimum allows", () => {
  assert.equal(macCardTarget(144, 400), 144 * 1.05);
  assert.equal(macCardTarget(144, 5000), 144 * 1.6);
  // A very wide window adds posters once they would pass the largest size.
  const wide = macRowFit(2400, 144, 2560);
  assert.ok(wide.count > 6);
  assert.ok(wide.cell < 144 * 1.6 + 20);
});

test("a wider kind of card is scaled by the same share", () => {
  const posters = macCardTarget(144, 1282);
  const wide = macCardTarget(232, 1282);
  assert.ok(Math.abs(wide / posters - 232 / 144) < 1e-9);
});
