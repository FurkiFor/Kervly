import type { Env } from "./env";
import { b64, b64url, decryptJson, encryptJson, timingSafeEqualStr, unb64 } from "./crypto";
import { AppError } from "./i18n";
import type { BrandRow } from "./brands";
import type { UserRow } from "./users";

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

// ---------------- account storage: one repository + token per user, one folder per brand ----------------
const userAad = (userId: string) => `storage-user:${userId}`;

export interface AccountStorage {
  repo: string;
  branch: string;
  /** Optional base folder; every brand gets <base>/<brand id>/. */
  path: string;
  private: boolean;
  has_token: boolean;
}

export function toAccountStorage(u: Pick<UserRow, "storage_repo" | "storage_branch" | "storage_path" | "storage_token_enc" | "storage_private">): AccountStorage | null {
  if (!u.storage_repo) return null;
  return {
    repo: u.storage_repo,
    branch: u.storage_branch || "main",
    path: u.storage_path || "",
    private: Boolean(u.storage_private),
    has_token: Boolean(u.storage_token_enc),
  };
}

/** Folder of a brand inside the account storage. */
export const brandFolder = (base: string | null | undefined, brandId: string) => (base ? `${base}/${brandId}` : brandId);

async function accountToken(env: Env, u: Pick<UserRow, "id" | "storage_token_enc">): Promise<string | null> {
  if (!u.storage_token_enc || !env.ENCRYPTION_KEY) return null;
  return decryptJson<string>(env.ENCRYPTION_KEY, u.storage_token_enc, userAad(u.id));
}

/** Git has no empty folders: a small placeholder file makes the brand's folder appear in the repository. */
async function ensureFolder(token: string, repo: string, branch: string, folder: string): Promise<boolean> {
  const url = `${GH}/repos/${repo}/contents/${encPath(`${folder}/.gitkeep`)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Create ${folder}/ (via Kervly)`, branch, content: "S2Vydmx5Cg==" }),
  });
  return r.status === 201 || r.status === 200 || r.status === 422; // 422: the file is already there
}

/** Points one brand at its own folder in the account storage. Returns whether the folder exists in the repository. */
export async function linkBrand(env: Env, u: UserRow, brandId: string, token?: string): Promise<boolean> {
  const tok = token ?? (await accountToken(env, u));
  if (!u.storage_repo || !tok) return false;
  const folder = brandFolder(u.storage_path, brandId);
  await env.DB.prepare(
    "UPDATE brands SET storage_repo = ?, storage_branch = ?, storage_path = ?, storage_token_enc = ?, storage_private = ?, storage_inherited = 1, updated_at = ? WHERE id = ?",
  )
    .bind(u.storage_repo, u.storage_branch || "main", folder, await encryptStorageToken(env, brandId, tok), u.storage_private, Date.now(), brandId)
    .run();
  try {
    return await ensureFolder(tok, u.storage_repo, u.storage_branch || "main", folder);
  } catch {
    return false;
  }
}

/**
 * Saves the account's GitHub storage (verified, token encrypted) and applies it to every brand that has no storage of its
 * own. Leaving the token empty keeps the current one when the repository is unchanged.
 */
export async function setAccountStorage(env: Env, actor: { id: string }, input: Record<string, unknown>): Promise<{ storage: AccountStorage; linked: number; folders: number }> {
  const u = (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(actor.id).first<UserRow>())!;
  const s = parseStorageInput({ ...input, path: input.path ?? "" });
  let token = s.token;
  if (!token) {
    if (!u.storage_token_enc || u.storage_repo !== s.repo) throw new AppError("s.token_required");
    token = (await accountToken(env, u)) ?? undefined;
    if (!token) throw new AppError("s.token_required");
  }
  const v = await verifyStorage(s, token);
  const tokenEnc = await encryptJson(env.ENCRYPTION_KEY!, token, userAad(u.id));
  await env.DB.prepare("UPDATE users SET storage_repo = ?, storage_branch = ?, storage_path = ?, storage_token_enc = ?, storage_private = ? WHERE id = ?")
    .bind(s.repo, s.branch, s.path, tokenEnc, v.private ? 1 : 0, u.id)
    .run();
  const fresh = (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first<UserRow>())!;
  const { results } = await env.DB.prepare("SELECT id FROM brands WHERE owner_id = ? AND (storage_repo IS NULL OR storage_inherited = 1)").bind(u.id).all<{ id: string }>();
  let folders = 0;
  for (const b of results) if (await linkBrand(env, fresh, b.id, token)) folders++;
  return { storage: toAccountStorage(fresh)!, linked: results.length, folders };
}

