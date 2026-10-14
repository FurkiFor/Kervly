import { ADMIN_USER, type Env } from "./env";
import { randomToken, sha256Hex, timingSafeEqualStr, verifyPassword, verifyTotp } from "./crypto";

export const SESSION_COOKIE = "__Host-session";
const SESSION_TTL = 8 * 60 * 60; // 8 hours
const MAX_FAILS = 5;
const FAIL_WINDOW = 15 * 60; // 15 minutes

export interface Session {
  user: string;
  csrf: string;
  created: number;
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function getSession(req: Request, env: Env): Promise<Session | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token || token.length < 20 || token.length > 100) return null;
  const raw = await env.SESSIONS.get(`s:${await sha256Hex(token)}`);
  if (!raw) return null;
  const s = JSON.parse(raw) as Session;
  return s.user === ADMIN_USER ? s : null;
}

export async function createSession(env: Env): Promise<{ cookie: string; session: Session }> {
  const token = randomToken(32);
  const session: Session = { user: ADMIN_USER, csrf: randomToken(24), created: Date.now() };
  // Only the hash of the token is stored server-side
  await env.SESSIONS.put(`s:${await sha256Hex(token)}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
  return { cookie, session };
}

export async function destroySession(req: Request, env: Env): Promise<string> {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) await env.SESSIONS.delete(`s:${await sha256Hex(token)}`);
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") || "unknown";
}

async function failKey(req: Request): Promise<string> {
  return `rl:${await sha256Hex(clientIp(req))}`;
}

export async function isRateLimited(req: Request, env: Env): Promise<boolean> {
  return Number((await env.SESSIONS.get(await failKey(req))) || 0) >= MAX_FAILS;
}

async function recordFail(req: Request, env: Env): Promise<void> {
  const k = await failKey(req);
  const n = Number((await env.SESSIONS.get(k)) || 0) + 1;
  await env.SESSIONS.put(k, String(n), { expirationTtl: FAIL_WINDOW });
}

export type LoginResult = { ok: true } | { ok: false; reason: "limited" | "invalid" | "not_configured" };

/** Password + TOTP. Failed attempts are rate-limited per IP; a TOTP code cannot be reused. */
export async function checkLogin(req: Request, env: Env, password: string, code: string): Promise<LoginResult> {
  if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_TOTP_SECRET) return { ok: false, reason: "not_configured" };
  if (await isRateLimited(req, env)) return { ok: false, reason: "limited" };
  const passOk = password.length > 0 && password.length <= 256 && (await verifyPassword(password, env.ADMIN_PASSWORD_HASH));
  const counter = await verifyTotp(env.ADMIN_TOTP_SECRET, code.trim());
  if (!passOk || counter === null) {
    await recordFail(req, env);
    return { ok: false, reason: "invalid" };
  }
  const usedKey = `totp:${counter}`;
  if (await env.SESSIONS.get(usedKey)) {
    await recordFail(req, env);
    return { ok: false, reason: "invalid" };
  }
  await env.SESSIONS.put(usedKey, "1", { expirationTtl: 120 });
  await env.SESSIONS.delete(await failKey(req));
  return { ok: true };
}

/** State-changing dashboard requests need the CSRF header and a same-origin Origin. */
export function checkCsrf(req: Request, session: Session): boolean {
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) return false;
  return timingSafeEqualStr(req.headers.get("X-CSRF-Token") || "", session.csrf);
}
