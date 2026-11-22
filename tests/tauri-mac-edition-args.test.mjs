import assert from "node:assert/strict";
import test from "node:test";
import { addMacEditionArgs, shouldBuildMacEdition } from "../scripts/tauri-args.mjs";

test("a desktop build or dev run on a Mac is the Mac edition", () => {
  assert.equal(shouldBuildMacEdition("darwin", ["dev"], {}), true);
  assert.equal(shouldBuildMacEdition("darwin", ["build", "--bundles", "app"], {}), true);
});

test("other platforms, other commands and an explicit full edition are left alone", () => {
  assert.equal(shouldBuildMacEdition("win32", ["build"], {}), false);
  assert.equal(shouldBuildMacEdition("linux", ["dev"], {}), false);
  assert.equal(shouldBuildMacEdition("darwin", ["android", "build"], {}), false);
  assert.equal(shouldBuildMacEdition("darwin", ["build", "--help"], {}), false);
  assert.equal(shouldBuildMacEdition("darwin", ["build"], { HARBOR_EDITION: "full" }), false);
});

test("the Cargo flags go after the divider, ahead of any already there", () => {
  assert.deepEqual(addMacEditionArgs(["build", "--bundles", "app"]), [
    "build",
    "--bundles",
    "app",
    "--",
    "--no-default-features",
    "--features",
    "plugins",
  ]);
  assert.deepEqual(addMacEditionArgs(["dev", "--", "--locked", "--", "--app-flag"]), [
    "dev",
    "--",
    "--no-default-features",
    "--features",
    "plugins",
    "--locked",
    "--",
    "--app-flag",
  ]);
});
