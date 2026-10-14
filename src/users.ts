import { isSuper, registrationMode, superadminLogin, type Actor, type Env, type Role } from "./env";
import { decryptJson, encryptJson, hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";
import { AppError, type Lang } from "./i18n";
import { audit } from "./db";
import { sendAccountEmail } from "./email";

export type UserStatus = "unverified" | "pending" | "active" | "disabled";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  role: Role;
  status: UserStatus;
  totp_enc: string | null;
  session_version: number;
  created_at: number;
  last_login_at: number | null;
}

export const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export const MIN_PASSWORD = 10;

export function normalizeEmail(v: unknown): string {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new AppError("u.email_invalid");
  return e;
}

export function checkPasswordStrength(pw: string): void {
  if (pw.length < MIN_PASSWORD || pw.length > 256) throw new AppError("u.password_short", { min: MIN_PASSWORD });
}

export async function getUser(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function getUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export const toActor = (u: UserRow): Actor => ({ id: u.id, email: u.email, role: u.role });

/**
 * The env-configured superadmin (ADMIN_PASSWORD_HASH + ADMIN_TOTP_SECRET) gets a user row on first
 * sign-in. Brands created before v0.3 (owner_id NULL) are assigned to it.
 */
export async function ensureSuperadmin(env: Env): Promise<UserRow> {
  const email = superadminLogin(env);
  let u = await getUserByEmail(env, email);
  if (!u) {
    const id = `u_${randomToken(9)}`;
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, NULL, 'superadmin', 'active', ?)",
    )
      .bind(id, email, Date.now())
      .run();
    u = (await getUser(env, id))!;
  } else if (u.role !== "superadmin" || u.status !== "active" || u.password_hash || u.totp_enc) {
    // Promotion: the env credentials replace the row's own password/2FA, and old sessions end
    await env.DB.prepare(
      "UPDATE users SET role = 'superadmin', status = 'active', password_hash = NULL, totp_enc = NULL, session_version = session_version + 1 WHERE id = ?",
    )
      .bind(u.id)
      .run();
    await revokeAllGrants(env, u.id);
    u = (await getUser(env, u.id))!;
  }
  // Only the configured address is superadmin; a previous one becomes a regular user
  const { results: old } = await env.DB.prepare("SELECT id FROM users WHERE role = 'superadmin' AND id != ?").bind(u.id).all<{ id: string }>();
  for (const o of old) {
    await env.DB.prepare("UPDATE users SET role = 'user', session_version = session_version + 1 WHERE id = ?").bind(o.id).run();
    await revokeAllGrants(env, o.id);
  }
  await env.DB.prepare("UPDATE brands SET owner_id = ? WHERE owner_id IS NULL").bind(u.id).run();
  return u;
}

/** Revokes every MCP (OAuth) grant of a user. Best effort: MCP also checks session_version. */
export async function revokeAllGrants(env: Env, userId: string): Promise<void> {
  try {
    const api = env.OAUTH_PROVIDER;
    if (!api) return;
    let cursor: string | undefined;
    do {
      const page = await api.listUserGrants(userId, cursor ? { cursor } : undefined);
      for (const g of page.items) await api.revokeGrant(g.id, userId);
      cursor = page.cursor;
    } while (cursor);
  } catch (e) {
    console.error("revokeAllGrants", e);
  }
}

// ---------------- one-time email tokens ----------------
async function issueToken(env: Env, userId: string, purpose: "verify" | "reset", ttlMs: number): Promise<string> {
  const token = randomToken(32);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?").bind(userId, purpose),
    env.DB.prepare("INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)").bind(
      await sha256Hex(token),
      userId,
      purpose,
      Date.now() + ttlMs,
    ),
  ]);
  return token;
}

/** Checks a token without using it. */
export async function peekToken(env: Env, token: string, purpose: "verify" | "reset"): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return false;
  const r = await env.DB.prepare("SELECT 1 AS ok FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?")
    .bind(await sha256Hex(token), purpose, Date.now())
    .first<{ ok: number }>();
  return Boolean(r);
}

/** Consumes a token exactly once. Returns the user id or null. */
async function consumeToken(env: Env, token: string, purpose: "verify" | "reset"): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const r = await env.DB.prepare(
    "UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id",
  )
    .bind(Date.now(), await sha256Hex(token), purpose, Date.now())
    .first<{ user_id: string }>();
  return r?.user_id ?? null;
}

function baseUrl(env: Env, origin: string): string {
  return (env.PUBLIC_URL || origin).replace(/\/+$/, "");
}

// ---------------- sign-up / verification / reset ----------------
/**
 * Sign-up only takes an email. The password is chosen after clicking the emailed link, so nobody can
 * pre-register someone else's address with a password they know. Every case sends one email, so the
 * response does not reveal whether an account exists.
 */
export async function signup(env: Env, origin: string, lang: Lang, emailIn: unknown): Promise<void> {
  const mode = registrationMode(env);
  if (mode === "closed") throw new AppError("u.registration_closed");
  const email = normalizeEmail(emailIn);
  if (email === superadminLogin(env)) return;
  const existing = await getUserByEmail(env, email);
  if (existing && existing.status !== "unverified") {
    await sendAccountEmail(env, "exists", lang, email, `${baseUrl(env, origin)}/login`);
    return;
  }
  let id = existing?.id;
  if (!id) {
    id = `u_${randomToken(9)}`;
    await env.DB.prepare("INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, NULL, 'user', 'unverified', ?)")
      .bind(id, email, Date.now())
      .run();
    await audit(env, id, "user.signup", email, { user: id });
  }
  const token = await issueToken(env, id, "verify", 24 * 3600_000);
  await sendAccountEmail(env, "verify", lang, email, `${baseUrl(env, origin)}/verify?token=${token}`);
}

