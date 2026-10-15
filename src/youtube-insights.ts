import type { Actor, Env } from "./env";
import { getBrand } from "./brands";
import { getAccount } from "./connections";
import { AppError } from "./i18n";
import { CATEGORY_IDS } from "./platforms/youtube";
import { yt } from "./youtube-stats";

/**
 * Deep YouTube data for a brand's channel: its latest uploads with all details (title, description, tags, duration,
 * views, likes, comments), patterns derived from them and, when permitted, YouTube Analytics (watch time, traffic, countries).
 */

const CATEGORY_NAMES = Object.fromEntries(Object.entries(CATEGORY_IDS).map(([name, id]) => [id, name]));
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/";
const MAX_VIDEOS = 50;
const DAY = 86400_000;

interface RawVideo {
  id: string;
  snippet?: { title?: string; description?: string; tags?: string[]; categoryId?: string; publishedAt?: string; defaultLanguage?: string; defaultAudioLanguage?: string; thumbnails?: Record<string, { url: string }> };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
  status?: { privacyStatus?: string; madeForKids?: boolean };
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  category: string | null;
  published_at: string;
  age_days: number;
  duration_seconds: number;
  is_short: boolean;
  privacy: string;
  language: string | null;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  views_per_day: number;
  /** Published through Kervly (post id) */
  kervly_post: string | null;
}

const n = (v: string | undefined) => (v === undefined ? 0 : Number(v) || 0);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** ISO 8601 duration (PT1M30S) → seconds. */
export function isoSeconds(d: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? "");
  return m ? Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) : 0;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function channelAndUploads(token: string, limit: number) {
  const ch = (await yt<{ items?: { id: string; snippet?: { title?: string; customUrl?: string; publishedAt?: string; country?: string }; statistics?: Record<string, string | boolean>; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>(
    token,
    "channels?part=snippet,statistics,contentDetails&mine=true",
  )).items?.[0];
  if (!ch) throw new AppError("yt.no_channel");
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  let ids: string[] = [];
  if (uploads) {
    const pl = await yt<{ items?: { contentDetails?: { videoId?: string } }[] }>(token, `playlistItems?part=contentDetails&maxResults=${Math.min(limit, MAX_VIDEOS)}&playlistId=${encodeURIComponent(uploads)}`);
    ids = (pl.items ?? []).map((i) => i.contentDetails?.videoId).filter((x): x is string => Boolean(x));
  }
  const raw: RawVideo[] = ids.length
    ? (await yt<{ items?: RawVideo[] }>(token, `videos?part=snippet,statistics,contentDetails,status&id=${encodeURIComponent(ids.join(","))}`)).items ?? []
    : [];
  // keep the playlist order (newest first)
  const order = new Map(ids.map((id, i) => [id, i]));
  raw.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { ch, raw };
}

function toVideo(v: RawVideo, kervly: Map<string, string>, now: number): VideoInfo {
  const sn = v.snippet ?? {};
  const views = n(v.statistics?.viewCount);
  const likes = n(v.statistics?.likeCount);
  const comments = n(v.statistics?.commentCount);
  const published = sn.publishedAt ? Date.parse(sn.publishedAt) : now;
  const age = Math.max(1, (now - published) / DAY);
  const duration = isoSeconds(v.contentDetails?.duration);
  const text = `${sn.title ?? ""} ${sn.description ?? ""}`;
  return {
    id: v.id,
    url: duration && duration <= 180 ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    title: sn.title ?? "",
    description: sn.description ?? "",
    tags: sn.tags ?? [],
    hashtags: [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.toLowerCase()))],
    category: sn.categoryId ? CATEGORY_NAMES[sn.categoryId] ?? sn.categoryId : null,
    published_at: new Date(published).toISOString(),
    age_days: Math.floor(age),
    duration_seconds: duration,
    is_short: duration > 0 && duration <= 180,
    privacy: v.status?.privacyStatus ?? "public",
    language: sn.defaultAudioLanguage ?? sn.defaultLanguage ?? null,
    thumbnail: sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
    views,
    likes,
    comments,
    engagement_rate: views ? r1(((likes + comments) / views) * 100) : 0,
    views_per_day: r1(views / age),
    kervly_post: kervly.get(v.id) ?? null,
  };
}

