// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import * as seal from "../src/lib/backup-seal.ts";

type BackupModule = typeof import("../src/lib/backup");

// Execute the real backup module with the native boundaries mocked so the
// restore picker can be exercised without Tauri or real file access.
function loadBackup(overrides: Record<string, unknown>): BackupModule {
  const empty = {};
  const mocks: Record<string, unknown> = {
    "@/lib/download-text": empty,
    "@/lib/profile-sync/backup-payload": { buildSyncBackup: () => ({}) },
    "@/lib/theme-storage": empty,
    "@/lib/profiles": { readAllProfilesIdentity: () => [] },
    "@/lib/active-profile-id": { activeProfileId: () => "local" },
    "@/lib/secret-store": empty,
    "@/lib/storage-recovery": empty,
    "@/lib/local-library": empty,
    "@/lib/backup-seal": seal,
    ...overrides,
  };
  const source = readFileSync(new URL("../src/lib/backup.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected native boundary: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return module.exports as BackupModule;
}

test("restore picks through the native dialog with an extension filter", async () => {
  const opened: unknown[] = [];
  const read: string[] = [];
  const picked = "/home/player/Downloads/Harbor Backup/harbor-backup-2026-10-13.harbx";
  const backup = loadBackup({
    "@tauri-apps/plugin-dialog": {
      open: async (options: unknown) => {
        opened.push(options);
        return picked;
      },
    },
    "@tauri-apps/plugin-fs": {
      readTextFile: async (path: string) => {
        read.push(path);
        return '{"format":"harbor-backup"}';
      },
    },
  });

  assert.equal(await backup.pickBackupFile(), '{"format":"harbor-backup"}');
  assert.deepEqual(opened, [
    {
      multiple: false,
      directory: false,
      filters: [{ name: "Harbor backup", extensions: ["harbx", "json"] }],
    },
  ]);
  assert.deepEqual(read, [picked]);
});

test("cancelling the native picker reads nothing", async () => {
  let reads = 0;
  const backup = loadBackup({
    "@tauri-apps/plugin-dialog": { open: async () => null },
    "@tauri-apps/plugin-fs": {
      readTextFile: async () => {
        reads++;
        return "";
      },
    },
  });

  assert.equal(await backup.pickBackupFile(), null);
  assert.equal(reads, 0);
});

test("a file that cannot be read surfaces the failure", async () => {
  const backup = loadBackup({
    "@tauri-apps/plugin-dialog": { open: async () => "/missing.harbx" },
    "@tauri-apps/plugin-fs": {
      readTextFile: async () => {
        throw new Error("ENOENT");
      },
    },
  });

  await assert.rejects(() => backup.pickBackupFile(), /ENOENT/);
});

test("sealed entries open with their passphrase and with nothing else", async () => {
  const sealed = await seal.sealEntries(
    { "harbor.trakt.session.v1": "token-fixture" },
    "correct horse",
  );
  assert.doesNotMatch(JSON.stringify(sealed), /token-fixture/);
  assert.equal(seal.isSealedEntries(sealed), true);
  assert.deepEqual(await seal.openSealedEntries(sealed, "correct horse"), {
    "harbor.trakt.session.v1": "token-fixture",
  });
  await assert.rejects(seal.openSealedEntries(sealed, "wrong horse"), seal.WrongPassphraseError);
  // One changed character in the file is caught, not restored as garbage.
  const flipped = sealed.data[5] === "A" ? "B" : "A";
  const tampered = { ...sealed, data: sealed.data.slice(0, 5) + flipped + sealed.data.slice(6) };
  await assert.rejects(
    seal.openSealedEntries(tampered, "correct horse"),
    seal.WrongPassphraseError,
  );
  assert.equal(seal.isSealedEntries({ ...sealed, iterations: 1000 }), false);
});

test("a backup with sign-ins keeps them sealed, and Live TV restores without the passphrase", async () => {
  const backup = loadBackup({});
  const playlists = JSON.stringify([
    { id: "m", kind: "m3u", url: "https://lists.example/one.m3u" },
    { id: "x", kind: "xtream", xtream: { username: "u", password: "xtream-fixture" } },
  ]);
  const built = {
    format: "harbor-backup",
    version: 1,
    app: "test",
    exportedAt: "",
    sections: ["settings", "sessions", "apiKeys", "iptv", "iptvCredentials"] as const,
    data: {
      "harbor.settings": "{}",
      "harbor.trakt.session.v1": "token-fixture",
      "harbor.settings-secrets.v1.shared": '{"fields":{"tmdbKey":"tmdb-fixture"}}',
      "harbor.iptv.playlists.v1": playlists,
    },
  };
  await assert.rejects(
    backup.sealBackupCredentials({ ...built, sections: [...built.sections] }, null),
  );
  const file = JSON.stringify(
    await backup.sealBackupCredentials(
      { ...built, sections: [...built.sections] },
      "correct horse",
    ),
  );
  assert.doesNotMatch(file, /token-fixture|tmdb-fixture|xtream-fixture/);

  const parsed = backup.parseBackup(file);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.ok(parsed.backup.sealed);
  // Without the passphrase: everything else, Live TV's other playlists included.
  assert.deepEqual(Object.keys(parsed.backup.data).sort(), [
    "harbor.iptv.playlists.v1",
    "harbor.settings",
  ]);
  assert.deepEqual(
    JSON.parse(parsed.backup.data["harbor.iptv.playlists.v1"]).map((p: { id: string }) => p.id),
    ["m"],
  );
  await assert.rejects(
    backup.openBackupCredentials(parsed.backup, "wrong horse"),
    seal.WrongPassphraseError,
  );
  const opened = await backup.openBackupCredentials(parsed.backup, "correct horse");
  assert.equal(opened.sealed, undefined);
  assert.equal(opened.data["harbor.trakt.session.v1"], "token-fixture");
  assert.equal(opened.data["harbor.iptv.playlists.v1"], playlists);
});

test("a backup holding only sealed sign-ins is still a backup", async () => {
  const backup = loadBackup({});
  const file = JSON.stringify(
    await backup.sealBackupCredentials(
      {
        format: "harbor-backup",
        version: 1,
        app: "test",
        exportedAt: "",
        sections: ["sessions"],
        data: { "harbor.trakt.session.v1": "token-fixture" },
      },
      "correct horse",
    ),
  );
  const parsed = backup.parseBackup(file);
  assert.ok(parsed.ok);
  assert.equal(backup.sectionsHoldCredentials(["settings", "theme"]), false);
  assert.equal(backup.sectionsHoldCredentials(["settings", "apiKeys"]), true);
});
