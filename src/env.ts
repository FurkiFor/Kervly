import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  SESSIONS: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;

  /** Brand allowlist prefixes may only use these hosts (comma separated). Hard ceiling. */
  MEDIA_ALLOWED_HOSTS: string;
  /** A brand's daily per-platform limit can never exceed this. */
  MAX_POSTS_PER_DAY_CEILING: string;
  /** Default time zone for new brands and the activity log. */
  DEFAULT_TIMEZONE: string;
  /** Default UI language when the browser gives no hint ("en" | "tr"). */
  DEFAULT_LANG: string;
  /** Language of MCP tool messages ("en" | "tr"). */
  MCP_LANG: string;
  INSTAGRAM_API_VERSION: string;
  /** "true" while the TikTok app is not audited: posts are forced to SELF_ONLY. */
  TIKTOK_UNAUDITED: string;

  // Secrets (set with `wrangler secret put` or in the Cloudflare dashboard — never in git)
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_TOTP_SECRET?: string;
  ENCRYPTION_KEY?: string;
  CONSENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  INSTAGRAM_APP_ID?: string;
  INSTAGRAM_APP_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
}

export const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

/** Single admin user (self-hosted edition). */
export const ADMIN_USER = "admin";

/** Core secrets that must exist before the app can be used. */
export function missingCoreSecrets(env: Env): string[] {
  const req: (keyof Env)[] = ["ADMIN_PASSWORD_HASH", "ADMIN_TOTP_SECRET", "ENCRYPTION_KEY", "CONSENT_SECRET"];
  return req.filter((k) => !env[k]) as string[];
}
