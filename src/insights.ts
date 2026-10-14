import { PLATFORMS, type Actor, type Env, type Platform } from "./env";
import { getBrand, type Brand } from "./brands";
import { AppError, type Lang } from "./i18n";
import { zonedToUtc } from "./http";
import { localDate, toView, type PostRow, type PostView } from "./db";

/** Calendar, auto-scheduling and publishing analytics. Everything is scoped through getBrand (owner or superadmin). */

const DAY = 86400_000;
const FALLBACK_TIMES = ["12:00"];
/** Earliest an auto-chosen slot may be (the scheduler runs every 5 minutes). */
const MIN_LEAD_MS = 10 * 60_000;
/** createPost rejects times further away than 60 days. */
const HORIZON_DAYS = 59;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const zoned = (date: string, time: string, tz: string) => zonedToUtc(`${date}T${time}`, tz);

function localTime(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
}

function localHour(ms: number, tz: string): number {
  return Number(localTime(ms, tz).slice(0, 2));
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

interface Row extends PostRow {
  tz: string;
}

async function rowsBetween(env: Env, brandId: string, from: number, to: number, limit: number): Promise<Row[]> {
  const { results } = await env.DB.prepare(
    `SELECT posts.*, brands.timezone AS tz FROM posts JOIN brands ON brands.id = posts.brand_id
     WHERE posts.brand_id = ? AND posts.publish_at BETWEEN ? AND ? ORDER BY posts.publish_at ASC LIMIT ?`,
  )
    .bind(brandId, from, to, limit)
    .all<Row>();
  return results;
}

// ---------------------------------------------------------------- calendar

export interface CalendarDay {
  date: string;
  posts: PostView[];
  /** Active (non-cancelled) posts per platform on this day. */
  counts: Record<Platform, number>;
  /** Slots left per platform before the brand's daily limit. */
  free: Record<Platform, number>;
}

export async function calendar(env: Env, actor: Actor, brandId: string, month: string | undefined, lang: Lang) {
  const brand = await getBrand(env, brandId, actor);
  const now = Date.now();
  const m = month || localDate(now, brand.timezone).slice(0, 7);
  if (!MONTH_RE.test(m)) throw new AppError("v.month");
  const first = `${m}-01`;
  const [y, mo] = m.split("-").map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const last = `${m}-${String(dim).padStart(2, "0")}`;
  // Pad by a day each side so zone offsets never cut a local day in half
  const rows = await rowsBetween(env, brand.id, zoned(addDays(first, -1), "00:00", brand.timezone), zoned(addDays(last, 2), "00:00", brand.timezone), 2000);

  const days: CalendarDay[] = [];
  for (let d = 1; d <= dim; d++) {
    const date = `${m}-${String(d).padStart(2, "0")}`;
    days.push({ date, posts: [], counts: zeroPlatforms(), free: zeroPlatforms() });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const r of rows) {
    const day = byDate.get(localDate(r.publish_at, brand.timezone));
    if (!day) continue;
    day.posts.push(toView(r, lang));
    if (r.status !== "cancelled") day.counts[r.platform]++;
  }
  for (const day of days) for (const p of PLATFORMS) day.free[p] = Math.max(0, brand.max_posts_per_day - day.counts[p]);
  return {
    brand: brand.id,
    month: m,
    timezone: brand.timezone,
    today: localDate(now, brand.timezone),
    max_posts_per_day: brand.max_posts_per_day,
    default_times: brand.default_times,
    days,
  };
}

// ---------------------------------------------------------------- auto-scheduling

export interface Slot {
  publish_at: string;
  local: string;
}

/**
 * Next free calendar slots for a brand: its default posting times (or 12:00), skipping days where any of the
 * given platforms already hit the daily limit and times already taken on those platforms.
 */
export async function nextSlots(env: Env, brand: Brand, platforms: readonly Platform[], count: number, after = Date.now()): Promise<Slot[]> {
  const tz = brand.timezone;
  const times = brand.default_times.length ? brand.default_times : FALLBACK_TIMES;
  const start = Math.max(after, Date.now()) + MIN_LEAD_MS;
  const rows = await rowsBetween(env, brand.id, start - DAY, start + (HORIZON_DAYS + 2) * DAY, 3000);
  const perDay = new Map<string, number>();
  const taken = new Set<string>();
  for (const r of rows) {
    if (r.status === "cancelled" || !platforms.includes(r.platform)) continue;
    const date = localDate(r.publish_at, tz);
    perDay.set(`${r.platform}|${date}`, (perDay.get(`${r.platform}|${date}`) ?? 0) + 1);
    taken.add(`${r.platform}|${date}|${localTime(r.publish_at, tz)}`);
  }
  const out: Slot[] = [];
  const startDate = localDate(start, tz);
  for (let i = 0; i <= HORIZON_DAYS && out.length < count; i++) {
    const date = addDays(startDate, i);
    if (platforms.some((p) => (perDay.get(`${p}|${date}`) ?? 0) >= brand.max_posts_per_day)) continue;
    for (const t of times) {
      if (out.length >= count) break;
      const at = zoned(date, t, tz);
      if (at < start || at > Date.now() + HORIZON_DAYS * DAY) continue;
      if (platforms.some((p) => taken.has(`${p}|${date}|${t}`))) continue;
      // Reserve it so the next slot for this batch lands elsewhere
      for (const p of platforms) {
        perDay.set(`${p}|${date}`, (perDay.get(`${p}|${date}`) ?? 0) + 1);
        taken.add(`${p}|${date}|${t}`);
      }
      out.push({ publish_at: new Date(at).toISOString(), local: `${date} ${t}` });
      if (platforms.some((p) => (perDay.get(`${p}|${date}`) ?? 0) >= brand.max_posts_per_day)) break;
    }
  }
  return out;
}

export async function suggestSlots(env: Env, actor: Actor, brandId: string, platforms: readonly Platform[] | undefined, count: number) {
  const brand = await getBrand(env, brandId, actor);
  const list = platforms?.length ? platforms : PLATFORMS;
  const n = Math.min(Math.max(Math.trunc(count) || 5, 1), 20);
  return { brand: brand.id, timezone: brand.timezone, platforms: list, slots: await nextSlots(env, brand, list, n) };
}

// ---------------------------------------------------------------- analytics

function zeroPlatforms(): Record<Platform, number> {
  return Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
}

export const ANALYTICS_RANGES = [7, 30, 90] as const;

export async function analytics(env: Env, actor: Actor, brandId: string, daysArg: unknown, lang: Lang) {
  const brand = await getBrand(env, brandId, actor);
  const tz = brand.timezone;
  const days = (ANALYTICS_RANGES as readonly number[]).includes(Number(daysArg)) ? Number(daysArg) : 30;
  const now = Date.now();
  const since = now - days * DAY;
  const rows = await rowsBetween(env, brand.id, since, now + HORIZON_DAYS * DAY, 5000);
  const past = rows.filter((r) => r.publish_at <= now);

  const status: Record<string, number> = { scheduled: 0, publishing: 0, processing: 0, published: 0, error: 0, cancelled: 0 };
  const byPlatform: Record<string, { published: number; error: number; scheduled: number }> = Object.fromEntries(PLATFORMS.map((p) => [p, { published: 0, error: 0, scheduled: 0 }]));
  const bySource = { ui: 0, mcp: 0 } as Record<string, number>;
  const byHour = Array.from({ length: 24 }, () => 0);
  const perDay = new Map<string, { published: number; error: number }>();
  const publishedDays = new Set<string>();
  const errorCounts = new Map<string, { view: PostView; n: number }>();

  for (const r of rows) {
    status[r.status] = (status[r.status] ?? 0) + 1;
    if (r.status === "scheduled") byPlatform[r.platform].scheduled++;
  }
  for (const r of past) {
    const date = localDate(r.publish_at, tz);
    if (r.status === "published") {
      byPlatform[r.platform].published++;
      byHour[localHour(r.publish_at, tz)]++;
      bySource[r.source === "mcp" ? "mcp" : "ui"]++;
      publishedDays.add(date);
      const d = perDay.get(date) ?? { published: 0, error: 0 };
      d.published++;
      perDay.set(date, d);
    } else if (r.status === "error") {
      byPlatform[r.platform].error++;
      const d = perDay.get(date) ?? { published: 0, error: 0 };
      d.error++;
      perDay.set(date, d);
      const view = toView(r, lang);
      const key = `${r.platform}|${view.error ?? ""}`;
      const prev = errorCounts.get(key);
      if (prev) prev.n++;
      else errorCounts.set(key, { view, n: 1 });
    }
  }

  // One entry per local day in the range, including empty days, so the chart has no gaps
  const today = localDate(now, tz);
  const series: { date: string; published: number; error: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    series.push({ date, ...(perDay.get(date) ?? { published: 0, error: 0 }) });
  }

  // Streak of consecutive local days with at least one published post (today may still be pending)
  let streak = 0;
  for (let i = publishedDays.has(today) ? 0 : 1; i < 400; i++) {
    if (!publishedDays.has(addDays(today, -i))) break;
    streak++;
  }
  const published = status.published;
  const failed = status.error;
  const activeDays = publishedDays.size;
  return {
    brand: brand.id,
    timezone: tz,
    days,
    totals: {
      published,
      failed,
      cancelled: status.cancelled,
      upcoming: status.scheduled,
      in_progress: status.publishing + status.processing,
      success_rate: published + failed ? Math.round((published / (published + failed)) * 1000) / 10 : null,
      avg_per_active_day: activeDays ? Math.round((published / activeDays) * 10) / 10 : 0,
      streak_days: streak,
    },
    by_platform: byPlatform,
    by_source: bySource,
    by_hour: byHour,
    series,
    top_errors: [...errorCounts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map(({ view, n }) => ({ platform: view.platform, message: view.error, count: n, last_post: view.id })),
  };
}
