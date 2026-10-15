import { openMedia } from "../media";
import { apiError, form, PlatformError, type PlatformAdapter } from "./types";

/** Least privilege: upload videos, plus read-only access for channel statistics and analytics. */
export const SCOPE_UPLOAD = "https://www.googleapis.com/auth/youtube.upload";
export const SCOPE_READ = "https://www.googleapis.com/auth/youtube.readonly";
/** Watch time, traffic sources, countries (YouTube Analytics API). */
export const SCOPE_ANALYTICS = "https://www.googleapis.com/auth/yt-analytics.readonly";
const SCOPE = `${SCOPE_UPLOAD} ${SCOPE_READ} ${SCOPE_ANALYTICS}`;

export const CATEGORY_IDS: Record<string, string> = {
  FILM_ANIMATION: "1",
  AUTOS: "2",
  MUSIC: "10",
  PETS_ANIMALS: "15",
  SPORTS: "17",
  TRAVEL_EVENTS: "19",
  GAMING: "20",
  PEOPLE_BLOGS: "22",
  COMEDY: "23",
  ENTERTAINMENT: "24",
  NEWS_POLITICS: "25",
  HOWTO_STYLE: "26",
  EDUCATION: "27",
  SCIENCE_TECH: "28",
  NONPROFITS_ACTIVISM: "29",
};

export const youtube: PlatformAdapter = {
  configured: (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),

  authUrl(env, redirectUri, state, codeChallenge) {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent select_account",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return u.toString();
  },

  async exchange(env, code, redirectUri, codeVerifier) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });
    if (!r.ok) throw await apiError("YouTube", "token_exchange", r);
    const j = (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
    if (!j.refresh_token) throw new PlatformError("pf.no_refresh");
    if (!String(j.scope).includes("youtube.upload")) throw new PlatformError("pf.scope", { scope: "youtube.upload" });
    // With the read-only permission the connection is named after the channel (best effort)
    let account_id = "youtube";
    let account_name = "YouTube";
    if (String(j.scope).includes("youtube.readonly")) {
      try {
        const c = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${j.access_token}` } });
        const ch = c.ok ? ((await c.json()) as { items?: { id: string; snippet?: { title?: string } }[] }).items?.[0] : undefined;
        if (ch) {
          account_id = ch.id;
          account_name = (ch.snippet?.title || "YouTube").slice(0, 100);
        }
      } catch {
        /* keep the generic name */
      }
    }
    return {
      tokens: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000, scope: j.scope },
      account_id,
      account_name,
    };
  },

  async refreshIfNeeded(env, tokens, now) {
    if (tokens.expires_at - now > 5 * 60_000) return null;
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token!,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) {
      const e = await apiError("YouTube", "token_refresh", r);
      if (r.status === 400) throw new PlatformError("pf.google_test_mode", { base: e });
      throw e;
    }
    const j = (await r.json()) as { access_token: string; expires_in: number; refresh_token?: string };
    return { access_token: j.access_token, refresh_token: j.refresh_token || tokens.refresh_token, expires_at: now + j.expires_in * 1000, scope: tokens.scope };
  },

  async start(_env, post, account) {
    const opts = JSON.parse(post.options || "{}") as Record<string, unknown>;
    const media = await (post.media_open ? post.media_open() : openMedia(post.media_url));
    const str = (k: string) => (typeof opts[k] === "string" && opts[k] ? (opts[k] as string) : undefined);
    const bool = (k: string) => (typeof opts[k] === "boolean" ? (opts[k] as boolean) : undefined);
    const metadata = {
      snippet: {
        title: post.title,
        description: post.caption,
        tags: JSON.parse(post.tags || "[]"),
        categoryId: CATEGORY_IDS[(opts.category as string) || "PEOPLE_BLOGS"] || "22",
        ...(str("language") ? { defaultLanguage: str("language") } : {}),
        ...(str("audioLanguage") ? { defaultAudioLanguage: str("audioLanguage") } : {}),
      },
      status: {
        privacyStatus: (opts.privacy as string) || "public",
        selfDeclaredMadeForKids: Boolean(opts.madeForKids ?? false),
        // Disclosure for realistic AI-generated or altered content
        containsSyntheticMedia: Boolean(opts.aiGenerated ?? false),
        ...(str("license") ? { license: str("license") } : {}),
        ...(bool("embeddable") !== undefined ? { embeddable: bool("embeddable") } : {}),
        ...(bool("publicStatsViewable") !== undefined ? { publicStatsViewable: bool("publicStatsViewable") } : {}),
      },
    };
    const qs = new URLSearchParams({ uploadType: "resumable", part: "snippet,status" });
    if (opts.notifySubscribers === false) qs.set("notifySubscribers", "false");
    // 1) Start a resumable upload session
    const init = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?${qs}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.tokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(media.size),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    });
    if (!init.ok) {
      await media.body.cancel();
      throw await apiError("YouTube", "upload_init", init);
    }
    const uploadUrl = init.headers.get("Location");
    if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/")) {
      await media.body.cancel();
      throw new PlatformError("pf.yt_upload_url");
    }
    // 2) Stream the video with a fixed length (never buffered in memory)
    const { readable, writable } = new FixedLengthStream(media.size);
    const pipe = media.body.pipeTo(writable);
    const up = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", Authorization: `Bearer ${account.tokens.access_token}` },
      body: readable,
    });
    await pipe.catch(() => undefined);
    if (up.status !== 200 && up.status !== 201) throw await apiError("YouTube", "upload", up);
    const j = (await up.json()) as { id: string; status?: { uploadStatus?: string; rejectionReason?: string } };
    if (j.status?.uploadStatus === "rejected") throw new PlatformError("pf.yt_rejected", { reason: j.status.rejectionReason ?? "" });
    return { state: "published", external_id: j.id, result_url: `https://www.youtube.com/shorts/${j.id}` };
  },

  async poll() {
    throw new PlatformError("pf.no_poll");
  },
};
