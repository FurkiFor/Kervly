import type { Env } from "../env";
import { apiError, form, parseJsonSafe, PlatformError, type PlatformAdapter } from "./types";

/** Instagram API with Instagram Login (no Facebook Page required). */
const SCOPES = "instagram_business_basic,instagram_business_content_publish";
const MAX_PROCESSING_MS = 45 * 60_000;

function graph(env: Env, path: string): string {
  return `https://graph.instagram.com/${env.INSTAGRAM_API_VERSION || "v23.0"}/${path}`;
}

export const instagram: PlatformAdapter = {
  configured: (env) => Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET),

  authUrl(env, redirectUri, state) {
    const u = new URL("https://www.instagram.com/oauth/authorize");
    u.search = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      state,
      enable_fb_login: "0",
      force_reauth: "true",
    }).toString();
    return u.toString();
  },

  async exchange(env, code, redirectUri) {
    const r = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form({
        client_id: env.INSTAGRAM_APP_ID!,
        client_secret: env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code.replace(/#_$/, ""),
      }),
    });
    if (!r.ok) throw await apiError("Instagram", "token_exchange", r);
    const raw = (await r.json()) as { data?: { access_token: string; user_id: string; permissions?: string }[]; access_token?: string; user_id?: string; permissions?: string };
    const short = raw.data?.[0] ?? (raw as { access_token: string; user_id: string; permissions?: string });
    if (!String(short.permissions ?? SCOPES).includes("instagram_business_content_publish")) {
      throw new PlatformError("pf.scope", { scope: "instagram_business_content_publish" });
    }
    // Exchange for a long-lived (60 day) token
    const lr = await fetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: env.INSTAGRAM_APP_SECRET!,
        access_token: short.access_token,
      })}`,
    );
    if (!lr.ok) throw await apiError("Instagram", "long_lived", lr);
    const long = (await lr.json()) as { access_token: string; expires_in: number };
    const me = await fetch(`${graph(env, "me")}?fields=user_id,username`, { headers: { Authorization: `Bearer ${long.access_token}` } });
    if (!me.ok) throw await apiError("Instagram", "account_info", me);
    const mj = (await me.json()) as { user_id?: string; id?: string; username?: string };
    return {
      tokens: { access_token: long.access_token, expires_at: Date.now() + long.expires_in * 1000 },
      account_id: String(mj.user_id || mj.id || short.user_id),
      account_name: mj.username ? `@${mj.username}` : "Instagram",
    };
  },

  async refreshIfNeeded(_env, tokens, now) {
    // Refresh the long-lived token 10 days before it expires
    if (tokens.expires_at - now > 10 * 24 * 3600_000) return null;
    const r = await fetch(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: tokens.access_token })}`,
    );
    if (!r.ok) throw await apiError("Instagram", "token_refresh", r);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    return { access_token: j.access_token, expires_at: now + j.expires_in * 1000 };
  },

  async start(env, post, account) {
    const opts = JSON.parse(post.options || "{}") as Record<string, unknown>;
    // Instagram downloads the video from the (allowlisted, public) URL itself
    const r = await fetch(graph(env, `${account.account_id}/media`), {
      method: "POST",
      headers: { Authorization: `Bearer ${account.tokens.access_token}` },
      body: form({
        media_type: "REELS",
        video_url: post.media_public_url ?? post.media_url,
        caption: post.caption || post.title,
        share_to_feed: String(opts.shareToFeed ?? true),
      }),
    });
    if (!r.ok) throw await apiError("Instagram", "container", r);
    const j = (await r.json()) as { id: string };
    return { state: "processing", remote_ref: j.id };
  },

  async poll(env, post, account) {
    const container = post.remote_ref!;
    const auth = { Authorization: `Bearer ${account.tokens.access_token}` };
    const s = await fetch(`${graph(env, container)}?fields=status_code,status`, { headers: auth });
    if (!s.ok) throw await apiError("Instagram", "status", s);
    const sj = (await s.json()) as { status_code: string; status?: string };
    if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") {
      throw new PlatformError("pf.ig_failed", { status: `${sj.status_code} ${sj.status ?? ""}`.trim() });
    }
    if (sj.status_code === "PUBLISHED") return { state: "published", external_id: container, result_url: null };
    if (sj.status_code !== "FINISHED") {
      if (Date.now() - post.publish_at > MAX_PROCESSING_MS) throw new PlatformError("pf.ig_timeout");
      return { state: "processing", remote_ref: container };
    }
    const p = await fetch(graph(env, `${account.account_id}/media_publish`), { method: "POST", headers: auth, body: form({ creation_id: container }) });
    if (!p.ok) throw await apiError("Instagram", "publish", p);
    const pj = parseJsonSafe<{ id: string }>(await p.text());
    if (!pj?.id) throw new PlatformError("pf.ig_no_id");
    let link: string | null = null;
    const l = await fetch(`${graph(env, pj.id)}?fields=permalink`, { headers: auth });
    if (l.ok) link = ((await l.json()) as { permalink?: string }).permalink ?? null;
    return { state: "published", external_id: pj.id, result_url: link };
  },
};
