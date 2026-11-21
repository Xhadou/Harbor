import assert from "node:assert/strict";
import test from "node:test";
import { joinById } from "../src/lib/join-by-id";

test("two lists join in order and a repeated id is kept once, from the first list", () => {
  const a = [
    { id: "tt1", from: "a" },
    { id: "tt2", from: "a" },
  ];
  const b = [
    { id: "tt2", from: "b" },
    { id: "tt3", from: "b" },
  ];
  assert.deepEqual(joinById(a, b), [
    { id: "tt1", from: "a" },
    { id: "tt2", from: "a" },
    { id: "tt3", from: "b" },
  ]);
});

test("an empty list adds nothing, and the inputs are left as they were", () => {
  const a = [{ id: "tt1" }];
  assert.deepEqual(joinById(a, []), a);
  assert.deepEqual(joinById([], a), a);
  assert.deepEqual(joinById([], []), []);
  assert.equal(a.length, 1);
});