async function kervlyPosts(env: Env, brandId: string): Promise<Map<string, string>> {
  const { results } = await env.DB.prepare("SELECT id, external_id FROM posts WHERE brand_id = ? AND platform = 'youtube' AND external_id IS NOT NULL").bind(brandId).all<{ id: string; external_id: string }>();
  return new Map(results.map((r) => [r.external_id, r.id]));
}

export type VideoSort = "recent" | "views" | "likes" | "comments" | "engagement";

/** Latest uploads of the channel with full details. */
export async function youtubeVideos(env: Env, actor: Actor, brandId: string, opts: { limit?: number; sort?: string; descriptionMax?: number } = {}) {
  const brand = await getBrand(env, brandId, actor);
  const acc = await getAccount(env, brand.id, "youtube");
  needsScope(acc.tokens.scope, "youtube.readonly");
  const limit = Math.min(Math.max(Math.trunc(Number(opts.limit)) || 20, 1), MAX_VIDEOS);
  const { raw } = await channelAndUploads(acc.tokens.access_token, limit);
  const now = Date.now();
  const kervly = await kervlyPosts(env, brand.id);
  let videos = raw.map((v) => toVideo(v, kervly, now));
  const key = ({ views: "views", likes: "likes", comments: "comments", engagement: "engagement_rate" } as Record<string, keyof VideoInfo>)[String(opts.sort)];
  if (key) videos = videos.sort((a, b) => (b[key] as number) - (a[key] as number));
  if (opts.descriptionMax) videos = videos.map((v) => ({ ...v, description: v.description.slice(0, opts.descriptionMax) }));
  return { brand: brand.id, fetched_at: new Date(now).toISOString(), count: videos.length, videos };
}

function needsScope(scope: string | undefined, needed: string) {
  if (scope && !scope.includes(needed)) throw new AppError("yt.stats_scope");
}

// ---------------------------------------------------------------- patterns

interface Bucket {
  label: string;
  videos: number;
  avg_views: number;
}

function buckets(videos: VideoInfo[], edges: [string, (v: VideoInfo) => boolean][]): Bucket[] {
  return edges
    .map(([label, test]) => {
      const sel = videos.filter(test);
      return { label, videos: sel.length, avg_views: Math.round(avg(sel.map((v) => v.views))) };
    })
    .filter((b) => b.videos > 0);
}

