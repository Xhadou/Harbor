import assert from "node:assert/strict";
import test from "node:test";
import { readSavedStep, setupForward, setupSteps } from "../src/lib/setup-steps";

test("macOS setup is four steps and asks for a streaming source", () => {
  assert.deepEqual(setupSteps(true), ["language", "stremio", "source", "done"]);
});

test("other platforms keep the full setup, without the source step", () => {
  const full = setupSteps(false);
  assert.equal(full.length, 10);
  assert.equal(full[0], "splash");
  assert.equal(full.includes("source"), false);
  assert.equal(full.at(-1), "done");
});

test("a step offers Skip until it has what it asks for, then Continue", () => {
  const nothing = { signedIn: false, sourceCount: 0 };
  assert.equal(setupForward("language", nothing), "continue");
  assert.equal(setupForward("stremio", nothing), "skip");
  assert.equal(setupForward("source", nothing), "skip");
  assert.equal(setupForward("done", nothing), "finish");

  const ready = { signedIn: true, sourceCount: 2 };
  assert.equal(setupForward("stremio", ready), "continue");
  assert.equal(setupForward("source", ready), "continue");
});

test("sources still being read do not count as found", () => {
  assert.equal(setupForward("source", { signedIn: true, sourceCount: null }), "skip");
});

test("a reload returns to the step it left, and to the start on anything else", () => {
  const steps = setupSteps(true);
  assert.equal(readSavedStep(steps, "source"), 2);
  assert.equal(readSavedStep(steps, null), 0);
  assert.equal(readSavedStep(steps, "tmdb"), 0);
});
