import { PLATFORMS, type Actor, type Env } from "./env";
import { getBrand } from "./brands";
import { getState, listPosts, localDate } from "./db";
import { ADAPTERS } from "./connections";
import type { Lang } from "./i18n";

/** Everything the overview screen needs in one request. */
export async function overview(env: Env, actor: Actor, brandId: string, lang: Lang) {
  const brand = await getBrand(env, brandId, actor);
  const now = Date.now();
  const today = localDate(now, brand.timezone);

  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'scheduled' AND publish_at >= ? THEN 1 ELSE 0 END) AS upcoming,
       SUM(CASE WHEN status IN ('publishing','processing') THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status = 'published' AND publish_at >= ? THEN 1 ELSE 0 END) AS published_7d,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
     FROM posts WHERE brand_id = ?`,
  )
    .bind(now, now - 7 * 86400_000, brand.id)
    .first<{ upcoming: number; in_progress: number; published_7d: number; errors: number }>();

  const window = await listPosts(env, actor, { brand: brand.id, from: now - 36 * 3600_000, to: now + 36 * 3600_000, limit: 200 }, lang);
  const todayPosts = window.filter((p) => p.status !== "cancelled" && localDate(Date.parse(p.publish_at), brand.timezone) === today);
  const upcoming = (await listPosts(env, actor, { brand: brand.id, status: "scheduled", from: now, limit: 200 }, lang))
    .sort((a, b) => a.publish_at.localeCompare(b.publish_at))
    .slice(0, 6);
  const errors = await listPosts(env, actor, { brand: brand.id, status: "error", limit: 5 }, lang);

  const { results: conns } = await env.DB.prepare("SELECT platform FROM connections WHERE brand_id = ?").bind(brand.id).all<{ platform: string }>();
  const mcp = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'mcp.authorize' AND actor = ?").bind(`ui:${actor.email}`).first<{ n: number }>();
  const lastRun = Number((await getState(env, "cron.last_run")) || 0);

  return {
    brand,
    counts: {
      today: todayPosts.length,
      upcoming: counts?.upcoming ?? 0,
      in_progress: counts?.in_progress ?? 0,
      published_7d: counts?.published_7d ?? 0,
      errors: counts?.errors ?? 0,
    },
    upcoming,
    errors,
    scheduler: { last_run: lastRun ? new Date(lastRun).toISOString() : null, healthy: lastRun > now - 15 * 60_000 },
    checklist: {
      allowlist: brand.allowed_prefixes.length > 0,
      storage: Boolean(brand.storage?.has_token),
      platforms: PLATFORMS.map((p) => ({ platform: p, configured: ADAPTERS[p].configured(env), connected: conns.some((c) => c.platform === p) })),
      mcp_connected: (mcp?.n ?? 0) > 0,
    },
    tiktok_unaudited: env.TIKTOK_UNAUDITED !== "false",
  };
}
