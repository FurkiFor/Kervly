import { isSuper, type Actor, type Env } from "./env";
import { AppError } from "./i18n";
import { validatePrefix } from "./media";
import { encryptStorageToken, parseStorageInput, storagePrefix, storageToken, verifyStorage } from "./storage";

export interface BrandRow {
  id: string;
  name: string;
  media_prefixes: string;
  max_posts_per_day: number;
  timezone: string;
  default_times: string;
  owner_id: string | null;
  storage_repo: string | null;
  storage_branch: string | null;
  storage_path: string | null;
  storage_token_enc: string | null;
  storage_private: number;
  storage_inherited: number;
  created_at: number;
  updated_at: number;
  owner_email?: string | null;
}

/** A brand owns its own platform accounts, video storage, daily limit and time zone. */
export interface Brand {
  id: string;
  name: string;
  /** Extra public folders videos may come from (besides the storage folder). */
  media_prefixes: string[];
  /** Every prefix a video URL may start with: storage folder + extra folders. */
  allowed_prefixes: string[];
  max_posts_per_day: number;
  timezone: string;
  default_times: string[];
  owner_id: string | null;
  owner_email?: string | null;
  storage: { repo: string; branch: string; path: string; private: boolean; has_token: boolean; prefix: string; inherited: boolean } | null;
}

