const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBytes(n: number): Uint8Array {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
}

export function randomToken(n = 32): string {
  return b64url(randomBytes(n));
}

export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const d = typeof data === "string" ? enc.encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", d));
}

export async function sha256Hex(data: string): Promise<string> {
  return [...(await sha256(data))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}

// ---------------- Password (PBKDF2-SHA256) ----------------
// Format: pbkdf2$<iterations>$<salt b64>$<hash b64>
// Workers WebCrypto allows at most 100000 PBKDF2 iterations.
export const PBKDF2_ITERATIONS = 100000;

export async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(h)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 100000) return false;
  const h = await pbkdf2(password, unb64(parts[2]), iterations);
  return timingSafeEqual(h, unb64(parts[3]));
}

// ---------------- Encryption (AES-256-GCM) ----------------
async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64.trim());
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Output: v1.<iv b64>.<ciphertext b64>. `aad` binds the ciphertext to its context. */
export async function encryptJson(keyB64: string, value: unknown, aad: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    await aesKey(keyB64),
    enc.encode(JSON.stringify(value)),
  );
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptJson<T>(keyB64: string, blob: string, aad: string): Promise<T> {
  const [v, ivB64, ctB64] = blob.split(".");
  if (v !== "v1" || !ivB64 || !ctB64) throw new Error("Invalid ciphertext");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64), additionalData: enc.encode(aad) },
    await aesKey(keyB64),
    unb64(ctB64),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

// ---------------- TOTP (RFC 6238) ----------------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(u: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of u) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export async function totpAt(secretB32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32Decode(secretB32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Returns the matching time counter (used to block code reuse) or null. */
export async function verifyTotp(secretB32: string, code: string, now = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(now / 1000 / 30);
  for (const d of [0, -1, 1]) {
    const expected = await totpAt(secretB32, counter + d);
    if (timingSafeEqualStr(expected, code)) return counter + d;
  }
  return null;
}
