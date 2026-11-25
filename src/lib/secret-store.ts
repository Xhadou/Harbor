import { invoke } from "@tauri-apps/api/core";
import { profilesForSessionAdoption } from "./active-profile-id";

/** Sessions kept per profile in older builds (`<prefix>.<profileId>`); see `secretKeyForProfile`. */
const SECRET_PREFIXES = [
  "harbor.lastfm.v1",
  "harbor.sports.api-sports.v1",
  "harbor.simkl.session.v1",
  "harbor.trakt.session.v1",
  "harbor.mal.session.v1",
  "harbor.anilist.session.v1",
  "harbor.media-server.token.v1",
  "harbor.plex-auth.device.v1",
  "harbor.publicmetadb.session.v1",
];

/**
 * Sign-ins that were kept in browser storage, which the web view writes to disk as
 * it is. In the app they live here instead, and browser storage hands these keys to
 * this store (`routeSecretKeys`), so the code that reads them did not have to change.
 * Each covers the key itself and `<key>.<anything>`, except the flags below.
 */
const ROUTED_PREFIXES = [
  // Stremio, one per profile (`harbor.auth.<profileId>`; the bare key is an older build's).
  "harbor.auth",
  // Nuvio's account, with its tokens.
  "harbor.nuvio.state.v1",
  "harbor.nuvio.state",
  // The Harbor account, one per profile.
  "harbor.theme-session",
  "harbor.letterboxd.session.v1",
  "harbor.tvdb.token.v1",
  // IPTV playlists: Xtream ones hold a password, and their addresses carry it too.
  "harbor.iptv.playlists.v1",
  // The keys typed into Settings, one entry per stored copy of the settings.
  "harbor.settings-secrets.v1",
];

/** Markers that share a prefix above but hold no secret, and stay in browser storage. */
const NOT_SECRET = new Set(["harbor.auth.migrated.v1", "harbor.theme-session.repaired.v2"]);

function matches(prefixes: readonly string[], key: string): boolean {
  return prefixes.some((p) => key === p || key.startsWith(`${p}.`));
}

let store: Record<string, string> = {};
let rustAvailable = false;
let loaded = false;
let persistTimer: number | null = null;
let persistChain: Promise<void> = Promise.resolve();

/**
 * Session and credential keys change rarely and losing one costs the listener a
 * re-login — a rotated refresh token, for instance, is invalid server-side as soon as
 * it is handed out. They skip the debounce a sudden quit can cut short; everything
 * else still batches.
 */
const IMMEDIATE_KEY_PREFIXES = [
  ...SECRET_PREFIXES,
  "harbor.auth",
  "harbor.nuvio.state.v1",
  "harbor.nuvio.state",
  "harbor.theme-session",
  "harbor.letterboxd.session.v1",
  "harbor.iptv.playlists.v1",
  "harbor.settings-secrets.v1",
];

function isImmediateKey(key: string): boolean {
  return matches(IMMEDIATE_KEY_PREFIXES, key);
}

export function isSecretKey(key: string): boolean {
  if (NOT_SECRET.has(key)) return false;
  return matches(SECRET_PREFIXES, key) || matches(ROUTED_PREFIXES, key);
}

/** Rewrites a session key so it targets a specific profile, used when restoring a backup. */
export function secretKeyForProfile(key: string, profileId: string): string {
  for (const prefix of SECRET_PREFIXES) {
    if (key === prefix || key.startsWith(`${prefix}.`)) return `${prefix}.${profileId}`;
  }
  return key;
}

/** Snapshot of the Rust-persisted secret store, for backup/export use. */
export function getAllSecrets(): Record<string, string> {
  return { ...store };
}

/**
 * Browser storage as it is, for this store's own use once `routeSecretKeys` has
 * pointed the secret keys here.
 */
const nativeStorage =
  typeof Storage === "undefined"
    ? null
    : {
        getItem: Storage.prototype.getItem,
        setItem: Storage.prototype.setItem,
        removeItem: Storage.prototype.removeItem,
      };

function rawGet(key: string): string | null {
  return nativeStorage ? nativeStorage.getItem.call(localStorage, key) : localStorage.getItem(key);
}

function rawSet(key: string, value: string): void {
  if (nativeStorage) nativeStorage.setItem.call(localStorage, key, value);
  else localStorage.setItem(key, value);
}

function rawRemove(key: string): void {
  if (nativeStorage) nativeStorage.removeItem.call(localStorage, key);
  else localStorage.removeItem(key);
}

/** What this window changed since its last write: a removal is `null`. */
const changed = new Map<string, string | null>();

function parseStore(raw: string | null): Record<string, string> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, string>)
    : {};
}

/**
 * Every window keeps its own copy of the store, and a write replaces the whole
 * document. So a write starts from what is saved now and lays only this window's
 * changes over it: a window opened earlier cannot put back a session another
 * window has since replaced (a rotated refresh token is void at once). What the
 * other windows saved is taken into this one's copy on the way.
 */
