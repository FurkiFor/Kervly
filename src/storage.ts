import type { Env } from "./env";
import { b64, b64url, decryptJson, encryptJson, timingSafeEqualStr, unb64 } from "./crypto";
import { AppError } from "./i18n";
import type { BrandRow } from "./brands";

/**
 * Brand storage = a folder in a GitHub repository. Kervly uploads videos there (streamed, never
 * fully buffered) and reads them back when publishing. Works with private repositories: the
 * brand's token is stored encrypted and never leaves the server.
 */

export const MAX_UPLOAD_MB = 50;
const GH = "https://api.github.com";
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^(?!\/|.*\.\.|.*\/\/)[A-Za-z0-9._/-]{1,100}$/;
const PATH_RE = /^(?!\/|.*\.\.|.*\/\/)[A-Za-z0-9._/-]{0,200}$/;
export const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.mp4$/;

export interface StorageInput {
  repo: string;
  branch: string;
  path: string;
  token?: string;
}

export function parseStorageInput(input: Record<string, unknown>): StorageInput {
  const repo = String(input.repo ?? "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  if (!REPO_RE.test(repo)) throw new AppError("s.repo_invalid");
  const branch = String(input.branch ?? "main").trim() || "main";
  if (!BRANCH_RE.test(branch)) throw new AppError("s.branch_invalid");
  const path = String(input.path ?? "videos").trim().replace(/^\/+|\/+$/g, "");
  if (!PATH_RE.test(path)) throw new AppError("s.path_invalid");
  const token = typeof input.token === "string" && input.token.trim() ? input.token.trim() : undefined;
  if (token && (token.length > 255 || !/^[A-Za-z0-9_]+$/.test(token))) throw new AppError("s.token_invalid", { status: 0, repo });
  return { repo, branch, path, token };
}

function ghHeaders(token: string, accept = "application/vnd.github+json"): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: accept, "User-Agent": "kervly", "X-GitHub-Api-Version": "2022-11-28" };
}

const encPath = (p: string) => p.split("/").filter(Boolean).map(encodeURIComponent).join("/");

/** Checks that the token can write to the repository. Returns whether the repository is private. */
export async function verifyStorage(s: StorageInput, token: string): Promise<{ private: boolean }> {
  const r = await fetch(`${GH}/repos/${s.repo}`, { headers: ghHeaders(token) });
  if (!r.ok) throw new AppError("s.token_invalid", { status: r.status, repo: s.repo });
  const j = (await r.json()) as { private: boolean; permissions?: { push?: boolean } };
  if (!j.permissions?.push) throw new AppError("s.no_write", { repo: s.repo });
  return { private: Boolean(j.private) };
}

const aad = (brandId: string) => `storage:${brandId}`;

export async function encryptStorageToken(env: Env, brandId: string, token: string): Promise<string> {
  return encryptJson(env.ENCRYPTION_KEY!, token, aad(brandId));
}

export async function storageToken(env: Env, row: Pick<BrandRow, "id" | "storage_token_enc">): Promise<string | null> {
  if (!row.storage_token_enc || !env.ENCRYPTION_KEY) return null;
  return decryptJson<string>(env.ENCRYPTION_KEY, row.storage_token_enc, aad(row.id));
}

/** raw.githubusercontent.com prefix of the brand's folder (always ends with "/"). */
export function storagePrefix(row: Pick<BrandRow, "storage_repo" | "storage_branch" | "storage_path">): string | null {
  if (!row.storage_repo) return null;
  const path = row.storage_path ? `${row.storage_path}/` : "";
  return `https://raw.githubusercontent.com/${row.storage_repo}/${row.storage_branch || "main"}/${path}`;
}

/** Repository path of a media URL inside the brand's storage, or null when it is outside. */
export function storagePathOf(row: BrandRow, url: string): string | null {
  const prefix = storagePrefix(row);
  if (!prefix || !url.startsWith(prefix)) return null;
  const file = url.slice(prefix.length);
  if (!FILE_RE.test(file)) return null;
  return (row.storage_path ? `${row.storage_path}/` : "") + file;
}

export interface StoredFile {
  name: string;
  url: string;
  size: number;
}

export async function listStorage(env: Env, row: BrandRow): Promise<StoredFile[]> {
  const token = await storageToken(env, row);
  const prefix = storagePrefix(row);
  if (!token || !prefix) return [];
  const r = await fetch(`${GH}/repos/${row.storage_repo}/contents/${encPath(row.storage_path || "")}?ref=${encodeURIComponent(row.storage_branch || "main")}`, {
    headers: ghHeaders(token),
  });
  if (r.status === 404) return [];
  if (!r.ok) throw new AppError("gh.list", { status: r.status });
  const items = (await r.json()) as { type: string; name: string; size: number }[];
  if (!Array.isArray(items)) return [];
  return items
    .filter((it) => it.type === "file" && FILE_RE.test(it.name))
    .map((it) => ({ name: it.name, url: prefix + it.name, size: it.size }))
    .sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true }));
}

