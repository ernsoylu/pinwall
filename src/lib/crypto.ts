// Zero-knowledge: the passphrase never leaves the browser and is never stored.
// The 16-byte PBKDF2 salt is prefixed to the ciphertext, so the DB only needs
// the `ciphertext` and `iv` columns it already has.

const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM standard
const ITERATIONS = 310_000; // OWASP guidance for PBKDF2-HMAC-SHA256

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(plaintext: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)),
  );

  const payload = new Uint8Array(salt.length + sealed.length);
  payload.set(salt);
  payload.set(sealed, salt.length);

  return { ciphertext: toB64(payload), iv: toB64(iv) };
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Wrong passphrase");
    this.name = "WrongPassphraseError";
  }
}

export async function decrypt(ciphertext: string, iv: string, passphrase: string) {
  const payload = fromB64(ciphertext);
  if (payload.length <= SALT_BYTES) throw new WrongPassphraseError();

  const key = await deriveKey(passphrase, payload.subarray(0, SALT_BYTES));
  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(iv) },
      key,
      payload.subarray(SALT_BYTES),
    );
    return dec.decode(opened);
  } catch {
    // AES-GCM auth tag failure is indistinguishable from a corrupt payload.
    throw new WrongPassphraseError();
  }
}
