import { isPlatform, type Env, type Platform } from "./env";
import { validateMediaUrl } from "./media";
import { randomToken } from "./crypto";
import { BRAND_ID_RE, getBrand, type Brand } from "./brands";
import { AppError, renderStored, type Lang } from "./i18n";

export type PostStatus = "scheduled" | "publishing" | "processing" | "published" | "error" | "cancelled";

export interface PostRow {
  id: string;
  brand_id: string;
  platform: Platform;
  media_url: string;
  title: string;
  caption: string;
  tags: string;
  options: string;
  publish_at: number;
  status: PostStatus;
  attempts: number;
  remote_ref: string | null;
  external_id: string | null;
  result_url: string | null;
  /** JSON message ({k,p}) — rendered in the reader's language. */
  error: string | null;
  source: string;
  locked_until: number;
  created_at: number;
  updated_at: number;
  tz?: string;
}

export interface PostView {
  id: string;
  brand: string;
  platform: Platform;
  media_url: string;
  title: string;
  caption: string;
  tags: string[];
  options: Record<string, unknown>;
  publish_at: string;
  publish_at_local: string;
  status: PostStatus;
  attempts: number;
  external_id: string | null;
  result_url: string | null;
  error: string | null;
  source: string;
  created_at: string;
}

export function fmtLocal(ms: number, tz: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function toView(r: PostRow, lang: Lang): PostView {
  const tz = r.tz || "UTC";
  return {
    id: r.id,
    brand: r.brand_id,
    platform: r.platform,
    media_url: r.media_url,
    title: r.title,
    caption: r.caption,
    tags: JSON.parse(r.tags || "[]"),
    options: JSON.parse(r.options || "{}"),
    publish_at: new Date(r.publish_at).toISOString(),
    publish_at_local: fmtLocal(r.publish_at, tz, lang),
    status: r.status,
    attempts: r.attempts,
    external_id: r.external_id,
    result_url: r.result_url,
    error: renderStored(r.error, lang),
    source: r.source,
    created_at: new Date(r.created_at).toISOString(),
  };
}

export interface NewPostInput {
  platform: unknown;
  media_url: unknown;
  title?: unknown;
  caption?: unknown;
  tags?: unknown;
  publish_at: unknown;
  options?: unknown;
}

const ALLOWED_OPTIONS: Record<Platform, Record<string, "boolean" | "string">> = {
  youtube: { privacy: "string", category: "string", madeForKids: "boolean", notifySubscribers: "boolean" },
  instagram: { shareToFeed: "boolean" },
  tiktok: { privacy: "string", disableComment: "boolean", disableDuet: "boolean", disableStitch: "boolean" },
};

const ENUMS: Record<string, string[]> = {
  "youtube.privacy": ["public", "unlisted", "private"],
  "youtube.category": ["EDUCATION", "PEOPLE_BLOGS", "ENTERTAINMENT", "NONPROFITS_ACTIVISM", "FILM_ANIMATION", "HOWTO_STYLE"],
  "tiktok.privacy": ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"],
};

function str(v: unknown, field: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new AppError("v.required", { field });
    return "";
  }
  if (typeof v !== "string") throw new AppError("v.string", { field });
  // Strip control characters (keep newline and tab)
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !s) throw new AppError("v.required", { field });
  if (s.length > max) throw new AppError("v.max_len", { field, max });
  return s;
}

export function parseWhen(v: unknown): number {
  if (typeof v !== "string" && typeof v !== "number") throw new AppError("v.when_required");
  if (typeof v === "string" && !/(Z|[+-]\d{2}:\d{2})$/.test(v.trim())) throw new AppError("v.when_tz");
  const t = typeof v === "number" ? v : Date.parse(v);
  if (!Number.isFinite(t)) throw new AppError("v.when_invalid");
  return t;
}