async function persist(): Promise<void> {
  if (!rustAvailable || changed.size === 0) return;
  const mine = new Map(changed);
  changed.clear();
  let saved: Record<string, string>;
  try {
    saved = parseStore(await invoke<string | null>("secrets_read"));
  } catch {
    saved = { ...store };
  }
  for (const [key, value] of mine) {
    if (value == null) delete saved[key];
    else saved[key] = value;
  }
  for (const key of Object.keys(store)) {
    if (!(key in saved) && !changed.has(key)) delete store[key];
  }
  for (const [key, value] of Object.entries(saved)) {
    if (!changed.has(key)) store[key] = value;
  }
  try {
    await invoke("secrets_write", { content: JSON.stringify(saved) });
  } catch {
    // Kept for the next write.
    for (const [key, value] of mine) if (!changed.has(key)) changed.set(key, value);
  }
}

/** Writes in order, so an old snapshot can never land after a newer one. */
function persistSoon(): Promise<void> {
  persistChain = persistChain.then(persist, persist);
  return persistChain;
}

function schedulePersist(): void {
  if (persistTimer != null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistSoon();
  }, 200);
}

/** Flushes any pending secret writes immediately, for callers about to leave the page. */
export async function flushSecrets(): Promise<void> {
  if (persistTimer != null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistSoon();
}

export async function loadSecrets(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await invoke<string | null>("secrets_read");
    rustAvailable = true;
    store = parseStore(raw);
  } catch {
    rustAvailable = false;
    return;
  }

  // Sign-ins an older build left in browser storage move here, and are then taken out of it.
  const found: string[] = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && isSecretKey(key)) found.push(key);
    }
  } catch {
    void 0;
  }
  for (const key of found) {
    const val = rawGet(key);
    if (val != null && store[key] == null) {
      store[key] = val;
      changed.set(key, val);
    }
  }
  if (changed.size > 0) await persistSoon();
  if (changed.size === 0) {
    for (const key of found) {
      try {
        rawRemove(key);
      } catch {
        void 0;
      }
    }
  }
  routeSecretKeys();

  // Readers that mounted before this resolved saw an empty store, and migration has
  // already removed the localStorage copies they would have fallen back to, so every
  // connected account read as signed out until something re-read it. Tell them now.
  try {
    window.dispatchEvent(new Event(SECRETS_READY));
  } catch {
    void 0;
  }
}

let routed = false;

/**
 * Points browser storage's own methods at this store for the secret keys, so
 * `localStorage.getItem("harbor.auth.<id>")` and the rest read and write here
 * wherever they are called. Only once the store is loaded and backed by the app;
 * in a plain browser the keys stay in browser storage as before. Listing keys
 * (`localStorage.key`) does not include them: `secretKeys()` does.
 */
function routeSecretKeys(): void {
  if (routed || !rustAvailable || !nativeStorage) return;
  routed = true;
  const own = localStorage;
  Storage.prototype.getItem = function (this: Storage, key: string): string | null {
    if (this === own && isSecretKey(String(key))) return store[String(key)] ?? null;
    return nativeStorage.getItem.call(this, key);
  };
  Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
    if (this === own && isSecretKey(String(key))) setSecret(String(key), String(value));
    else nativeStorage.setItem.call(this, key, value);
  };
  Storage.prototype.removeItem = function (this: Storage, key: string): void {
    if (this === own && isSecretKey(String(key))) setSecret(String(key), null);
    else nativeStorage.removeItem.call(this, key);
  };
}

/** The keys this store holds, for code that walks browser storage by prefix. */
export function secretKeys(): string[] {
  return Object.keys(store);
}

/** Fires once the persisted store is in memory, so session readers can re-read. */
export const SECRETS_READY = "harbor:secrets-ready";

export function subscribeSecretsReady(fn: () => void): () => void {
  if (loaded && rustAvailable) fn();
  if (typeof window !== "undefined") {
    window.addEventListener(SECRETS_READY, fn);
    return () => window.removeEventListener(SECRETS_READY, fn);
  }
  return () => {};
}

export function getSecret(key: string): string | null {
  if (rustAvailable && store[key] != null) return store[key];
  try {
    return rawGet(key);
  } catch {
    return null;
  }
}

/**
 * Tracker sessions follow the account, not the profile: a connection made once serves
 * every profile on this device, so it lives under one shared key. Older builds stored a
 * session per profile — the first copy found (the active profile, then the main one) is
 * adopted, and a disconnect clears the rest so nothing resurrects it.
 */
export function readSharedSecret(base: string): string | null {
  const shared = getSecret(base);
  if (shared) return shared;
  for (const id of profilesForSessionAdoption()) {
    const found = getSecret(`${base}.${id}`);
    if (!found) continue;
    setSecret(`${base}.${id}`, null);
    setSecret(base, found);
    return found;
  }
  return null;
}

/** Writes the shared session; a disconnect also removes every per-profile copy. */
export function writeSharedSecret(base: string, value: string | null): void {
  setSecret(base, value);
  if (value !== null) return;
  for (const id of profilesForSessionAdoption()) setSecret(`${base}.${id}`, null);
}

export function setSecret(key: string, value: string | null): void {
  if (rustAvailable) {
    if ((store[key] ?? null) === value && !changed.has(key)) return;
    if (value == null) delete store[key];
    else store[key] = value;
    changed.set(key, value);
    if (isImmediateKey(key)) void persistSoon();
    else schedulePersist();
    try {
      rawRemove(key);
    } catch {
      void 0;
    }
    return;
  }
  try {
    if (value == null) rawRemove(key);
    else rawSet(key, value);
  } catch {
    void 0;
  }
}
