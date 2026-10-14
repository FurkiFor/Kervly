import type { Env } from "../env";
import type { PostRow } from "../db";
import { AppError, type MsgKey } from "../i18n";

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  /** ms epoch; 0 = unknown */
  expires_at: number;
  refresh_expires_at?: number;
}

export interface ConnectedAccount {
  tokens: TokenSet;
  account_id: string;
  account_name: string;
}

export type StepResult =
  | { state: "published"; external_id: string; result_url: string | null; note?: MsgKey }
  | { state: "processing"; remote_ref: string; note?: MsgKey };

export interface PlatformAdapter {
  /** Are the platform app keys configured? */
  configured(env: Env): boolean;
  authUrl(env: Env, redirectUri: string, state: string, codeChallenge: string): string;
  exchange(env: Env, code: string, redirectUri: string, codeVerifier: string): Promise<ConnectedAccount>;
  /** Returns a refreshed token set if a refresh was needed, otherwise null. */
  refreshIfNeeded(env: Env, tokens: TokenSet, now: number): Promise<TokenSet | null>;
  start(env: Env, post: PostRow, account: ConnectedAccount): Promise<StepResult>;
  poll(env: Env, post: PostRow, account: ConnectedAccount): Promise<StepResult>;
}

/** Platform API error. retryable = transient (network, 5xx, 429). */
export class PlatformError extends AppError {
  constructor(key: MsgKey, params: Record<string, unknown> = {}, public retryable = false) {
    super(key, params);
  }
}

export type Step = "token_exchange" | "token_refresh" | "long_lived" | "account_info" | "upload_init" | "upload" | "status" | "container" | "publish";

/** Builds an error from a failed response, with token-looking values redacted. */
export async function apiError(platform: string, step: Step, r: Response): Promise<PlatformError> {
  let detail = "";
  try {
    const t = await r.text();
    detail = t
      .slice(0, 300)
      // Token-like keys are hidden; an API error's own "code" field is kept because it explains the failure
      .replace(/(access_token|refresh_token|client_secret)["=:\s]+[^"&\s,}]+/gi, "$1=***")
      .replace(/(^|[?&\s])code=[^&\s]+/g, "$1code=***");
  } catch {
    /* ignore */
  }
  const retryable = r.status >= 500 || r.status === 429;
  return new PlatformError("pf.http", { platform, step: `@step.${step}`, status: r.status, detail }, retryable);
}

export function form(data: Record<string, string>): URLSearchParams {
  return new URLSearchParams(data);
}

export function parseJsonSafe<T = unknown>(t: string): T | null {
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