export function validateNewPost(
  input: NewPostInput,
  brand: Pick<Brand, "media_prefixes">,
  env: Pick<Env, "MEDIA_ALLOWED_HOSTS">,
  now = Date.now(),
) {
  if (!isPlatform(input.platform)) throw new AppError("v.platform");
  const platform = input.platform;
  const media_url = validateMediaUrl(str(input.media_url, "media_url", 500, true), brand.media_prefixes, env.MEDIA_ALLOWED_HOSTS);
  const title = str(input.title, "title", platform === "youtube" ? 100 : 150, platform !== "instagram");
  if (platform === "youtube" && /[<>]/.test(title)) throw new AppError("v.yt_title_chars");
  const caption = str(input.caption, "caption", 2200);
  let tags: string[] = [];
  if (input.tags !== undefined && input.tags !== null) {
    if (!Array.isArray(input.tags) || input.tags.length > 30) throw new AppError("v.tags_list");
    tags = input.tags.map((t, i) => str(t, `tags[${i}]`, 50, true));
    if (tags.join(",").length > 450) throw new AppError("v.tags_total");
  }
  const publish_at = parseWhen(input.publish_at);
  if (publish_at < now + 60_000) throw new AppError("v.when_past");
  if (publish_at > now + 60 * 24 * 3600_000) throw new AppError("v.when_far");

  const options: Record<string, unknown> = {};
  if (input.options !== undefined && input.options !== null) {
    if (typeof input.options !== "object" || Array.isArray(input.options)) throw new AppError("v.options_object");
    for (const [k, v] of Object.entries(input.options as Record<string, unknown>)) {
      const type = ALLOWED_OPTIONS[platform][k];
      if (!type) throw new AppError("v.option_unknown", { platform, key: k });
      if (typeof v !== type) throw new AppError(type === "boolean" ? "v.option_bool" : "v.option_text", { key: k });
      const en = ENUMS[`${platform}.${k}`];
      if (en && !en.includes(v as string)) throw new AppError("v.option_enum", { key: k, values: en.join(", ") });
      options[k] = v;
    }
  }
  return { platform, media_url, title, caption, tags, publish_at, options };
}

export async function countPostsOnLocalDay(env: Env, brand: Brand, platform: Platform, publishAt: number): Promise<number> {
  const day = localDate(publishAt, brand.timezone);
  const { results } = await env.DB.prepare(
    "SELECT publish_at FROM posts WHERE brand_id = ? AND platform = ? AND status != 'cancelled' AND publish_at BETWEEN ? AND ?",
  )
    .bind(brand.id, platform, publishAt - 36 * 3600_000, publishAt + 36 * 3600_000)
    .all<{ publish_at: number }>();
  return results.filter((r) => localDate(r.publish_at, brand.timezone) === day).length;
}

export async function createPost(env: Env, brandId: unknown, input: NewPostInput, source: "ui" | "mcp", lang: Lang): Promise<PostView> {
  const brand = await getBrand(env, brandId);
  const p = validateNewPost(input, brand, env);
  if ((await countPostsOnLocalDay(env, brand, p.platform, p.publish_at)) >= brand.max_posts_per_day) {
    throw new AppError("post.daily_limit", { brand: brand.name, platform: p.platform, max: brand.max_posts_per_day });
  }
  const now = Date.now();
  const id = `p_${randomToken(9)}`;
  try {
    await env.DB.prepare(
      `INSERT INTO posts (id, brand_id, platform, media_url, title, caption, tags, options, publish_at, status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`,
    )
      .bind(id, brand.id, p.platform, p.media_url, p.title, p.caption, JSON.stringify(p.tags), JSON.stringify(p.options), p.publish_at, source, now, now)
      .run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new AppError("post.duplicate");
    throw e;
  }
  await audit(env, source, "post.create", `${id} ${brand.id}/${p.platform} ${p.media_url} @${new Date(p.publish_at).toISOString()}`);
  return toView((await getPostRow(env, id))!, lang);
}

const SELECT_POST = "SELECT posts.*, brands.timezone AS tz FROM posts JOIN brands ON brands.id = posts.brand_id";

export async function getPostRow(env: Env, id: string): Promise<PostRow | null> {
  if (!/^p_[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return env.DB.prepare(`${SELECT_POST} WHERE posts.id = ?`).bind(id).first<PostRow>();
}

export interface ListFilter {
  brand?: string;
  status?: string;
  platform?: string;
  from?: number;
  to?: number;
  limit?: number;
}

const STATUSES: PostStatus[] = ["scheduled", "publishing", "processing", "published", "error", "cancelled"];

export async function listPosts(env: Env, f: ListFilter, lang: Lang): Promise<PostView[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.brand) {
    if (!BRAND_ID_RE.test(f.brand)) throw new AppError("b.required");
    where.push("posts.brand_id = ?");
    args.push(f.brand);
  }
  if (f.status) {
    if (!STATUSES.includes(f.status as PostStatus)) throw new AppError("err.bad_body");
    where.push("posts.status = ?");
    args.push(f.status);
  }
  if (f.platform) {
    if (!isPlatform(f.platform)) throw new AppError("v.platform");
    where.push("posts.platform = ?");
    args.push(f.platform);
  }
  if (f.from !== undefined) {
    where.push("posts.publish_at >= ?");
    args.push(f.from);
  }
  if (f.to !== undefined) {
    where.push("posts.publish_at <= ?");
    args.push(f.to);
  }
  const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 200);
  const sql = `${SELECT_POST} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY posts.publish_at DESC LIMIT ${limit}`;
  const { results } = await env.DB.prepare(sql).bind(...args).all<PostRow>();
  return results.map((r) => toView(r, lang));
}

