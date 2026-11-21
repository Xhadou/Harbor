// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { matchesSettingsSearch, rankSettingsSearch } from "../src/views/settings/search-match.ts";
import {
  SEARCH_CONCEPTS,
  SEARCH_PHRASES,
  SEARCH_WEAK_WORDS,
} from "../src/views/settings/search-concepts.ts";

test("settings search matches translated labels without losing source-language matches", () => {
  const translations = new Map([
    ["Languages", "اللغات"],
    ["Account", "Conta"],
  ]);
  const translate = (value: string) => translations.get(value) ?? value;

  assert.equal(matchesSettingsSearch("اللغات", ["Languages"], translate), true);
  assert.equal(matchesSettingsSearch("conta", ["Account"], translate), true);
  assert.equal(matchesSettingsSearch("languages", ["Languages"], translate), true);
  assert.equal(matchesSettingsSearch("player", ["Languages"], translate), false);
});

test("settings search indexes open settings under Global", () => {
  const nav = readFileSync(new URL("../src/views/settings/nav.tsx", import.meta.url), "utf8");
  const entries = [
    ...nav.matchAll(
      /\{\s*label: "Open settings",\s*section: "hotkeys",\s*tab: "keys",\s*anchorTitle: "Global",\s*keywords: \[([^\]]+)\],?\s*\}/g,
    ),
  ];
  assert.equal(entries.length, 1, "exactly one Open settings search entry");
  assert.equal(entries[0][1], '"settings shortcut", "settings hotkey", "ctrl s", "preferences"');

  const focusAt = nav.indexOf('label: "Focus search"');
  const settingsAt = nav.indexOf('label: "Open settings"');
  const scaleAt = nav.indexOf('label: "Increase interface scale"');
  assert.equal(focusAt < settingsAt && settingsAt < scaleAt, true);
});

const plain = (value: string) => value;

test("a setting is found by another word for the same idea", () => {
  assert.equal(matchesSettingsSearch("captions", ["Subtitles"], plain), true);
  assert.equal(matchesSettingsSearch("erase cache", ["Clear caches"], plain), true);
  assert.equal(matchesSettingsSearch("joystick", ["Controllers"], plain), true);
  assert.equal(matchesSettingsSearch("telemetry", ["Privacy"], plain), true);
  assert.equal(matchesSettingsSearch("sound is too quiet", ["Maximum volume boost"], plain), true);
  // The idea has to be there: another word for subtitles does not find the account.
  assert.equal(matchesSettingsSearch("captions", ["Account"], plain), false);
  assert.equal(matchesSettingsSearch("joystick", ["Subtitles"], plain), false);
});

test("a misspelled word is still read as the idea it names", () => {
  assert.equal(matchesSettingsSearch("captoins", ["Subtitles"], plain), true);
  assert.equal(matchesSettingsSearch("keybord", ["Hotkeys"], plain), true);
});

test("known wordings are rewritten to the index's own words", () => {
  assert.equal(matchesSettingsSearch("dark mode", ["Theme"], plain, ["true black"]), true);
  assert.equal(matchesSettingsSearch("closed captions", ["Subtitles"], plain), true);
  assert.equal(matchesSettingsSearch("log out", ["Sign out"], plain), true);
  assert.equal(matchesSettingsSearch("log in", ["Sign in to Harbor"], plain), true);
  // "log in" is about signing in, not about anything spelled with "log".
  assert.equal(matchesSettingsSearch("log in", ["App logo"], plain), false);
  // "cc" means captions as a word of its own, not as two letters of "account".
  assert.equal(matchesSettingsSearch("cc", ["Subtitles"], plain), true);
  assert.equal(matchesSettingsSearch("cc", ["Account"], plain), false);
});

test("a word for the kind of thing is not held against an entry", () => {
  assert.equal(matchesSettingsSearch("kids mode", ["Hide Kids"], plain), true);
  assert.equal(matchesSettingsSearch("volume settings", ["Volume control"], plain), true);
  // Alone it is all there is to go on.
  assert.equal(matchesSettingsSearch("mode", ["Private mode"], plain), true);
  assert.equal(matchesSettingsSearch("mode", ["Theme"], plain), false);
});

test("an entry that says it outright ranks above one that says it in other words", () => {
  const outright = rankSettingsSearch("captions", "Captions style");
  const byMeaning = rankSettingsSearch("large captions", "Subtitle size");
  const unrelated = rankSettingsSearch("large captions", "Account");
  assert.ok(outright < byMeaning);
  assert.ok(byMeaning < unrelated);
});

test("the concept tables hold single lower-case words, each once per line", () => {
  for (const line of SEARCH_CONCEPTS) {
    assert.ok(line.length >= 2, `a line needs two words: ${line.join(", ")}`);
    assert.equal(new Set(line).size, line.length, `repeated word in: ${line.join(", ")}`);
    for (const word of line) assert.match(word, /^[a-z0-9]{2,}$/, `not a single word: "${word}"`);
  }
  for (const [from, to] of SEARCH_PHRASES) {
    assert.match(from, /^[a-z0-9]+( [a-z0-9]+)*$/);
    assert.match(to, /^[a-z0-9]+( [a-z0-9]+)*$/);
    assert.notEqual(from, to);
  }
  for (const word of SEARCH_WEAK_WORDS) assert.match(word, /^[a-z]+$/);
});
