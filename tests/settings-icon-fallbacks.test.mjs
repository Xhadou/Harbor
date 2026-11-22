import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../src/views/settings/${path}`, import.meta.url), "utf8");

// set-icon.tsx draws a settings icon from assets/settings-icons, and falls back to a short
// list of lucide icons it names itself. A name in neither place would be drawn as a circle.
test("every settings icon has a drawing or a named fallback", () => {
  const files = new Set(
    readdirSync(new URL("../src/assets/settings-icons/", import.meta.url))
      .filter((file) => file.endsWith(".svg"))
      .map((file) => file.slice(0, -4)),
  );
  const mapped = new Map(
    [...read("settings-icon-map.ts").matchAll(/^\s*"?(\w+)"?\s*:\s*"([^"]+)"/gm)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  const fallback = read("set-icon.tsx").match(/const FALLBACK[^=]*=\s*\{([^}]*)\}/);
  assert.ok(fallback, "set-icon.tsx names its fallback icons");
  const named = new Set(
    fallback[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );

  const used = [
    ...[...read("icons.ts").matchAll(/setIconComponent\("(\w+)"\)/g)].map((m) => m[1]),
    ...[...read("section-icons.ts").matchAll(/:\s*"(\w+)"/g)].map((m) => m[1]),
  ];
  assert.ok(used.length > 200);
  const undrawn = used.filter((name) => !files.has(mapped.get(name) ?? "") && !named.has(name));
  assert.deepEqual(undrawn, []);
});
