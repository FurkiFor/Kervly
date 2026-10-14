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
  /** Public base URL of this instance, e.g. https://app.example.com (used in emails and signed media links). */
  PUBLIC_URL?: string;
  /** Sign-in name of the superadmin (an email address). The superadmin signs in with ADMIN_PASSWORD_HASH + ADMIN_TOTP_SECRET. */
  SUPERADMIN_EMAIL?: string;
  /** "closed" (default: only the superadmin), "approval" (sign-ups wait for approval) or "open". */
  REGISTRATION?: string;
  /** Maximum brands per regular user. */
  MAX_BRANDS_PER_USER?: string;
  /** Sender address for account emails, e.g. "Kervly <noreply@example.com>". */
  EMAIL_FROM?: string;
  /** Cloudflare Email Service binding (optional, Workers Paid). */
  EMAIL?: { send(message: { from: string | { email: string; name?: string }; to: string; subject: string; html: string; text: string }): Promise<unknown> };

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
  /** Optional read-only GitHub token: raises the rate limit when listing public video folders. */
  GITHUB_TOKEN?: string;
  /** Optional Resend API key (alternative to the Cloudflare EMAIL binding). */
  RESEND_API_KEY?: string;
}

export const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

export type Role = "superadmin" | "user";

/** The signed-in user a request acts for. */
export interface Actor {
  id: string;
  email: string;
  role: Role;
}

export const isSuper = (a: Actor | null | undefined) => a?.role === "superadmin";

export type RegistrationMode = "closed" | "approval" | "open";
export function registrationMode(env: Env): RegistrationMode {
  return env.REGISTRATION === "open" || env.REGISTRATION === "approval" ? env.REGISTRATION : "closed";
}

/** Sign-in name of the env-configured superadmin. */
export function superadminLogin(env: Env): string {
  return (env.SUPERADMIN_EMAIL || "admin").trim().toLowerCase();
}

/** Core secrets that must exist before the app can be used. */
export function missingCoreSecrets(env: Env): string[] {
  const req: (keyof Env)[] = ["ADMIN_PASSWORD_HASH", "ADMIN_TOTP_SECRET", "ENCRYPTION_KEY", "CONSENT_SECRET"];
  return req.filter((k) => !env[k]) as string[];
}