export async function clearAccountStorage(env: Env, actor: { id: string }): Promise<void> {
  await env.DB.prepare("UPDATE users SET storage_repo = NULL, storage_branch = NULL, storage_path = NULL, storage_token_enc = NULL, storage_private = 0 WHERE id = ?").bind(actor.id).run();
}

// ---------------- uploads from outside the dashboard (MCP) ----------------
export const UPLOAD_LINK_TTL_MS = 15 * 60_000;

/** A file name Kervly accepts (letters, digits, - _ .) ending in .mp4. */
export function sanitizeFileName(input: string, fallback = `video-${Date.now()}`): string {
  const base = decodeURIComponent(input.split(/[?#]/)[0].split("/").pop() || "").replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const clean = base.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "").slice(0, 100);
  return `${clean || fallback}.mp4`;
}

async function uploadSig(env: Env, brandId: string, file: string, exp: number): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await mediaKey(env), new TextEncoder().encode(`upload.${brandId}.${file}.${exp}`));
  return b64url(mac);
}

/** Short-lived link a client can PUT a video to (no login needed; the signature binds brand, file name and expiry). */
export async function signedUploadUrl(env: Env, base: string, brandId: string, file: string, ttlMs = UPLOAD_LINK_TTL_MS): Promise<string> {
  const exp = Date.now() + ttlMs;
  return `${base.replace(/\/+$/, "")}/upload/${brandId}/${file}?e=${exp}&s=${await uploadSig(env, brandId, file, exp)}`;
}

export async function verifyUploadSig(env: Env, brandId: string, file: string, exp: string | null, sig: string | null): Promise<boolean> {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e < Date.now() || e > Date.now() + 2 * UPLOAD_LINK_TTL_MS) return false;
  return timingSafeEqualStr(await uploadSig(env, brandId, file, e), sig);
}

/** Rejects anything that is not an MP4 (checks the "ftyp" box in the first bytes) without buffering the file. */
export async function requireMp4(body: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>> {
  const reader = body.getReader();
  const first: Uint8Array[] = [];
  let have = 0;
  while (have < 12) {
    const { done, value } = await reader.read();
    if (done) break;
    first.push(value);
    have += value.length;
  }
  const head = new Uint8Array(have);
  let o = 0;
  for (const c of first) (head.set(c, o), (o += c.length));
  if (have < 12 || String.fromCharCode(...head.subarray(4, 8)) !== "ftyp") {
    await reader.cancel().catch(() => undefined);
    throw new AppError("s.not_mp4");
  }
  return new ReadableStream({
    start(ctrl) {
      for (const c of first) ctrl.enqueue(c);
    },
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) ctrl.close();
      else ctrl.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
}

/** Downloads a video from a public https URL (size must be announced and within the upload limit). */
export async function downloadVideo(sourceUrl: string): Promise<{ body: ReadableStream<Uint8Array>; size: number }> {
  let u: URL;
  try {
    u = new URL(sourceUrl);
  } catch {
    throw new AppError("s.source_invalid");
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    throw new AppError("s.source_invalid");
  }
  const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "kervly", Accept: "video/mp4,*/*" } });
  if (!r.ok || !r.body) throw new AppError("s.source_failed", { status: r.status });
  const size = Number(r.headers.get("Content-Length") || 0);
  if (!size) {
    await r.body.cancel();
    throw new AppError("s.source_no_length");
  }
  if (size > MAX_UPLOAD_MB * 1024 * 1024) {
    await r.body.cancel();
    throw new AppError("s.too_big", { max: MAX_UPLOAD_MB });
  }
  if (/^text\//i.test(r.headers.get("Content-Type") || "")) {
    await r.body.cancel();
    throw new AppError("s.not_mp4");
  }
  return { body: r.body, size };
}