/** Streams a video out of the brand's repository (works for private repositories). */
export async function openStoredMedia(env: Env, row: BrandRow, url: string): Promise<{ body: ReadableStream; size: number } | null> {
  const path = storagePathOf(row, url);
  const token = await storageToken(env, row);
  if (!path || !token) return null;
  const ref = encodeURIComponent(row.storage_branch || "main");
  const meta = await fetch(`${GH}/repos/${row.storage_repo}/contents/${encPath(path)}?ref=${ref}`, { headers: ghHeaders(token, "application/vnd.github.object+json") });
  if (!meta.ok) throw new AppError("m.unreachable", { status: meta.status });
  const { size } = (await meta.json()) as { size: number };
  const raw = await fetch(`${GH}/repos/${row.storage_repo}/contents/${encPath(path)}?ref=${ref}`, { headers: ghHeaders(token, "application/vnd.github.raw+json") });
  if (!raw.ok || !raw.body) throw new AppError("m.download", { status: raw.status });
  return { body: raw.body, size };
}

/** Base64-encodes a byte stream on the fly (keeps memory flat for large files). */
export function base64Stream(): TransformStream<Uint8Array, Uint8Array> {
  const enc = new TextEncoder();
  let rest = new Uint8Array(0);
  return new TransformStream({
    transform(chunk, ctrl) {
      const all = new Uint8Array(rest.length + chunk.length);
      all.set(rest);
      all.set(chunk, rest.length);
      const cut = all.length - (all.length % 3);
      rest = all.slice(cut);
      for (let i = 0; i < cut; i += 48_000) ctrl.enqueue(enc.encode(b64(all.subarray(i, Math.min(i + 48_000, cut)))));
    },
    flush(ctrl) {
      if (rest.length) ctrl.enqueue(enc.encode(b64(rest)));
    },
  });
}

/** Commits a video to the brand's folder. The body is streamed straight into GitHub's API. */
export async function uploadToStorage(env: Env, row: BrandRow, fileName: string, body: ReadableStream<Uint8Array>, size: number, actorEmail: string): Promise<StoredFile> {
  if (!FILE_RE.test(fileName)) throw new AppError("s.file_name");
  if (!size || size > MAX_UPLOAD_MB * 1024 * 1024) throw new AppError("s.too_big", { max: MAX_UPLOAD_MB });
  const token = await storageToken(env, row);
  const prefix = storagePrefix(row);
  if (!token || !prefix) throw new AppError("s.not_configured");
  const path = (row.storage_path ? `${row.storage_path}/` : "") + fileName;
  const url = `${GH}/repos/${row.storage_repo}/contents/${encPath(path)}`;
  const exists = await fetch(`${url}?ref=${encodeURIComponent(row.storage_branch || "main")}`, { method: "HEAD", headers: ghHeaders(token) });
  if (exists.status === 200) throw new AppError("s.file_exists");

  const enc = new TextEncoder();
  const head = enc.encode(`{"message":${JSON.stringify(`Add ${fileName} (via Kervly)`)},"branch":${JSON.stringify(row.storage_branch || "main")},"content":"`);
  const tail = enc.encode(`"}`);
  const total = head.length + 4 * Math.ceil(size / 3) + tail.length;
  const { readable, writable } = new FixedLengthStream(total);
  const pump = (async () => {
    const w = writable.getWriter();
    await w.write(head);
    const reader = body.pipeThrough(base64Stream()).getReader();
    let sent = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sent += value.length;
      await w.write(value);
    }
    await w.write(tail);
    await w.close();
    return sent;
  })();
  const r = await fetch(url, { method: "PUT", headers: { ...ghHeaders(token), "Content-Type": "application/json" }, body: readable });
  await pump.catch(() => undefined);
  if (r.status === 422) throw new AppError("s.file_exists");
  if (r.status !== 201 && r.status !== 200) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    throw new AppError("s.upload_failed", { status: r.status, detail });
  }
  console.log(`upload ${row.id} ${fileName} by ${actorEmail}`);
  return { name: fileName, url: prefix + fileName, size };
}

// ---------------- signed media links (for platforms that download the video themselves) ----------------
async function mediaKey(env: Env): Promise<CryptoKey> {
  const raw = unb64(env.ENCRYPTION_KEY!);
  const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("kervly-media"), info: new TextEncoder().encode("signed-media-v1") },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
}

async function mediaSig(env: Env, postId: string, exp: number): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await mediaKey(env), new TextEncoder().encode(`${postId}.${exp}`));
  return b64url(mac);
}

/** Short-lived URL that streams a post's video from private storage. */
export async function signedMediaUrl(env: Env, base: string, postId: string, ttlMs = 30 * 60_000): Promise<string> {
  const exp = Date.now() + ttlMs;
  return `${base.replace(/\/+$/, "")}/m/${postId}.mp4?e=${exp}&s=${await mediaSig(env, postId, exp)}`;
}

export async function verifyMediaSig(env: Env, postId: string, exp: string | null, sig: string | null): Promise<boolean> {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e < Date.now() || e > Date.now() + 2 * 3600_000) return false;
  return timingSafeEqualStr(await mediaSig(env, postId, e), sig);
}
