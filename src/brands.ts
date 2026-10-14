import type { Env } from "./env";
import { AppError } from "./i18n";
import { validatePrefix } from "./media";

export interface BrandRow {
  id: string;
  name: string;
  media_prefixes: string;
  max_posts_per_day: number;
  timezone: string;
  created_at: number;
  updated_at: number;
}

/** A brand owns its own platform accounts, video allowlist, daily limit and time zone. */
export interface Brand {
  id: string;
  name: string;
  media_prefixes: string[];
  max_posts_per_day: number;
  timezone: string;
}

export const BRAND_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export function toBrand(r: BrandRow): Brand {
  return {
    id: r.id,
    name: r.name,
    media_prefixes: JSON.parse(r.media_prefixes || "[]"),
    max_posts_per_day: r.max_posts_per_day,
    timezone: r.timezone,
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

export function validateBrandInput(env: Env, input: Record<string, unknown>, isNew: boolean): Partial<Brand> {
  const out: Partial<Brand> = {};
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
  return out;
}

export async function listBrands(env: Env): Promise<Brand[]> {
  const { results } = await env.DB.prepare("SELECT * FROM brands ORDER BY created_at").all<BrandRow>();
  return results.map(toBrand);
}

export async function getBrand(env: Env, id: unknown): Promise<Brand> {
  if (typeof id !== "string" || !BRAND_ID_RE.test(id)) throw new AppError("b.required");
  const r = await env.DB.prepare("SELECT * FROM brands WHERE id = ?").bind(id).first<BrandRow>();
  if (!r) throw new AppError("b.not_found", { id });
  return toBrand(r);
}

export async function createBrand(env: Env, input: Record<string, unknown>): Promise<Brand> {
  const b = validateBrandInput(env, input, true);
  const now = Date.now();
  const tz = b.timezone ?? (isValidTimezone(env.DEFAULT_TIMEZONE) ? env.DEFAULT_TIMEZONE : "UTC");
  try {
    await env.DB.prepare(
      "INSERT INTO brands (id, name, media_prefixes, max_posts_per_day, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(b.id, b.name, JSON.stringify(b.media_prefixes ?? []), b.max_posts_per_day ?? 3, tz, now, now)
      .run();
  } catch (e) {
    if (/UNIQUE|PRIMARY/.test(String(e))) throw new AppError("b.exists");
    throw e;
  }
  return getBrand(env, b.id);
}

export async function updateBrand(env: Env, id: string, input: Record<string, unknown>): Promise<Brand> {
  await getBrand(env, id);
  const b = validateBrandInput(env, input, false);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (b.name !== undefined) (sets.push("name = ?"), args.push(b.name));
  if (b.media_prefixes !== undefined) (sets.push("media_prefixes = ?"), args.push(JSON.stringify(b.media_prefixes)));
  if (b.max_posts_per_day !== undefined) (sets.push("max_posts_per_day = ?"), args.push(b.max_posts_per_day));
  if (b.timezone !== undefined) (sets.push("timezone = ?"), args.push(b.timezone));
  if (sets.length) {
    await env.DB.prepare(`UPDATE brands SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).bind(...args, Date.now(), id).run();
  }
  return getBrand(env, id);
}

/** A brand can only be deleted while it has no posts; its connections are deleted with it. */
export async function deleteBrand(env: Env, id: string): Promise<void> {
  await getBrand(env, id);
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