function patterns(videos: VideoInfo[], tz: string) {
  const parts = (iso: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return { weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday), hour: Number(p.hour) };
  };
  const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, videos: 0, avg_views: 0 }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, videos: 0, avg_views: 0 }));
  const acc = { w: byWeekday.map(() => 0), h: byHour.map(() => 0) };
  for (const v of videos) {
    const { weekday, hour } = parts(v.published_at);
    byWeekday[weekday].videos++;
    byHour[hour].videos++;
    acc.w[weekday] += v.views;
    acc.h[hour] += v.views;
  }
  byWeekday.forEach((d, i) => (d.avg_views = d.videos ? Math.round(acc.w[i] / d.videos) : 0));
  byHour.forEach((d, i) => (d.avg_views = d.videos ? Math.round(acc.h[i] / d.videos) : 0));

  const tagMap = new Map<string, { videos: number; views: number }>();
  const hashMap = new Map<string, { videos: number; views: number }>();
  for (const v of videos) {
    for (const t of new Set(v.tags.map((x) => x.toLowerCase().trim()).filter(Boolean))) {
      const e = tagMap.get(t) ?? { videos: 0, views: 0 };
      e.videos++;
      e.views += v.views;
      tagMap.set(t, e);
    }
    for (const t of v.hashtags) {
      const e = hashMap.get(t) ?? { videos: 0, views: 0 };
      e.videos++;
      e.views += v.views;
      hashMap.set(t, e);
    }
  }
  const top = (m: Map<string, { videos: number; views: number }>) =>
    [...m.entries()]
      .map(([tag, e]) => ({ tag, videos: e.videos, avg_views: Math.round(e.views / e.videos) }))
      .sort((a, b) => b.videos - a.videos || b.avg_views - a.avg_views)
      .slice(0, 15);

  return {
    by_weekday: byWeekday,
    by_hour: byHour,
    top_tags: top(tagMap),
    top_hashtags: top(hashMap),
    by_duration: buckets(videos, [
      ["≤15 s", (v) => v.duration_seconds <= 15],
      ["16–30 s", (v) => v.duration_seconds > 15 && v.duration_seconds <= 30],
      ["31–45 s", (v) => v.duration_seconds > 30 && v.duration_seconds <= 45],
      ["46–60 s", (v) => v.duration_seconds > 45 && v.duration_seconds <= 60],
      ["1–3 min", (v) => v.duration_seconds > 60 && v.duration_seconds <= 180],
      [">3 min", (v) => v.duration_seconds > 180],
    ]),
    by_title_length: buckets(videos, [
      ["≤30", (v) => v.title.length <= 30],
      ["31–50", (v) => v.title.length > 30 && v.title.length <= 50],
      ["51–70", (v) => v.title.length > 50 && v.title.length <= 70],
      [">70", (v) => v.title.length > 70],
    ]),
    by_category: Object.entries(
      videos.reduce<Record<string, { videos: number; views: number }>>((a, v) => {
        const k = v.category ?? "?";
        (a[k] ??= { videos: 0, views: 0 }).videos++;
        a[k].views += v.views;
        return a;
      }, {}),
    ).map(([category, e]) => ({ category, videos: e.videos, avg_views: Math.round(e.views / e.videos) })),
  };
}

// ---------------------------------------------------------------- analytics api

type Rows = (string | number)[][];

