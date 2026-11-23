import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_CLOSE_EASE,
  PREVIEW_CLOSE_MS,
  PREVIEW_HANDOFF_MS,
  PREVIEW_LEAVE_AWAY_MS,
  PREVIEW_LEAVE_MS,
  PREVIEW_LOOKUP_MS,
  PREVIEW_OPEN_EASE,
  PREVIEW_OPEN_MS,
  PREVIEW_REST_MS,
  PREVIEW_TRAILER_OUT_MS,
  PREVIEW_WARM_MS,
  bezierPoints,
  easeProgress,
  previewMotion,
  previewOpenDelay,
} from "../src/lib/card-preview/policy.ts";
import { collectionYears, pickCollectionFilm } from "../src/lib/card-preview/collection-pick.ts";
import { createRowFocus } from "../src/lib/card-preview/row-focus.ts";

const TODAY = "2026-11-22";
const saga = [
  { name: "One", releaseDate: "2001-11-16", releaseInfo: "2001" },
  { name: "Two", releaseDate: "2002-11-15", releaseInfo: "2002" },
  { name: "Three", releaseDate: "2004-06-04", releaseInfo: "2004" },
  { name: "Four", releaseDate: "2027-07-01", releaseInfo: "2027" },
];
const watched =
  (...names: string[]) =>
  (part: { name: string }) =>
    names.includes(part.name);

test("the first card waits for the pointer to rest on it", () => {
  assert.equal(previewOpenDelay(null), PREVIEW_REST_MS);
});

test("the next card waits less while a preview is open or has just closed", () => {
  assert.equal(previewOpenDelay(0), PREVIEW_HANDOFF_MS);
  assert.equal(previewOpenDelay(PREVIEW_WARM_MS), PREVIEW_HANDOFF_MS);
});

test("a card reached well after the last preview closed waits like the first", () => {
  assert.equal(previewOpenDelay(PREVIEW_WARM_MS + 1), PREVIEW_REST_MS);
});

test("no card opens under a pointer that is only passing", () => {
  // The shorter wait is still a rest, and the card that was left has closed by then.
  assert.ok(PREVIEW_HANDOFF_MS >= 1000);
  assert.ok(PREVIEW_HANDOFF_MS < PREVIEW_REST_MS);
  // The trailer is looked up well before the card opens.
  assert.ok(PREVIEW_LOOKUP_MS < PREVIEW_HANDOFF_MS);
});

test("the open card of a row is told when focus moves to another card of that row", () => {
  const focus = createRowFocus();
  let told = 0;
  let toldElsewhere = 0;
  const stop = focus.onMovedOn("row", () => {
    told += 1;
  });
  focus.onMovedOn("row above", () => {
    toldElsewhere += 1;
  });
  focus.movedOn("row");
  assert.equal(told, 1);
  // A card in another row is no business of this one.
  assert.equal(toldElsewhere, 0);
  stop();
  focus.movedOn("row");
  assert.equal(told, 1);
});

test("the next card still counts as the next one once the closing card has come to rest", () => {
  assert.ok(PREVIEW_WARM_MS > PREVIEW_LEAVE_MS + PREVIEW_CLOSE_MS);
});

test("while a card is open every card moves on the opening curve, so two cards swap evenly", () => {
  assert.deepEqual(previewMotion(true), { ms: PREVIEW_OPEN_MS, ease: PREVIEW_OPEN_EASE });
});

test("the last card to close has a shorter return of its own", () => {
  assert.deepEqual(previewMotion(false), { ms: PREVIEW_CLOSE_MS, ease: PREVIEW_CLOSE_EASE });
  assert.ok(PREVIEW_CLOSE_MS < PREVIEW_OPEN_MS);
});

test("a card closes sooner when the pointer left the row than when it may reach a neighbour", () => {
  assert.ok(PREVIEW_LEAVE_AWAY_MS < PREVIEW_LEAVE_MS);
});

test("the trailer has faded before the card is back to its own width", () => {
  assert.ok(PREVIEW_TRAILER_OUT_MS < PREVIEW_CLOSE_MS);
});

test("both curves are ones the row can follow in script", () => {
  assert.deepEqual(bezierPoints(PREVIEW_OPEN_EASE), [0.4, 0, 0.2, 1]);
  assert.ok(bezierPoints(PREVIEW_CLOSE_EASE));
  assert.equal(bezierPoints("ease-out"), null);
});

test("a curve is followed as the browser follows it", () => {
  assert.equal(easeProgress(PREVIEW_CLOSE_EASE, 0), 0);
  assert.equal(easeProgress(PREVIEW_CLOSE_EASE, 1), 1);
  assert.equal(easeProgress(PREVIEW_CLOSE_EASE, -1), 0);
  assert.equal(easeProgress(PREVIEW_CLOSE_EASE, 2), 1);
  // cubic-bezier(0.42, 0, 0.58, 1) is symmetric: half way in time is half way along.
  assert.ok(Math.abs(easeProgress("cubic-bezier(0.42, 0, 0.58, 1)", 0.5) - 0.5) < 1e-6);
  // A straight curve is the time itself.
  assert.ok(Math.abs(easeProgress("cubic-bezier(0.25, 0.25, 0.75, 0.75)", 0.3) - 0.3) < 1e-6);
  // CSS `ease` is cubic-bezier(0.25, 0.1, 0.25, 1): 80.24% of the way at half its time.
  assert.ok(Math.abs(easeProgress("cubic-bezier(0.25, 0.1, 0.25, 1)", 0.5) - 0.8024) < 1e-3);
  let last = 0;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const now = easeProgress(PREVIEW_CLOSE_EASE, t);
    assert.ok(now >= last);
    last = now;
  }
});

test("a curve the script cannot read is followed as plain time", () => {
  assert.equal(easeProgress("ease-in-out", 0.25), 0.25);
});

test("a collection nobody has started plays its first film", () => {
  const picked = pickCollectionFilm(saga, watched(), TODAY);
  assert.deepEqual([picked?.film.name, picked?.standing], ["One", "start"]);
});

test("a collection part way through plays the first film not yet watched", () => {
  const picked = pickCollectionFilm(saga, watched("One", "Two"), TODAY);
  assert.deepEqual([picked?.film.name, picked?.standing], ["Three", "next"]);
  const skipped = pickCollectionFilm(saga, watched("One", "Three"), TODAY);
  assert.deepEqual([skipped?.film.name, skipped?.standing], ["Two", "next"]);
});

test("a film that is not out yet is never the one to play", () => {
  const picked = pickCollectionFilm(saga, watched("One", "Two", "Three"), TODAY);
  assert.deepEqual([picked?.film.name, picked?.standing], ["One", "again"]);
});

test("a collection with nothing released, or with no dates, plays nothing", () => {
  assert.equal(
    pickCollectionFilm([{ releaseDate: "2030-01-01" }], () => false, TODAY),
    null,
  );
  assert.equal(
    pickCollectionFilm([{}], () => false, TODAY),
    null,
  );
  assert.equal(
    pickCollectionFilm([], () => false, TODAY),
    null,
  );
});

test("a collection's years read as a span, or as the one year its films share", () => {
  assert.equal(collectionYears(saga), "2001–2027");
  assert.equal(collectionYears([{ releaseInfo: "1999" }, { releaseInfo: "1999" }]), "1999");
  assert.equal(collectionYears([{}, { releaseInfo: "" }]), null);
});