export const BRAND_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export function toBrand(r: BrandRow): Brand {
  const prefixes: string[] = JSON.parse(r.media_prefixes || "[]");
  const sp = storagePrefix(r);
  return {
    id: r.id,
    name: r.name,
    media_prefixes: prefixes,
    allowed_prefixes: sp ? [sp, ...prefixes] : prefixes,
    max_posts_per_day: r.max_posts_per_day,
    timezone: r.timezone,
    default_times: JSON.parse(r.default_times || "[]"),
    owner_id: r.owner_id,
    owner_email: r.owner_email,
    storage: r.storage_repo
      ? {
          repo: r.storage_repo,
          branch: r.storage_branch || "main",
          path: r.storage_path || "",
          private: Boolean(r.storage_private),
          has_token: Boolean(r.storage_token_enc),
          prefix: sp!,
          inherited: Boolean(r.storage_inherited),
        }
      : null,
  };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateBrandInput(env: Env, input: Record<string, unknown>, isNew: boolean) {
  const out: Partial<Omit<Brand, "storage">> = {};
  if (isNew) {
    const id = String(input.id ?? "").trim().toLowerCase();
    if (!BRAND_ID_RE.test(id)) throw new AppError("b.id_format");
    out.id = id;
  }
  if (input.name !== undefined || isNew) {
    const name = String(input.name ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (!name || name.length > 60) throw new AppError("b.name_len");
    out.name = name;
  }
  if (input.media_prefixes !== undefined) {
    const list = Array.isArray(input.media_prefixes) ? input.media_prefixes : String(input.media_prefixes).split(/[\n,]/);
    const cleaned = list.map((x) => String(x).trim()).filter(Boolean);
    if (cleaned.length > 10) throw new AppError("b.too_many_prefixes");
    out.media_prefixes = [...new Set(cleaned.map((p) => validatePrefix(p, env.MEDIA_ALLOWED_HOSTS)))];
  }
  if (input.max_posts_per_day !== undefined) {
    const n = Number(input.max_posts_per_day);
    const ceiling = Number(env.MAX_POSTS_PER_DAY_CEILING || 10);
    if (!Number.isInteger(n) || n < 1 || n > ceiling) throw new AppError("b.limit_range", { max: ceiling });
    out.max_posts_per_day = n;
  }
  if (input.timezone !== undefined) {
    const tz = String(input.timezone).trim();
    if (!isValidTimezone(tz)) throw new AppError("b.tz_invalid");
    out.timezone = tz;
  }
  if (input.default_times !== undefined) {
    const list = Array.isArray(input.default_times) ? input.default_times : String(input.default_times).split(/[\s,]+/);
    const times = list.map((x) => String(x).trim()).filter(Boolean);
    if (times.length > 10 || !times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new AppError("b.times");
    out.default_times = [...new Set(times)].sort();
  }
  return out;
}

const SELECT = "SELECT brands.*, users.email AS owner_email FROM brands LEFT JOIN users ON users.id = brands.owner_id";

/** Brands visible to the actor: the superadmin sees all, everyone else only their own. */
export async function listBrands(env: Env, actor: Actor): Promise<Brand[]> {
  const q = isSuper(actor)
    ? env.DB.prepare(`${SELECT} ORDER BY (brands.owner_id = ?) DESC, brands.created_at`).bind(actor.id)
    : env.DB.prepare(`${SELECT} WHERE brands.owner_id = ? ORDER BY brands.created_at`).bind(actor.id);
  const { results } = await q.all<BrandRow>();
  return results.map(toBrand);
}

/** Loads a brand row. With an actor, the brand must belong to them (or they are the superadmin). */
export async function getBrandRow(env: Env, id: unknown, actor?: Actor): Promise<BrandRow> {
  if (typeof id !== "string" || !BRAND_ID_RE.test(id)) throw new AppError("b.required");
  const r = await env.DB.prepare(`${SELECT} WHERE brands.id = ?`).bind(id).first<BrandRow>();
  // Someone else's brand looks exactly like a missing one
  if (!r || (actor && !isSuper(actor) && r.owner_id !== actor.id)) throw new AppError("b.not_found", { id });
  return r;
}

export async function getBrand(env: Env, id: unknown, actor?: Actor): Promise<Brand> {
  return toBrand(await getBrandRow(env, id, actor));
}

export async function createBrand(env: Env, actor: Actor, input: Record<string, unknown>): Promise<Brand> {
  const b = validateBrandInput(env, input, true);
  if (!isSuper(actor)) {
    const max = Number(env.MAX_BRANDS_PER_USER || 3);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM brands WHERE owner_id = ?").bind(actor.id).first<{ n: number }>();
    if ((n?.n ?? 0) >= max) throw new AppError("b.limit_brands", { max });
  }
  const now = Date.now();
  const tz = b.timezone ?? (isValidTimezone(env.DEFAULT_TIMEZONE) ? env.DEFAULT_TIMEZONE : "UTC");
  try {
    await env.DB.prepare(
      `INSERT INTO brands (id, name, media_prefixes, max_posts_per_day, timezone, default_times, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(b.id, b.name, JSON.stringify(b.media_prefixes ?? []), b.max_posts_per_day ?? 3, tz, JSON.stringify(b.default_times ?? []), actor.id, now, now)
      .run();
  } catch (e) {
    if (/UNIQUE|PRIMARY/.test(String(e))) throw new AppError("b.exists");
    throw e;
  }
  return getBrand(env, b.id, actor);
}

export async function updateBrand(env: Env, actor: Actor, id: string, input: Record<string, unknown>): Promise<Brand> {
  await getBrandRow(env, id, actor);
  const b = validateBrandInput(env, input, false);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (b.name !== undefined) (sets.push("name = ?"), args.push(b.name));
  if (b.media_prefixes !== undefined) (sets.push("media_prefixes = ?"), args.push(JSON.stringify(b.media_prefixes)));
  if (b.max_posts_per_day !== undefined) (sets.push("max_posts_per_day = ?"), args.push(b.max_posts_per_day));
  if (b.timezone !== undefined) (sets.push("timezone = ?"), args.push(b.timezone));
  if (b.default_times !== undefined) (sets.push("default_times = ?"), args.push(JSON.stringify(b.default_times)));
  if (sets.length) {
    await env.DB.prepare(`UPDATE brands SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).bind(...args, Date.now(), id).run();
  }
  return getBrand(env, id, actor);
}

/**
 * Sets the brand's GitHub storage. The token is verified (it must be able to write to the repo)
 * and stored encrypted. Leaving the token empty keeps the current one when the repo is unchanged.
 */
export async function setBrandStorage(env: Env, actor: Actor, id: string, input: Record<string, unknown>): Promise<Brand> {
  const row = await getBrandRow(env, id, actor);
  const s = parseStorageInput(input);
  let tokenEnc = row.storage_token_enc;
  let token = s.token;
  if (!token) {
    if (!tokenEnc || row.storage_repo !== s.repo) throw new AppError("s.token_required");
    token = (await storageToken(env, row)) ?? undefined;
    if (!token) throw new AppError("s.token_required");
  } else {
    tokenEnc = await encryptStorageToken(env, id, token);
  }
  const v = await verifyStorage(s, token);
  await env.DB.prepare(
    "UPDATE brands SET storage_repo = ?, storage_branch = ?, storage_path = ?, storage_token_enc = ?, storage_private = ?, storage_inherited = 0, updated_at = ? WHERE id = ?",
  )
    .bind(s.repo, s.branch, s.path, tokenEnc, v.private ? 1 : 0, Date.now(), id)
    .run();
  return getBrand(env, id, actor);
}

export async function clearBrandStorage(env: Env, actor: Actor, id: string): Promise<Brand> {
  await getBrandRow(env, id, actor);
  await env.DB.prepare(
    "UPDATE brands SET storage_repo = NULL, storage_branch = NULL, storage_path = NULL, storage_token_enc = NULL, storage_private = 0, storage_inherited = 0, updated_at = ? WHERE id = ?",
  )
    .bind(Date.now(), id)
    .run();
  return getBrand(env, id, actor);
}

/** A brand can only be deleted while it has no posts; its connections are deleted with it. */
export async function deleteBrand(env: Env, actor: Actor, id: string): Promise<void> {
  await getBrandRow(env, id, actor);
  const pending = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM posts WHERE brand_id = ? AND status IN ('scheduled','publishing','processing')",
  )
    .bind(id)
    .first<{ n: number }>();
  if (pending && pending.n > 0) throw new AppError("b.pending");
  const any = await env.DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE brand_id = ?").bind(id).first<{ n: number }>();
  if (any && any.n > 0) throw new AppError("b.history");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM connections WHERE brand_id = ?").bind(id),
    env.DB.prepare("DELETE FROM brands WHERE id = ?").bind(id),
  ]);
}

/** The brand an MCP call is about: the given id, or the only brand the user has. */
export async function resolveBrandId(env: Env, actor: Actor, value: unknown): Promise<string> {
  if (typeof value === "string" && value) return value;
  const all = await listBrands(env, actor);
  if (all.length === 1) return all[0].id;
  throw new AppError("b.pick", { brands: all.map((b) => b.id).join(", ") || "-" });
}
