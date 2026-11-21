import assert from "node:assert/strict";
import test from "node:test";
import { oneCardBadge } from "../src/lib/card-one-badge";

test("a poster carries one badge: what is true now, else what it won, else the dub", () => {
  assert.equal(oneCardBadge({ status: true, award: true, dub: true }), "status");
  assert.equal(oneCardBadge({ status: false, award: true, dub: true }), "award");
  assert.equal(oneCardBadge({ status: false, award: false, dub: true }), "dub");
});

test("a poster with nothing to say carries no badge", () => {
  assert.equal(oneCardBadge({ status: false, award: false, dub: false }), null);
});
