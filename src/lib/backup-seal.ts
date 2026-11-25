/**
 * Sign-ins and keys in a backup file are sealed with a passphrase: the rest of
 * the file stays readable JSON, so a forgotten passphrase loses only them.
 *
 * AES-256-GCM, with the key derived from the passphrase by PBKDF2-SHA256 over a
 * random salt. GCM checks the data as it opens it, so a wrong passphrase (or a
 * changed file) fails instead of restoring garbage.
 */

export type SealedEntries = {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  /** Base64. */
  salt: string;
  /** Base64. */
  iv: string;
  /** Base64 ciphertext of a JSON object of storage keys to values. */
  data: string;
};

/** OWASP's figure for PBKDF2-SHA256; about half a second here. */
const ITERATIONS = 600_000;
/** Bound to the format, so sealed data cannot be moved into another kind of file. */
const CONTEXT = new TextEncoder().encode("harbor-backup-sealed-v1");

export const MIN_PASSPHRASE_LENGTH = 8;

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase does not open this backup's sign-ins.");
    this.name = "WrongPassphraseError";
  }
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    // The same passphrase typed on another keyboard or system can arrive in another normal form.
    new TextEncoder().encode(passphrase.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealEntries(
  entries: Record<string, string>,
  passphrase: string,
): Promise<SealedEntries> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: CONTEXT },
    key,
    new TextEncoder().encode(JSON.stringify(entries)),
  );
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
}

export async function openSealedEntries(
  sealed: SealedEntries,
  passphrase: string,
): Promise<Record<string, string>> {
  const key = await deriveKey(passphrase, fromBase64(sealed.salt), sealed.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: CONTEXT },
      key,
      fromBase64(sealed.data),
    );
  } catch {
    throw new WrongPassphraseError();
  }
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
  const out: Record<string, string> = {};
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function isSealedEntries(value: unknown): value is SealedEntries {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<SealedEntries>;
  return (
    s.v === 1 &&
    s.kdf === "PBKDF2-SHA256" &&
    typeof s.iterations === "number" &&
    Number.isInteger(s.iterations) &&
    // A file cannot make the restore spin for minutes, or derive a key with almost no work.
    s.iterations >= 100_000 &&
    s.iterations <= 10_000_000 &&
    typeof s.salt === "string" &&
    typeof s.iv === "string" &&
    typeof s.data === "string"
  );
}
