import assert from "node:assert/strict";
import test from "node:test";
import { residualShifts } from "../src/chrome/mac/sidebar-glide";

test("a page that moves as a whole is carried once, and what is inside it rides along", () => {
  // The page went 256 to the left; its heading and its row went with it.
  const shifts = residualShifts([
    { parent: -1, before: 256, after: 0 },
    { parent: 0, before: 288, after: 32 },
    { parent: 0, before: 288, after: 32 },
  ]);
  assert.deepEqual(shifts, [-256, 0, 0]);
});

test("a page that stays under the sidebar moves only its text and rows", () => {
  // The page's box did not move (its artwork runs under the sidebar); its rows did.
  const shifts = residualShifts([
    { parent: -1, before: 0, after: 0 },
    { parent: 0, before: 0, after: 0 },
    { parent: 0, before: 288, after: 32 },
    { parent: 2, before: 288, after: 32 },
  ]);
  assert.deepEqual(shifts, [0, 0, -256, 0]);
});

test("what stays put inside something that moves is carried back by as much", () => {
  // The holder moved 256; one child kept its place on screen, another moved only half as far.
  const shifts = residualShifts([
    { parent: -1, before: 256, after: 0 },
    { parent: 0, before: 0, after: 0 },
    { parent: 0, before: 500, after: 372 },
    { parent: 2, before: 500, after: 372 },
  ]);
  assert.deepEqual(shifts, [-256, 256, 128, 0]);
});

test("an element that is only looked into is never moved, and its children are judged alone", () => {
  const shifts = residualShifts([
    { parent: -1, before: 256, after: 0, passed: true },
    { parent: 0, before: 256, after: 0 },
    { parent: 0, before: 0, after: 0 },
  ]);
  assert.deepEqual(shifts, [0, -256, 0]);
});

test("a change of less than half a pixel is not movement", () => {
  assert.deepEqual(residualShifts([{ parent: -1, before: 10, after: 10.4 }]), [0]);
});