/** Completes sign-up: sets the password chosen on the verification page. Returns the new status or null. */
export async function verifyEmail(env: Env, token: string, password: string): Promise<UserStatus | null> {
  checkPasswordStrength(password);
  const id = await consumeToken(env, token, "verify");
  if (!id) return null;
  const next: UserStatus = registrationMode(env) === "open" ? "active" : "pending";
  const r = await env.DB.prepare(
    "UPDATE users SET status = ?, password_hash = ?, session_version = session_version + 1 WHERE id = ? AND status = 'unverified' RETURNING status",
  )
    .bind(next, await hashPassword(password), id)
    .first<{ status: UserStatus }>();
  if (!r) return null;
  await audit(env, id, "user.verified", next, { user: id });
  return r.status;
}

export async function requestPasswordReset(env: Env, origin: string, lang: Lang, emailIn: unknown): Promise<void> {
  let email: string;
  try {
    email = normalizeEmail(emailIn);
  } catch {
    return;
  }
  const u = await getUserByEmail(env, email);
  if (!u || !u.password_hash || u.status === "disabled") return;
  const token = await issueToken(env, u.id, "reset", 3600_000);
  await sendAccountEmail(env, "reset", lang, email, `${baseUrl(env, origin)}/reset?token=${token}`);
  await audit(env, u.id, "user.reset_requested", "", { user: u.id });
}

export async function resetPassword(env: Env, token: string, password: string): Promise<boolean> {
  checkPasswordStrength(password);
  const id = await consumeToken(env, token, "reset");
  if (!id) return false;
  // Changing the password signs out every existing session
  await env.DB.prepare("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?")
    .bind(await hashPassword(password), id)
    .run();
  await revokeAllGrants(env, id);
  await audit(env, id, "user.password_reset", "", { user: id });
  return true;
}

// ---------------- sign-in ----------------
export type PasswordCheck = { ok: true; user: UserRow } | { ok: false };

/** Database users (the env superadmin is handled in auth.ts). Constant work for unknown emails. */
export async function checkUserPassword(env: Env, email: string, password: string): Promise<PasswordCheck> {
  const u = await getUserByEmail(env, email);
  const hash = u?.password_hash || "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const ok = await verifyPassword(password, hash);
  return ok && u && u.password_hash ? { ok: true, user: u } : { ok: false };
}

export async function getUserTotp(env: Env, u: UserRow): Promise<string | null> {
  if (!u.totp_enc || !env.ENCRYPTION_KEY) return null;
  return decryptJson<string>(env.ENCRYPTION_KEY, u.totp_enc, `totp:${u.id}`);
}

export async function setUserTotp(env: Env, userId: string, secret: string | null): Promise<void> {
  const enc = secret ? await encryptJson(env.ENCRYPTION_KEY!, secret, `totp:${userId}`) : null;
  await env.DB.prepare("UPDATE users SET totp_enc = ? WHERE id = ?").bind(enc, userId).run();
}

export async function changePassword(env: Env, actor: Actor, current: string, next: string): Promise<void> {
  const u = await getUser(env, actor.id);
  if (!u || !u.password_hash) throw new AppError("u.password_env");
  if (!(await verifyPassword(current, u.password_hash))) throw new AppError("u.password_wrong");
  checkPasswordStrength(next);
  await env.DB.prepare("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?")
    .bind(await hashPassword(next), u.id)
    .run();
  await revokeAllGrants(env, u.id);
  await audit(env, u.id, "user.password_changed", "", { user: u.id });
}

// ---------------- administration (superadmin only) ----------------
export interface UserView {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  two_factor: boolean;
  brands: number;
  created_at: string;
  last_login_at: string | null;
}

export async function listUsers(env: Env, actor: Actor): Promise<UserView[]> {
  if (!isSuper(actor)) throw new AppError("err.forbidden");
  const { results } = await env.DB.prepare(
    `SELECT users.*, (SELECT COUNT(*) FROM brands WHERE brands.owner_id = users.id) AS brand_count
     FROM users ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 500`,
  ).all<UserRow & { brand_count: number }>();
  return results.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    two_factor: Boolean(u.totp_enc) || u.role === "superadmin",
    brands: u.brand_count,
    created_at: new Date(u.created_at).toISOString(),
    last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
  }));
}

export async function setUserStatus(env: Env, actor: Actor, origin: string, lang: Lang, id: string, action: "approve" | "disable" | "enable"): Promise<void> {
  if (!isSuper(actor)) throw new AppError("err.forbidden");
  const u = await getUser(env, id);
  if (!u) throw new AppError("u.not_found");
  if (u.role === "superadmin") throw new AppError("u.cannot_change_admin");
  // Only verified sign-ups can be approved: an unverified account has no password yet
  if (action === "approve" && u.status !== "pending") throw new AppError("u.not_pending");
  const next: UserStatus = action === "disable" ? "disabled" : "active";
  // Disabling also ends the user's sessions
  await env.DB.prepare("UPDATE users SET status = ?, session_version = session_version + ? WHERE id = ?")
    .bind(next, action === "disable" ? 1 : 0, id)
    .run();
  if (action === "disable") await revokeAllGrants(env, id);
  await audit(env, actor.id, `user.${action}`, u.email);
  if (action === "approve" && u.status === "pending") {
    await sendAccountEmail(env, "approved", lang, u.email, `${baseUrl(env, origin)}/login`);
  }
}
