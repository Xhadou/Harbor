import { getSecret, setSecret } from "@/lib/secret-store";

/**
 * The settings that are keys and tokens. Stored copies of the settings (browser
 * storage and settings.json) leave them empty; their values are kept in the secret
 * store, one entry per stored copy, and put back whenever a copy is read.
 */
export const SECRET_SETTING_FIELDS = [
  "tmdbKey",
  "omdbKey",
  "rpdbKey",
  "fanartKey",
  "tvdbKey",
  "rdKey",
  "tbKey",
  "adKey",
  "pmKey",
  "dlKey",
  "traktClientSecret",
  "traktAccessToken",
  "traktRefreshToken",
  "togetherCfToken",
  "seekrApiKey",
  "mdblistKey",
  "auddKey",
  "songIdAiKey",
  "aiSearchKey",
  "aiGroqKey",
  "jinaKey",
  "keenableKey",
  "opensubtitlesApiKey",
  "theIntroDbKey",
  "jimakuToken",
  "subdlApiKey",
  "subsourceApiKey",
  "nytKey",
  "sportsApiKey",
  "auddApiKey",
] as const;

type Blob = Record<string, unknown>;

/** What a stored copy holds back: the fields above, and each Xtream playlist's password by id. */
export type SettingsSecrets = {
  fields?: Record<string, string>;
  xtream?: Record<string, string>;
};

const SECRETS_PREFIX = "harbor.settings-secrets.v1";
const MIRROR_KEY = "harbor.settings";
const SETTINGS_PREFIX = "harbor.settings.";

/** The secret-store entry for the stored copy of the settings under `blobKey`. */
export function secretsKeyFor(blobKey: string): string {
  if (blobKey === MIRROR_KEY) return `${SECRETS_PREFIX}.mirror`;
  if (blobKey.startsWith(SETTINGS_PREFIX)) {
    return `${SECRETS_PREFIX}.${blobKey.slice(SETTINGS_PREFIX.length)}`;
  }
  return `${SECRETS_PREFIX}.${blobKey}`;
}

function playlistsOf(blob: Blob): Array<Record<string, unknown>> {
  return Array.isArray(blob.iptvPlaylists)
    ? (blob.iptvPlaylists as unknown[]).filter(
        (p): p is Record<string, unknown> => !!p && typeof p === "object",
      )
    : [];
}

/** Takes the secret values out of a parsed settings object, in place, and returns them. */
export function takeSecrets(blob: Blob): SettingsSecrets {
  const out: SettingsSecrets = {};
  for (const field of SECRET_SETTING_FIELDS) {
    const value = blob[field];
    if (typeof value !== "string") continue;
    if (value) (out.fields ??= {})[field] = value;
    // A field that was null stays null: the loader tells the two apart.
    blob[field] = "";
  }
  for (const playlist of playlistsOf(blob)) {
    const xtream = playlist.xtream as Record<string, unknown> | undefined;
    if (!xtream || typeof xtream.password !== "string") continue;
    if (xtream.password && typeof playlist.id === "string") {
      (out.xtream ??= {})[playlist.id] = xtream.password;
    }
    playlist.xtream = { ...xtream, password: "" };
  }
  return out;
}

/**
 * Puts kept values back into a parsed settings object, in place. A value still in
 * the copy itself wins: every save takes the values out, so a copy that holds one
 * was written after it was kept (by an older build, or restored from a backup).
 */
export function putSecrets(blob: Blob, secrets: SettingsSecrets | null): void {
  if (!secrets) return;
  for (const [field, value] of Object.entries(secrets.fields ?? {})) {
    if (!(SECRET_SETTING_FIELDS as readonly string[]).includes(field)) continue;
    if (!blob[field]) blob[field] = value;
  }
  const xtream = secrets.xtream ?? {};
  for (const playlist of playlistsOf(blob)) {
    const password = typeof playlist.id === "string" ? xtream[playlist.id] : undefined;
    const own = playlist.xtream as Record<string, unknown> | undefined;
    if (password && own && !own.password) playlist.xtream = { ...own, password };
  }
}

export function readSettingsSecrets(blobKey: string): SettingsSecrets | null {
  const raw = getSecret(secretsKeyFor(blobKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as SettingsSecrets) : null;
  } catch {
    return null;
  }
}

export function writeSettingsSecrets(blobKey: string, secrets: SettingsSecrets | null): void {
  const empty = !secrets || (!secrets.fields && !secrets.xtream);
  setSecret(secretsKeyFor(blobKey), empty ? null : JSON.stringify(secrets));
}

/** The kept values of one stored copy move to another, as the copy itself does. */
export function copySettingsSecrets(fromBlobKey: string, toBlobKey: string): void {
  writeSettingsSecrets(toBlobKey, readSettingsSecrets(fromBlobKey));
}

/**
 * A stored copy's JSON with its kept values put back, for code that reads the
 * settings out of browser storage itself rather than through the loader.
 */
export function withSettingsSecrets(raw: string | null, blobKey: string): Blob {
  if (!raw) return {};
  try {
    const blob = JSON.parse(raw) as unknown;
    if (!blob || typeof blob !== "object" || Array.isArray(blob)) return {};
    putSecrets(blob as Blob, readSettingsSecrets(blobKey));
    return blob as Blob;
  } catch {
    return {};
  }
}

const HOLDS_A_SECRET = new RegExp(
  `"(?:${SECRET_SETTING_FIELDS.join("|")}|password)"\\s*:\\s*"[^"]`,
);

/**
 * Moves the keys out of every stored copy of the settings that still holds them:
 * copies written by an older build, or brought back from an old backup. The copy
 * in use is also cleaned by its next save; the others may not be saved for a long
 * time. Returns how many copies changed.
 */
export function moveSecretsOutOfStoredSettings(storage: Storage = localStorage): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && (key === MIRROR_KEY || key.startsWith(SETTINGS_PREFIX))) keys.push(key);
  }
  let moved = 0;
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (!raw || !HOLDS_A_SECRET.test(raw)) continue;
    try {
      const blob = JSON.parse(raw) as unknown;
      if (!blob || typeof blob !== "object" || Array.isArray(blob)) continue;
      const found = takeSecrets(blob as Blob);
      const kept = readSettingsSecrets(key) ?? {};
      writeSettingsSecrets(key, {
        ...((found.fields || kept.fields) && { fields: { ...kept.fields, ...found.fields } }),
        ...((found.xtream || kept.xtream) && { xtream: { ...kept.xtream, ...found.xtream } }),
      });
      storage.setItem(key, JSON.stringify(blob));
      moved += 1;
    } catch {
      // Left as it is; the loader still reads it.
    }
  }
  return moved;
}
