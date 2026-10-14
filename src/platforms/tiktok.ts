import { openMedia } from "../media";
import { apiError, form, PlatformError, type PlatformAdapter, type Step } from "./types";

const API = "https://open.tiktokapis.com/v2";
const SCOPES = "user.info.basic,video.publish";
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;
const MAX_PROCESSING_MS = 45 * 60_000;

interface TikTokEnvelope<T> {
  data: T;
  error: { code: string; message: string; log_id?: string };
}

async function tt<T>(step: Step, r: Response): Promise<T> {
  let j: TikTokEnvelope<T>;
  if (!r.ok) {
    // TikTok answers 403 with a JSON error body; read it so the unaudited-app case gets its own message
    const body = (await r.clone().json().catch(() => null)) as TikTokEnvelope<T> | null;
    if (body?.error?.code !== "unaudited_client_can_only_post_to_private_accounts") throw await apiError("TikTok", step, r);
    j = body;
  } else {
    j = (await r.json()) as TikTokEnvelope<T>;
  }
  if (j.error && j.error.code !== "ok") {
    const retry = ["rate_limit_exceeded", "internal_error"].includes(j.error.code);
    const base = new PlatformError("pf.tt_api", { step: `@step.${step}`, code: j.error.code, message: j.error.message }, retry);
    if (j.error.code === "unaudited_client_can_only_post_to_private_accounts") throw new PlatformError("pf.tt_unaudited", { base });
    throw base;
  }
  return j.data;
}

/** TikTok Content Posting API — Direct Post with FILE_UPLOAD. */
export const tiktok: PlatformAdapter = {
  configured: (env) => Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),

  authUrl(env, redirectUri, state, codeChallenge) {
    const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.search = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      scope: SCOPES,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return u.toString();
  },

  async exchange(env, code, redirectUri, codeVerifier) {
    const r = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_key: env.TIKTOK_CLIENT_KEY!,
        client_secret: env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    if (!r.ok) throw await apiError("TikTok", "token_exchange", r);
    const j = (await r.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
      refresh_expires_in: number;
      open_id: string;
      scope: string;
      error?: string;
      error_description?: string;
    };
    if (j.error) throw new PlatformError("pf.tt_token", { error: `${j.error} ${j.error_description ?? ""}`.trim() });
    if (!String(j.scope).includes("video.publish")) throw new PlatformError("pf.scope", { scope: "video.publish" });
    const now = Date.now();
    let name = "TikTok";
    const me = await fetch(`${API}/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${j.access_token}` } });
    if (me.ok) {
      const mj = (await me.json()) as TikTokEnvelope<{ user?: { display_name?: string } }>;
      if (mj.data?.user?.display_name) name = mj.data.user.display_name;
    }
    return {
      tokens: {
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: now + j.expires_in * 1000,
        refresh_expires_at: now + j.refresh_expires_in * 1000,
      },
      account_id: j.open_id,
      account_name: name,
    };
  },

  async refreshIfNeeded(env, tokens, now) {
    if (tokens.expires_at - now > 10 * 60_000) return null;
    const r = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_key: env.TIKTOK_CLIENT_KEY!,
        client_secret: env.TIKTOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token!,
      }),
    });
    if (!r.ok) throw await apiError("TikTok", "token_refresh", r);
    const j = (await r.json()) as { access_token: string; expires_in: number; refresh_token: string; refresh_expires_in: number; error?: string };
    if (j.error) throw new PlatformError("pf.tt_token", { error: j.error });
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: now + j.expires_in * 1000,
      refresh_expires_at: now + j.refresh_expires_in * 1000,
    };
  },

  async start(env, post, account) {
    const opts = JSON.parse(post.options || "{}") as Record<string, unknown>;
    const auth = { Authorization: `Bearer ${account.tokens.access_token}`, "Content-Type": "application/json; charset=UTF-8" };

    const info = await tt<{ privacy_level_options: string[] }>(
      "account_info",
      await fetch(`${API}/post/publish/creator_info/query/`, { method: "POST", headers: auth }),
    );
    let privacy = (opts.privacy as string) || "PUBLIC_TO_EVERYONE";
    let note: "pf.note_private" | undefined;
    if (env.TIKTOK_UNAUDITED !== "false") {
      privacy = "SELF_ONLY";
      note = "pf.note_private";
    }
    if (!info.privacy_level_options.includes(privacy)) {
      throw new PlatformError("pf.tt_privacy", { privacy, allowed: info.privacy_level_options.join(", ") });
    }

    const media = await (post.media_open ? post.media_open() : openMedia(post.media_url));
    if (media.size > MAX_SINGLE_CHUNK) {
      await media.body.cancel();
      throw new PlatformError("pf.tt_too_big");
    }
    let init: { publish_id: string; upload_url: string };
    try {
      init = await tt("upload_init", await fetch(`${API}/post/publish/video/init/`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          post_info: {
            title: (post.caption || post.title).slice(0, 2200),
            privacy_level: privacy,
            disable_comment: Boolean(opts.disableComment ?? false),
            disable_duet: Boolean(opts.disableDuet ?? false),
            disable_stitch: Boolean(opts.disableStitch ?? false),
            video_cover_timestamp_ms: 1000,
            brand_content_toggle: false,
            brand_organic_toggle: false,
            is_aigc: false,
          },
          source_info: { source: "FILE_UPLOAD", video_size: media.size, chunk_size: media.size, total_chunk_count: 1 },
        }),
      }));
    } catch (e) {
      await media.body.cancel();
      throw e;
    }
    if (!init.upload_url.startsWith("https://")) {
      await media.body.cancel();
      throw new PlatformError("pf.tt_upload_url");
    }
    const { readable, writable } = new FixedLengthStream(media.size);
    const pipe = media.body.pipeTo(writable);
    const up = await fetch(init.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${media.size - 1}/${media.size}` },
      body: readable,
    });
    await pipe.catch(() => undefined);
    if (up.status !== 201 && up.status !== 200) throw await apiError("TikTok", "upload", up);
    return { state: "processing", remote_ref: init.publish_id, note };
  },

  async poll(_env, post, account) {
    const d = await tt<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
      "status",
      await fetch(`${API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${account.tokens.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id: post.remote_ref }),
      }),
    );
    if (d.status === "FAILED") throw new PlatformError("pf.tt_failed", { reason: d.fail_reason ?? "unknown" });
    if (d.status === "PUBLISH_COMPLETE" || d.status === "SEND_TO_USER_INBOX") {
      const id = d.publicaly_available_post_id?.[0];
      return {
        state: "published",
        external_id: id ? String(id) : post.remote_ref!,
        result_url: id ? `https://www.tiktok.com/video/${id}` : null,
      };
    }
    if (Date.now() - post.publish_at > MAX_PROCESSING_MS) throw new PlatformError("pf.tt_timeout");
    return { state: "processing", remote_ref: post.remote_ref! };
  },
};
