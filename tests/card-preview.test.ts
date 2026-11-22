import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_HANDOFF_MS,
  PREVIEW_LEAVE_MS,
  PREVIEW_REST_MS,
  PREVIEW_WARM_MS,
  previewOpenDelay,
} from "../src/lib/card-preview/policy.ts";
import { collectionYears, pickCollectionFilm } from "../src/lib/card-preview/collection-pick.ts";

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

test("the next card opens almost at once while a preview is open or has just closed", () => {
  assert.equal(previewOpenDelay(0), PREVIEW_HANDOFF_MS);
  assert.equal(previewOpenDelay(PREVIEW_WARM_MS), PREVIEW_HANDOFF_MS);
});

test("a card reached well after the last preview closed waits like the first", () => {
  assert.equal(previewOpenDelay(PREVIEW_WARM_MS + 1), PREVIEW_REST_MS);
});

test("an open card outlasts the hand-off, so two cards swap in one movement", () => {
  assert.ok(PREVIEW_LEAVE_MS > PREVIEW_HANDOFF_MS);
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