export async function cancelPost(env: Env, id: string, actor: string, lang: Lang): Promise<PostView> {
  const r = await env.DB.prepare(
    "UPDATE posts SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('scheduled','error') RETURNING id",
  )
    .bind(Date.now(), id)
    .first<{ id: string }>();
  if (!r) throw new AppError("post.cannot_cancel");
  await audit(env, actor, "post.cancel", id);
  return toView((await getPostRow(env, id))!, lang);
}

export async function retryPost(env: Env, id: string, actor: string, lang: Lang, newWhen?: number): Promise<PostView> {
  const when = newWhen ?? Date.now() + 60_000;
  const r = await env.DB.prepare(
    `UPDATE posts SET status = 'scheduled', error = NULL, remote_ref = NULL, attempts = 0, publish_at = ?, locked_until = 0, updated_at = ?
     WHERE id = ? AND status = 'error' RETURNING id`,
  )
    .bind(when, Date.now(), id)
    .first<{ id: string }>();
  if (!r) throw new AppError("post.cannot_retry");
  await audit(env, actor, "post.retry", id);
  return toView((await getPostRow(env, id))!, lang);
}

export async function updatePost(env: Env, id: string, fields: Partial<PostRow>): Promise<void> {
  const keys = Object.keys(fields).filter((k) =>
    ["status", "attempts", "remote_ref", "external_id", "result_url", "error", "locked_until"].includes(k),
  );
  if (!keys.length) return;
  const sql = `UPDATE posts SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
  await env.DB.prepare(sql)
    .bind(...keys.map((k) => (fields as Record<string, unknown>)[k] ?? null), Date.now(), id)
    .run();
}

// ---------------- Scheduler locks ----------------
// Every post is locked with a conditional UPDATE right before it is processed, so two overlapping
// cron runs can never upload the same post twice.

/** Longer than the maximum duration of a cron run (15 min). */
export const PUBLISH_LOCK_MS = 20 * 60_000;
export const POLL_LOCK_MS = 5 * 60_000;

export async function dueCandidates(env: Env, now = Date.now()): Promise<{ id: string; status: PostStatus }[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, status FROM posts
     WHERE ((status = 'scheduled' AND publish_at <= ?) OR status IN ('processing','publishing')) AND locked_until < ?
     ORDER BY publish_at LIMIT 10`,
  )
    .bind(now, now)
    .all<{ id: string; status: PostStatus }>();
  return results;
}

/** scheduled → publishing (increments attempts). Returns null if another run took it. */
export async function lockForPublish(env: Env, id: string, now = Date.now()): Promise<PostRow | null> {
  const r = await env.DB.prepare(
    `UPDATE posts SET status = 'publishing', attempts = attempts + 1, locked_until = ?, updated_at = ?
     WHERE id = ? AND status = 'scheduled' AND publish_at <= ? AND locked_until < ? RETURNING id`,
  )
    .bind(now + PUBLISH_LOCK_MS, now, id, now, now)
    .first<{ id: string }>();
  return r ? getPostRow(env, id) : null;
}

/** Locks a processing post for a status check. */
export async function lockForPoll(env: Env, id: string, now = Date.now()): Promise<PostRow | null> {
  const r = await env.DB.prepare(
    "UPDATE posts SET locked_until = ?, updated_at = ? WHERE id = ? AND status = 'processing' AND locked_until < ? RETURNING id",
  )
    .bind(now + POLL_LOCK_MS, now, id, now)
    .first<{ id: string }>();
  return r ? getPostRow(env, id) : null;
}

/** A publishing post whose lock expired: the previous run died mid-upload. Never auto-retried. */
export async function markInterrupted(env: Env, id: string, now = Date.now()): Promise<boolean> {
  const r = await env.DB.prepare(
    `UPDATE posts SET status = 'error', locked_until = 0, updated_at = ?, error = ?
     WHERE id = ? AND status = 'publishing' AND locked_until < ? RETURNING id`,
  )
    .bind(now, JSON.stringify({ k: "post.interrupted" }), id, now)
    .first<{ id: string }>();
  return Boolean(r);
}

export async function audit(env: Env, actor: string, action: string, detail = ""): Promise<void> {
  await env.DB.prepare("INSERT INTO audit_log (ts, actor, action, detail) VALUES (?, ?, ?, ?)")
    .bind(Date.now(), actor, action, detail.slice(0, 1000))
    .run();
}

export async function recentAudit(env: Env, lang: Lang, limit = 50) {
  const { results } = await env.DB.prepare("SELECT ts, actor, action, detail FROM audit_log ORDER BY id DESC LIMIT ?")
    .bind(Math.min(limit, 200))
    .all<{ ts: number; actor: string; action: string; detail: string }>();
  const tz = env.DEFAULT_TIMEZONE || "UTC";
  return results.map((r) => ({ ...r, time: fmtLocal(r.ts, tz, lang) }));
}
