import assert from "node:assert/strict";
import test from "node:test";
import "./_localstorage-stub.ts";
import { DEFAULT } from "../src/lib/settings/defaults.ts";
import { loadStoredSettings } from "../src/lib/settings/load.ts";
import {
  MIRROR_KEY,
  SHARED_KEY,
  forkToProfile,
  loadEffective,
  persistEffective,
  profileKey,
} from "../src/lib/settings/profile-store.ts";
import {
  moveSecretsOutOfStoredSettings,
  secretsKeyFor,
} from "../src/lib/settings/secret-fields.ts";

// Without the app's secret store (this runs outside it) the kept values fall back to
// their own browser-storage entry; what matters here is that the stored copies of the
// settings, which are mirrored to settings.json, never hold them.

test("a saved copy of the settings leaves keys and tokens out, and loading puts them back", () => {
  localStorage.clear();
  const json = persistEffective(
    { ...DEFAULT, tmdbKey: "tmdb-fixture", rdKey: "rd-fixture", posterBaseUrl: "https://p" },
    "default",
    true,
  );
  assert.doesNotMatch(json, /tmdb-fixture|rd-fixture/);
  assert.doesNotMatch(localStorage.getItem(SHARED_KEY) ?? "", /tmdb-fixture|rd-fixture/);
  assert.doesNotMatch(localStorage.getItem(MIRROR_KEY) ?? "", /tmdb-fixture|rd-fixture/);
  const loaded = loadEffective("default", true);
  assert.equal(loaded.tmdbKey, "tmdb-fixture");
  assert.equal(loaded.rdKey, "rd-fixture");
  assert.equal(loaded.posterBaseUrl, "https://p");
  assert.equal(loadStoredSettings(MIRROR_KEY).tmdbKey, "tmdb-fixture");
  localStorage.clear();
});

test("a cleared key stays cleared", () => {
  localStorage.clear();
  persistEffective({ ...DEFAULT, tmdbKey: "tmdb-fixture" }, "default", true);
  persistEffective({ ...DEFAULT, tmdbKey: "" }, "default", true);
  assert.equal(loadEffective("default", true).tmdbKey, "");
  assert.equal(localStorage.getItem(secretsKeyFor(SHARED_KEY)), null);
  localStorage.clear();
});

test("a profile given its own settings takes the keys with it", () => {
  localStorage.clear();
  persistEffective({ ...DEFAULT, tmdbKey: "tmdb-fixture" }, "default", true);
  forkToProfile("kid");
  assert.equal(loadEffective("kid", false).tmdbKey, "tmdb-fixture");
  assert.doesNotMatch(localStorage.getItem(profileKey("kid")) ?? "", /tmdb-fixture/);
  localStorage.clear();
});

test("copies an older build left behind are emptied, and the value in a copy wins", () => {
  localStorage.clear();
  persistEffective({ ...DEFAULT, tmdbKey: "kept" }, "default", true);
  // An older build, or a restored backup, wrote the key into the copy itself.
  localStorage.setItem(
    profileKey("p_old"),
    JSON.stringify({ ...DEFAULT, tmdbKey: "written-later", omdbKey: "omdb-fixture" }),
  );
  assert.equal(loadEffective("p_old", false).tmdbKey, "written-later");
  assert.equal(moveSecretsOutOfStoredSettings(), 1);
  assert.doesNotMatch(
    localStorage.getItem(profileKey("p_old")) ?? "",
    /written-later|omdb-fixture/,
  );
  const loaded = loadEffective("p_old", false);
  assert.equal(loaded.tmdbKey, "written-later");
  assert.equal(loaded.omdbKey, "omdb-fixture");
  assert.equal(moveSecretsOutOfStoredSettings(), 0);
  localStorage.clear();
});
