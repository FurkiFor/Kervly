import type { Actor, Env } from "./env";
import { getBrand } from "./brands";
import { getAccount } from "./connections";
import { AppError } from "./i18n";
import { apiError } from "./platforms/types";

/** Channel statistics from the YouTube Data API (needs the read-only permission granted when connecting). */

interface ChannelItem {
  id: string;
  snippet?: { title?: string; customUrl?: string };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
}
interface VideoItem {
  id: string;
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

const num = (v: string | undefined) => (v === undefined ? null : Number(v));

async function yt<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) {
    const body = await r.clone().text();
    if (/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT|forbidden/i.test(body)) throw new AppError("yt.stats_scope");
  }
  if (!r.ok) throw await apiError("YouTube", "status", r);
  return (await r.json()) as T;
}

export async function youtubeStats(env: Env, actor: Actor, brandId: string) {
  const brand = await getBrand(env, brandId, actor);
  const acc = await getAccount(env, brand.id, "youtube");
  const token = acc.tokens.access_token;
  if (acc.tokens.scope && !acc.tokens.scope.includes("youtube.readonly")) throw new AppError("yt.stats_scope");

  const ch = (await yt<{ items?: ChannelItem[] }>(token, "channels?part=snippet,statistics&mine=true")).items?.[0];
  if (!ch) throw new AppError("yt.no_channel");

  const { results } = await env.DB.prepare(
    `SELECT id, title, external_id, publish_at FROM posts
     WHERE brand_id = ? AND platform = 'youtube' AND status = 'published' AND external_id IS NOT NULL
     ORDER BY publish_at DESC LIMIT 50`,
  )
    .bind(brand.id)
    .all<{ id: string; title: string; external_id: string; publish_at: number }>();
  const stats = new Map<string, VideoItem["statistics"]>();
  if (results.length) {
    const ids = results.map((r) => r.external_id).join(",");
    for (const v of (await yt<{ items?: VideoItem[] }>(token, `videos?part=statistics&id=${encodeURIComponent(ids)}`)).items ?? []) stats.set(v.id, v.statistics);
  }
  const videos = results.map((r) => {
    const st = stats.get(r.external_id);
    return {
      post: r.id,
      title: r.title,
      video_id: r.external_id,
      url: `https://www.youtube.com/shorts/${r.external_id}`,
      published_at: new Date(r.publish_at).toISOString(),
      views: num(st?.viewCount),
      likes: num(st?.likeCount),
      comments: num(st?.commentCount),
    };
  });
  const sum = (k: "views" | "likes" | "comments") => videos.reduce((a, v) => a + (v[k] ?? 0), 0);
  return {
    brand: brand.id,
    fetched_at: new Date().toISOString(),
    channel: {
      id: ch.id,
      title: ch.snippet?.title ?? acc.account_name,
      handle: ch.snippet?.customUrl ?? null,
      url: `https://www.youtube.com/channel/${ch.id}`,
      subscribers: ch.statistics?.hiddenSubscriberCount ? null : num(ch.statistics?.subscriberCount),
      views: num(ch.statistics?.viewCount),
      videos: num(ch.statistics?.videoCount),
    },
    kervly_videos: { count: videos.length, views: sum("views"), likes: sum("likes"), comments: sum("comments") },
    videos,
  };
}