async function report(token: string, q: Record<string, string>): Promise<{ columnHeaders: { name: string }[]; rows?: Rows }> {
  const r = await fetch(`${ANALYTICS_BASE}reports?${new URLSearchParams({ ids: "channel==MINE", ...q })}`, { headers: { Authorization: `Bearer ${token}` } });
  // The error text is only used to tell "API not enabled" from "no permission"; it is never shown
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 400)}`);
  return (await r.json()) as { columnHeaders: { name: string }[]; rows?: Rows };
}

async function analyticsData(token: string, scope: string | undefined, days: number, videoTitles: Map<string, string>) {
  if (scope && !scope.includes("yt-analytics.readonly")) return { available: false as const, reason: "scope" as const };
  const end = new Date(Date.now() - DAY).toISOString().slice(0, 10); // today's numbers are not final yet
  const start = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const common = { startDate: start, endDate: end };
  try {
    const [daily, traffic, countries, perVideo] = await Promise.all([
      report(token, { ...common, dimensions: "day", sort: "day", metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares" }),
      report(token, { ...common, dimensions: "insightTrafficSourceType", sort: "-views", metrics: "views,estimatedMinutesWatched" }),
      report(token, { ...common, dimensions: "country", sort: "-views", maxResults: "8", metrics: "views" }),
      report(token, { ...common, dimensions: "video", sort: "-views", maxResults: "10", metrics: "views,averageViewDuration,averageViewPercentage" }),
    ]);
    const series = (daily.rows ?? []).map((r) => ({ date: String(r[0]), views: Number(r[1]), minutes: Number(r[2]), subs_gained: Number(r[3]), subs_lost: Number(r[4]), likes: Number(r[5]), comments: Number(r[6]), shares: Number(r[7]) }));
    const sum = (k: "views" | "minutes" | "subs_gained" | "subs_lost" | "likes" | "comments" | "shares") => series.reduce((a, s) => a + s[k], 0);
    return {
      available: true as const,
      from: start,
      to: end,
      totals: { views: sum("views"), watch_minutes: sum("minutes"), subscribers_gained: sum("subs_gained"), subscribers_lost: sum("subs_lost"), likes: sum("likes"), comments: sum("comments"), shares: sum("shares"), avg_view_seconds: sum("views") ? Math.round((sum("minutes") * 60) / sum("views")) : 0 },
      series,
      traffic_sources: (traffic.rows ?? []).map((r) => ({ source: String(r[0]), views: Number(r[1]), watch_minutes: Number(r[2]) })),
      countries: (countries.rows ?? []).map((r) => ({ country: String(r[0]), views: Number(r[1]) })),
      retention: (perVideo.rows ?? []).map((r) => ({ video_id: String(r[0]), title: videoTitles.get(String(r[0])) ?? null, views: Number(r[1]), avg_view_seconds: Math.round(Number(r[2])), avg_view_percentage: r1(Number(r[3])) })),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 403 without the Analytics API enabled in the Google Cloud project, or no permission
    return { available: false as const, reason: /accessNotConfigured|has not been used|disabled|SERVICE_DISABLED/i.test(msg) ? ("api_disabled" as const) : /403|insufficient|forbidden/i.test(msg) ? ("scope" as const) : ("error" as const) };
  }
}

// ---------------------------------------------------------------- insights

export async function youtubeInsights(env: Env, actor: Actor, brandId: string, daysArg: unknown, lang: "en" | "tr" = "en") {
  void lang;
  const brand = await getBrand(env, brandId, actor);
  const acc = await getAccount(env, brand.id, "youtube");
  needsScope(acc.tokens.scope, "youtube.readonly");
  const days = [7, 28, 90].includes(Number(daysArg)) ? Number(daysArg) : 28;
  const token = acc.tokens.access_token;
  const { ch, raw } = await channelAndUploads(token, MAX_VIDEOS);
  const now = Date.now();
  const kervly = await kervlyPosts(env, brand.id);
  const videos = raw.map((v) => toVideo(v, kervly, now));
  const views = videos.map((v) => v.views);
  const ranked = [...videos].sort((a, b) => b.views - a.views);
  const slim = (v: VideoInfo) => ({ id: v.id, title: v.title, url: v.url, views: v.views, likes: v.likes, comments: v.comments, engagement_rate: v.engagement_rate, published_at: v.published_at });
  const st = ch.statistics ?? {};
  const analytics = await analyticsData(token, acc.tokens.scope, days, new Map(videos.map((v) => [v.id, v.title])));

  return {
    brand: brand.id,
    timezone: brand.timezone,
    fetched_at: new Date(now).toISOString(),
    days,
    channel: {
      id: ch.id,
      title: ch.snippet?.title ?? acc.account_name,
      handle: ch.snippet?.customUrl ?? null,
      url: `https://www.youtube.com/channel/${ch.id}`,
      created_at: ch.snippet?.publishedAt ?? null,
      country: ch.snippet?.country ?? null,
      subscribers: st.hiddenSubscriberCount ? null : n(st.subscriberCount as string),
      views: n(st.viewCount as string),
      videos: n(st.videoCount as string),
    },
    summary: {
      analyzed_videos: videos.length,
      total_views: views.reduce((a, b) => a + b, 0),
      avg_views: Math.round(avg(views)),
      median_views: Math.round(median(views)),
      avg_likes: Math.round(avg(videos.map((v) => v.likes))),
      avg_comments: r1(avg(videos.map((v) => v.comments))),
      avg_engagement_rate: r1(avg(videos.filter((v) => v.views).map((v) => v.engagement_rate))),
      avg_duration_seconds: Math.round(avg(videos.map((v) => v.duration_seconds))),
      avg_title_length: Math.round(avg(videos.map((v) => v.title.length))),
      avg_tags: r1(avg(videos.map((v) => v.tags.length))),
      avg_views_per_day: r1(avg(videos.map((v) => v.views_per_day))),
      shorts: videos.filter((v) => v.is_short).length,
      kervly_published: videos.filter((v) => v.kervly_post).length,
      best: ranked.slice(0, 3).map(slim),
      worst: ranked.slice(-3).reverse().map(slim),
    },
    patterns: patterns(videos, brand.timezone),
    analytics,
    videos,
  };
}
