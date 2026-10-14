import { superadminLogin, type Actor, type Env } from "./env";
import { randomToken, sha256Hex, timingSafeEqualStr, verifyPassword, verifyTotp } from "./crypto";
import { checkUserPassword, ensureSuperadmin, getUser, getUserTotp, toActor, type UserRow } from "./users";

export const SESSION_COOKIE = "__Host-session";
const SESSION_TTL = 8 * 60 * 60; // 8 hours
const MAX_FAILS = 5;
const FAIL_WINDOW = 15 * 60; // 15 minutes

export interface Session {
  uid: string;
  ver: number;
  csrf: string;
  created: number;
}

export interface AuthContext {
  session: Session;
  actor: Actor;
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** A session is valid only while its user is active and its session_version matches. */
export async function getAuth(req: Request, env: Env): Promise<AuthContext | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token || token.length < 20 || token.length > 100) return null;
  const raw = await env.SESSIONS.get(`s:${await sha256Hex(token)}`);
  if (!raw) return null;
  const s = JSON.parse(raw) as Session;
  if (!s.uid) return null;
  const u = await getUser(env, s.uid);
  if (!u || u.status !== "active" || u.session_version !== s.ver) return null;
  return { session: s, actor: toActor(u) };
}

export async function createSession(env: Env, user: UserRow): Promise<string> {
  const token = randomToken(32);
  const session: Session = { uid: user.id, ver: user.session_version, csrf: randomToken(24), created: Date.now() };
  // Only a hash of the cookie value is stored server-side
  await env.SESSIONS.put(`s:${await sha256Hex(token)}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(Date.now(), user.id).run();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export async function destroySession(req: Request, env: Env): Promise<string> {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) await env.SESSIONS.delete(`s:${await sha256Hex(token)}`);
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") || "unknown";
}

/** Generic per-key failure counter (login attempts, sign-ups, reset requests). */
export async function overLimit(env: Env, key: string, max: number): Promise<boolean> {
  return Number((await env.SESSIONS.get(`rl:${await sha256Hex(key)}`)) || 0) >= max;
}
export async function bump(env: Env, key: string, windowSec: number): Promise<void> {
  const k = `rl:${await sha256Hex(key)}`;
  const n = Number((await env.SESSIONS.get(k)) || 0) + 1;
  await env.SESSIONS.put(k, String(n), { expirationTtl: windowSec });
}
async function clearLimit(env: Env, key: string): Promise<void> {
  await env.SESSIONS.delete(`rl:${await sha256Hex(key)}`);
}

export type LoginResult = { ok: true; user: UserRow } | { ok: false; reason: "limited" | "invalid" | "not_configured" | "pending" | "unverified" | "disabled" | "code_required" };

async function totpOk(env: Env, secret: string, code: string): Promise<boolean> {
  const counter = await verifyTotp(secret, code.trim());
  if (counter === null) return false;
  const usedKey = `totp:${await sha256Hex(secret)}:${counter}`;
  if (await env.SESSIONS.get(usedKey)) return false; // a code can be used once
  await env.SESSIONS.put(usedKey, "1", { expirationTtl: 120 });
  return true;
}

/**
 * Email + password (+ TOTP). The superadmin always needs TOTP; regular users need it when enabled.
 * Failures are limited per IP and per email.
 */
export async function login(req: Request, env: Env, emailIn: string, password: string, code: string): Promise<LoginResult> {
  const email = emailIn.trim().toLowerCase().slice(0, 254);
  // Lockout is per (IP, email): someone else cannot lock you out from their own address.
  // Per-IP and per-email totals are higher, slower backstops against distributed guessing.
  const ip = clientIp(req);
  const pairKey = `pair:${ip}:${email}`;
  const ipKey = `ip:${ip}`;
  const emailKey = `em:${email}`;
  if ((await overLimit(env, pairKey, MAX_FAILS)) || (await overLimit(env, ipKey, MAX_FAILS * 4)) || (await overLimit(env, emailKey, MAX_FAILS * 10))) {
    return { ok: false, reason: "limited" };
  }
  const fail = async (reason: "invalid" | "code_required" = "invalid"): Promise<LoginResult> => {
    await bump(env, pairKey, FAIL_WINDOW);
    await bump(env, ipKey, FAIL_WINDOW);
    await bump(env, emailKey, FAIL_WINDOW);
    return { ok: false, reason };
  };
  if (password.length === 0 || password.length > 256) return fail();

  // Superadmin from the server configuration
  if (email === superadminLogin(env)) {
    if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_TOTP_SECRET) return { ok: false, reason: "not_configured" };
    const passOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
    if (!passOk) return fail();
    if (!code) return fail("code_required");
    if (!(await totpOk(env, env.ADMIN_TOTP_SECRET, code))) return fail();
    await clearLimit(env, pairKey);
    return { ok: true, user: await ensureSuperadmin(env) };
  }

  const r = await checkUserPassword(env, email, password);
  if (!r.ok) return fail();
  const u = r.user;
  if (u.status === "disabled") return { ok: false, reason: "disabled" };
  if (u.status === "unverified") return { ok: false, reason: "unverified" };
  if (u.status === "pending") return { ok: false, reason: "pending" };
  const secret = await getUserTotp(env, u);
  if (secret) {
    if (!code) return fail("code_required");
    if (!(await totpOk(env, secret, code))) return fail();
  }
  await clearLimit(env, pairKey);
  return { ok: true, user: u };
}

/** State-changing dashboard requests need the CSRF header and a same-origin Origin. */
export function checkCsrf(req: Request, session: Session): boolean {
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) return false;
  return timingSafeEqualStr(req.headers.get("X-CSRF-Token") || "", session.csrf);
}
