import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { isPlatform, isSuper, missingCoreSecrets, registrationMode, type Actor, type Env } from "./env";
import { bump, checkCsrf, clientIp, createSession, destroySession, getAuth, login, overLimit, type AuthContext } from "./auth";
import { html, json, newNonce, redirect, safeNext, securityHeaders, zonedToUtc } from "./http";
import { authFormPage, consentPage, dashboardPage, legalPage, loginPage, messagePage, setupPage } from "./ui";
import { audit, cancelPost, createPost, editPost, getPostFor, getPostRow, listPosts, recentAudit, retryPost } from "./db";
import { overview } from "./overview";
import { analytics, calendar } from "./insights";
import { youtubeStats } from "./youtube-stats";
import { listBrandMedia } from "./library";
import { ADAPTERS, connectionStatus, deleteConnection, saveConnection } from "./connections";
import { BRAND_ID_RE, clearBrandStorage, createBrand, deleteBrand, getBrand, getBrandRow, isValidTimezone, listBrands, setBrandStorage, updateBrand } from "./brands";
import { MAX_UPLOAD_MB, clearAccountStorage, linkBrand, openStoredMedia, setAccountStorage, toAccountStorage, uploadToStorage, verifyMediaSig } from "./storage";
import { b64url, base32Encode, randomBytes, randomToken, sha256, sha256Hex, verifyTotp } from "./crypto";
import { AppError, format, langFromRequest, localize, parseLang, type Lang } from "./i18n";
import { emailConfigured } from "./email";
import {
  changePassword,
  getUser,
  getUserTotp,
  listUsers,
  peekToken,
  requestPasswordReset,
  resetPassword,
  setUserStatus,
  setUserTotp,
  signup,
  verifyEmail,
} from "./users";
import { verifyPassword } from "./crypto";

async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("Content-Length") || 0) > 64 * 1024) throw new AppError("err.too_large");
  if (!(req.headers.get("Content-Type") || "").includes("application/json")) throw new AppError("err.json_expected");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("err.bad_body");
  return body as Record<string, unknown>;
}

async function handleApi(req: Request, env: Env, url: URL, auth: AuthContext, lang: Lang): Promise<Response> {
  const { actor, session } = auth;
  const path = url.pathname;
  if (req.method !== "GET" && !checkCsrf(req, session)) return json({ error: format(lang, "err.csrf") }, 403);
  try {
    if (path === "/api/me" && req.method === "GET") {
      const u = await getUser(env, actor.id);
      return json({
        user: { id: actor.id, email: actor.email, role: actor.role, two_factor: actor.role === "superadmin" || Boolean(u?.totp_enc), password_managed: !u?.password_hash },
        csrf: session.csrf,
        lang,
        registration: registrationMode(env),
        email_configured: emailConfigured(env),
      });
    }
    if (path === "/api/overview" && req.method === "GET") return json(await overview(env, actor, url.searchParams.get("brand") || "", lang));
    if (path === "/api/calendar" && req.method === "GET") return json(await calendar(env, actor, url.searchParams.get("brand") || "", url.searchParams.get("month") || undefined, lang));
    if (path === "/api/youtube/stats" && req.method === "GET") return json(await youtubeStats(env, actor, url.searchParams.get("brand") || ""));
    if (path === "/api/analytics" && req.method === "GET") return json(await analytics(env, actor, url.searchParams.get("brand") || "", url.searchParams.get("days"), lang));
    if (path === "/api/activity" && req.method === "GET") return json({ activity: await recentAudit(env, actor, lang, 60) });

    // ---- Account ----
    if (path === "/api/account/storage" && req.method === "GET") {
      const me = await getUser(env, actor.id);
      return json({ storage: me ? toAccountStorage(me) : null });
    }
    if (path === "/api/account/storage" && req.method === "POST") {
      const r = await setAccountStorage(env, actor, await readJson(req));
      await audit(env, `ui:${actor.email}`, "account.storage_set", `${r.storage.repo}/${r.storage.path} brands=${r.linked}`, { user: actor.id });
      return json(r);
    }
    if (path === "/api/account/storage/delete" && req.method === "POST") {
      await clearAccountStorage(env, actor);
      await audit(env, `ui:${actor.email}`, "account.storage_removed", "", { user: actor.id });
      return json({ ok: true });
    }
    if (path === "/api/account/password" && req.method === "POST") {
      const b = await readJson(req);
      await changePassword(env, actor, String(b.current || ""), String(b.next || ""));
      return json({ ok: true, relogin: true });
    }
    if (path === "/api/account/2fa/start" && req.method === "POST") {
      if (isSuper(actor)) throw new AppError("u.totp_required_admin");
      const secret = base32Encode(randomBytes(20));
      await env.SESSIONS.put(`totp_pending:${actor.id}`, secret, { expirationTtl: 600 });
      return json({ secret, uri: `otpauth://totp/Kervly:${encodeURIComponent(actor.email)}?secret=${secret}&issuer=Kervly` });
    }
    if (path === "/api/account/2fa/confirm" && req.method === "POST") {
      const b = await readJson(req);
      const secret = await env.SESSIONS.get(`totp_pending:${actor.id}`);
      if (!secret || (await verifyTotp(secret, String(b.code || ""))) === null) throw new AppError("u.totp_invalid");
      await setUserTotp(env, actor.id, secret);
      await env.SESSIONS.delete(`totp_pending:${actor.id}`);
      await audit(env, `ui:${actor.email}`, "user.2fa_enabled", "", { user: actor.id });
      return json({ ok: true });
    }
    if (path === "/api/account/2fa/disable" && req.method === "POST") {
      const b = await readJson(req);
      const u = await getUser(env, actor.id);
      if (!u?.password_hash || !(await verifyPassword(String(b.password || ""), u.password_hash))) throw new AppError("u.password_wrong");
      await setUserTotp(env, actor.id, null);
      await audit(env, `ui:${actor.email}`, "user.2fa_disabled", "", { user: actor.id });
      return json({ ok: true });
    }

    // ---- Administration (superadmin) ----
    if (path.startsWith("/api/admin/")) {
      if (!isSuper(actor)) return json({ error: format(lang, "err.forbidden") }, 403);
      if (path === "/api/admin/users" && req.method === "GET") return json({ users: await listUsers(env, actor), registration: registrationMode(env), email_configured: emailConfigured(env) });
      const am = /^\/api\/admin\/users\/(u_[A-Za-z0-9_-]{6,20})\/(approve|disable|enable)$/.exec(path);
      if (am && req.method === "POST") {
        await setUserStatus(env, actor, url.origin, lang, am[1], am[2] as "approve" | "disable" | "enable");
        return json({ ok: true });
      }
      if (path === "/api/admin/stats" && req.method === "GET") {
        const r = await env.DB.prepare(
          `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending,
                  (SELECT COUNT(*) FROM brands) AS brands, (SELECT COUNT(*) FROM connections) AS connections,
                  (SELECT COUNT(*) FROM posts WHERE status = 'scheduled') AS scheduled,
                  (SELECT COUNT(*) FROM posts WHERE status = 'published' AND publish_at > ?) AS published_7d,
                  (SELECT COUNT(*) FROM posts WHERE status = 'error') AS errors`,
        )
          .bind(Date.now() - 7 * 86400_000)
          .first();
        return json(r);
      }
    }

    // ---- Brands ----
    if (path === "/api/brands" && req.method === "GET") {
      return json({ brands: await listBrands(env, actor), hosts: env.MEDIA_ALLOWED_HOSTS, max_upload_mb: MAX_UPLOAD_MB });
    }
    if (path === "/api/brands" && req.method === "POST") {
      let b = await createBrand(env, actor, await readJson(req));
      await audit(env, `ui:${actor.email}`, "brand.create", b.id, { user: actor.id, brand: b.id });
      // The account's GitHub storage is shared: the new brand gets its own folder in it
      const me = await getUser(env, actor.id);
      let folder: "created" | "failed" | null = null;
      if (me?.storage_repo && me.storage_token_enc) {
        folder = (await linkBrand(env, me, b.id)) ? "created" : "failed";
        b = await getBrand(env, b.id, actor);
        await audit(env, `ui:${actor.email}`, "brand.storage_linked", `${b.id} ${b.storage?.repo ?? ""}/${b.storage?.path ?? ""} folder=${folder}`, { user: actor.id, brand: b.id });
      }
      return json({ ...b, folder });
    }
    const sm = /^\/api\/brands\/([a-z0-9-]{2,32})\/storage(\/delete)?$/.exec(path);
    if (sm && req.method === "POST") {
      const b = sm[2] ? await clearBrandStorage(env, actor, sm[1]) : await setBrandStorage(env, actor, sm[1], await readJson(req));
      await audit(env, `ui:${actor.email}`, sm[2] ? "brand.storage_removed" : "brand.storage_set", `${b.id} ${b.storage?.repo ?? ""}`, { user: actor.id, brand: b.id });
      return json(b);
    }
    const mm = /^\/api\/brands\/([a-z0-9-]{2,32})\/media$/.exec(path);
    if (mm && req.method === "GET") return json({ media: await listBrandMedia(env, await getBrandRow(env, mm[1], actor)) });
    const um = /^\/api\/brands\/([a-z0-9-]{2,32})\/upload$/.exec(path);
    if (um && req.method === "POST") {
      const row = await getBrandRow(env, um[1], actor);
      const size = Number(req.headers.get("Content-Length") || 0);
      if (!req.body) throw new AppError("err.bad_body");
      const file = await uploadToStorage(env, row, String(url.searchParams.get("name") || ""), req.body, size, actor.email);
      await audit(env, `ui:${actor.email}`, "media.upload", `${row.id}/${file.name} ${(size / 1048576).toFixed(1)}MB`, { user: actor.id, brand: row.id });
      return json(file);
    }
    const bm = /^\/api\/brands\/([a-z0-9-]{2,32})(\/delete)?$/.exec(path);
    if (bm && req.method === "POST") {
      if (bm[2]) {
        await deleteBrand(env, actor, bm[1]);
        await audit(env, `ui:${actor.email}`, "brand.delete", bm[1], { user: actor.id });
        return json({ ok: true });
      }
      const b = await updateBrand(env, actor, bm[1], await readJson(req));
      await audit(env, `ui:${actor.email}`, "brand.update", `${b.id} limit=${b.max_posts_per_day} tz=${b.timezone}`, { user: actor.id, brand: b.id });
      return json(b);
    }

    // ---- Connections ----
    if (path === "/api/connections" && req.method === "GET") {
      return json({ connections: await connectionStatus(env, actor, url.searchParams.get("brand") || undefined) });
    }
    const cm = /^\/api\/connections\/([a-z0-9-]{2,32})\/([a-z]+)\/delete$/.exec(path);
    if (cm && req.method === "POST" && isPlatform(cm[2])) {
      await getBrand(env, cm[1], actor);
      await deleteConnection(env, cm[1], cm[2], `ui:${actor.email}`);
      return json({ ok: true });
    }

    // ---- Posts ----
    if (path === "/api/posts" && req.method === "GET") {
      const q = url.searchParams;
      const posts = await listPosts(
        env,
        actor,
        {
          brand: q.get("brand") || undefined,
          status: q.get("status") || undefined,
          platform: q.get("platform") || undefined,
          from: q.get("from") ? Date.parse(q.get("from")!) : undefined,
          to: q.get("to") ? Date.parse(q.get("to")!) : undefined,
          limit: Number(q.get("limit")) || 100,
        },
        lang,
      );
      return json({ posts });
    }
    if (path === "/api/posts" && req.method === "POST") {
      const b = await readJson(req);
      const brand = await getBrand(env, b.brand, actor);
      const platforms = Array.isArray(b.platforms) ? b.platforms : [];
      if (!platforms.length || platforms.length > 3) throw new AppError("v.platforms_required");
      const when = typeof b.publish_at_local === "string" ? zonedToUtc(b.publish_at_local, brand.timezone) : b.publish_at;
      const created = [];
      const errors = [];
      for (const platform of [...new Set(platforms)]) {
        try {
          created.push(
            await createPost(
              env,
              actor,
              brand.id,
              {
                platform,
                media_url: b.media_url,
                title: b.title,
                caption: b.caption,
                tags: platform === "youtube" ? b.tags : undefined,
                publish_at: when,
                options: (b.options as Record<string, unknown> | undefined)?.[platform as string],
              },
              "ui",
              lang,
            ),
          );
        } catch (e) {
          errors.push({ platform, error: localize(e, lang) });
        }
      }
      if (!created.length) return json({ error: errors.map((e) => `${e.platform}: ${e.error}`).join("; ") }, 400);
      return json({ created, errors });
    }
    const pm = /^\/api\/posts\/(p_[A-Za-z0-9_-]{6,20})\/(cancel|retry|edit)$/.exec(path);
    if (pm && req.method === "POST") {
      if (pm[2] === "cancel") return json(await cancelPost(env, actor, pm[1], "ui", lang));
      if (pm[2] === "retry") return json(await retryPost(env, actor, pm[1], "ui", lang));
      const b = await readJson(req);
      const row = await getPostFor(env, pm[1], actor);
      const brand = await getBrand(env, row.brand_id, actor);
      const input: Record<string, unknown> = { media_url: b.media_url, title: b.title, caption: b.caption, tags: b.tags, options: b.options };
      if (typeof b.publish_at_local === "string") input.publish_at = zonedToUtc(b.publish_at_local, brand.timezone);
      else if (b.publish_at !== undefined) input.publish_at = b.publish_at;
      return json(await editPost(env, actor, pm[1], input, "ui", lang));
    }
    return json({ error: format(lang, "err.not_found") }, 404);
  } catch (e) {
    if (!(e instanceof AppError)) console.error("api error", e);
    return json({ error: e instanceof AppError ? localize(e, lang) : format(lang, "err.internal") }, e instanceof AppError ? 400 : 500);
  }
}

/** OAuth connection of a brand's platform account: /connect/<platform>?brand=<id> and its callback. */
async function handleConnect(req: Request, env: Env, url: URL, auth: AuthContext, lang: Lang): Promise<Response> {
  const { actor, session } = auth;
  const m = /^\/connect\/([a-z]+)(\/callback)?$/.exec(url.pathname);
  if (!m || !isPlatform(m[1])) return new Response(format(lang, "err.not_found"), { status: 404 });
  const platform = m[1];
  const adapter = ADAPTERS[platform];
  const redirectUri = `${url.origin}/connect/${platform}/callback`;
  const fail = (e: unknown) => redirect(`/?error=${encodeURIComponent(localize(e, lang).slice(0, 200))}#/setup`);
  if (!adapter.configured(env)) return fail(new AppError("c.app_keys", { platform }));

  if (!m[2]) {
    const brandId = url.searchParams.get("brand") || "";
    if (!BRAND_ID_RE.test(brandId)) return fail(new AppError("c.no_brand"));
    try {
      await getBrand(env, brandId, actor);
    } catch (e) {
      return fail(e);
    }
    // State + PKCE, bound to this session, valid for 10 minutes
    const state = randomToken(24);
    const verifier = randomToken(48);
    await env.SESSIONS.put(
      `os:${await sha256Hex(state)}`,
      JSON.stringify({ platform, brand: brandId, verifier, uid: actor.id, csrf: await sha256Hex(session.csrf) }),
      { expirationTtl: 600 },
    );
    return redirect(adapter.authUrl(env, redirectUri, state, b64url(await sha256(verifier))));
  }

  // Callback: the state is single-use and must belong to this session and user
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const key = `os:${await sha256Hex(state)}`;
  const raw = state ? await env.SESSIONS.get(key) : null;
  if (raw) await env.SESSIONS.delete(key);
  const saved = raw ? (JSON.parse(raw) as { platform: string; brand: string; verifier: string; uid: string; csrf: string }) : null;
  if (!saved || saved.platform !== platform || saved.uid !== actor.id || saved.csrf !== (await sha256Hex(session.csrf))) return fail(new AppError("c.state"));
  if (url.searchParams.get("error") || !code) return fail(new AppError("c.denied", { platform }));
  try {
    await getBrand(env, saved.brand, actor);
    const acc = await adapter.exchange(env, code, redirectUri, saved.verifier);
    await saveConnection(env, saved.brand, platform, acc);
    await audit(env, `ui:${actor.email}`, "connection.create", `${saved.brand}/${platform} ${acc.account_name}`, { user: actor.id, brand: saved.brand });
    return redirect(`/?connected=${platform}&brand=${encodeURIComponent(saved.brand)}#/setup`);
  } catch (e) {
    await audit(env, `ui:${actor.email}`, "connection.error", `${saved.brand}/${platform} ${localize(e, "en")}`, { user: actor.id, brand: saved.brand });
    return fail(e);
  }
}

/** MCP OAuth consent: the signed-in user approves a client to act on their own brands. */
async function handleAuthorize(req: Request, env: Env, url: URL, auth: AuthContext | null, lang: Lang): Promise<Response> {
  const nonce = newNonce();
  if (!auth) return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  const { actor } = auth;
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (req.method === "GET") {
      const ar = await oauth.parseAuthRequest(req);
      const details = await oauth.describeConsent(ar);
      const consent = await oauth.beginConsent(ar);
      const headers = new Headers(consent.headers);
      // form-action must allow the redirect to the client (https or a local MCP client)
      for (const [k, v] of Object.entries(securityHeaders(nonce, "https: http://localhost:* http://127.0.0.1:* http://[::1]:*"))) headers.set(k, v);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(consentPage(lang, nonce, details, consent.handle, actor.email), { headers });
    }
    if (req.method === "POST") {
      const origin = req.headers.get("Origin");
      if (origin && origin !== url.origin) return new Response(format(lang, "err.bad_origin"), { status: 403 });
      const form = await req.formData();
      const handle = String(form.get("handle") || "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(req, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(req, handle, { scope: form.getAll("scope").map(String) });
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: actor.id,
        metadata: { approvedAt: Date.now() },
        scope: approved.request.scope,
        props: { userId: actor.id, ver: (await getUser(env, actor.id))?.session_version ?? 0 },
      });
      await audit(env, `ui:${actor.email}`, "mcp.authorize", approved.request.clientId, { user: actor.id });
      approved.headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers: approved.headers });
    }
    return new Response(null, { status: 405 });
  } catch (error) {
    const redirectTo = (error as { redirectTo?: string }).redirectTo;
    if (error instanceof AuthorizationError && redirectTo) return redirect(redirectTo);
    if (error instanceof AuthorizationError) {
      const desc = (error as { description?: string }).description || error.message;
      return html(messagePage(lang, nonce, format(lang, "oauth.error"), desc), nonce, { status: 400 });
    }
    if (error instanceof Error && error.name === "CimdFetchError") {
      return html(messagePage(lang, nonce, format(lang, "oauth.error"), format(lang, "oauth.unverified")), nonce, { status: 400 });
    }
    throw error;
  }
}

/** Short-lived signed link that streams a post's video from private storage (for Instagram). */
async function handleSignedMedia(req: Request, env: Env, url: URL): Promise<Response> {
  const m = /^\/m\/(p_[A-Za-z0-9_-]{6,20})\.mp4$/.exec(url.pathname);
  if (!m || (req.method !== "GET" && req.method !== "HEAD")) return new Response(null, { status: 404 });
  if (!(await verifyMediaSig(env, m[1], url.searchParams.get("e"), url.searchParams.get("s")))) return new Response(null, { status: 403 });
  const post = await getPostRow(env, m[1]);
  if (!post) return new Response(null, { status: 404 });
  const brand = await getBrandRow(env, post.brand_id);
  const media = await openStoredMedia(env, brand, post.media_url);
  if (!media) return new Response(null, { status: 404 });
  const headers = { "Content-Type": "video/mp4", "Content-Length": String(media.size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (req.method === "HEAD") {
    await media.body.cancel();
    return new Response(null, { headers });
  }
  const { readable, writable } = new FixedLengthStream(media.size);
  void media.body.pipeTo(writable).catch(() => undefined);
  return new Response(readable, { headers });
}

const LOGIN_REASON: Record<string, string> = {
  limited: "login.limited",
  invalid: "login.invalid",
  not_configured: "login.not_configured",
  pending: "login.pending",
  unverified: "login.unverified",
  disabled: "login.disabled",
  code_required: "login.code_required",
};

async function handleAccountPages(req: Request, env: Env, url: URL, lang: Lang, nonce: string): Promise<Response | null> {
  const path = url.pathname;
  const mode = registrationMode(env);
  const sameOrigin = () => {
    const o = req.headers.get("Origin");
    return !o || o === url.origin;
  };

  if (path === "/login") {
    if (req.method === "GET") return html(loginPage(lang, nonce, safeNext(url.searchParams.get("next")), mode !== "closed"), nonce);
    if (req.method !== "POST") return new Response(null, { status: 405 });
    if (!sameOrigin()) return new Response(format(lang, "err.bad_origin"), { status: 403 });
    const f = await req.formData();
    const next = safeNext(String(f.get("next") || "/"));
    const r = await login(req, env, String(f.get("email") || ""), String(f.get("password") || ""), String(f.get("code") || ""));
    if (!r.ok) {
      await audit(env, "anon", "login.fail", `${r.reason}${r.why ? ":" + r.why : ""} ${String(f.get("email") || "").slice(0, 80)}`);
      return html(loginPage(lang, nonce, next, mode !== "closed", format(lang, LOGIN_REASON[r.reason]), String(f.get("email") || "")), nonce, {
        status: r.reason === "limited" ? 429 : 401,
      });
    }
    await audit(env, `ui:${r.user.email}`, "login.ok", "", { user: r.user.id });
    return redirect(next, { "Set-Cookie": await createSession(env, r.user) });
  }

  if (path === "/signup") {
    if (mode === "closed") return html(messagePage(lang, nonce, format(lang, "u.registration_closed"), "", "/login"), nonce, { status: 403 });
    if (req.method === "GET") return html(authFormPage(lang, nonce, "signup"), nonce);
    if (req.method !== "POST" || !sameOrigin()) return new Response(null, { status: 403 });
    const f = await req.formData();
    const ipKey = `signup:${clientIp(req)}`;
    if (await overLimit(env, ipKey, 5)) return html(authFormPage(lang, nonce, "signup", format(lang, "login.limited")), nonce, { status: 429 });
    if (f.get("terms") !== "on") return html(authFormPage(lang, nonce, "signup", format(lang, "u.terms_required")), nonce, { status: 400 });
    try {
      await signup(env, url.origin, lang, f.get("email"));
    } catch (e) {
      return html(authFormPage(lang, nonce, "signup", localize(e, lang)), nonce, { status: 400 });
    }
    await bump(env, ipKey, 3600);
    return html(messagePage(lang, nonce, format(lang, "u.check_inbox_title"), format(lang, "u.check_inbox"), "/login"), nonce);
  }

  if (path === "/verify") {
    const invalid = () => html(messagePage(lang, nonce, format(lang, "u.link_invalid_title"), format(lang, "u.link_invalid"), "/signup"), nonce, { status: 400 });
    if (req.method === "GET") {
      const token = url.searchParams.get("token") || "";
      return (await peekToken(env, token, "verify")) ? html(authFormPage(lang, nonce, "verify", "", token), nonce) : invalid();
    }
    if (req.method !== "POST" || !sameOrigin()) return new Response(null, { status: 403 });
    const f = await req.formData();
    const t = String(f.get("token") || "");
    let status;
    try {
      if (String(f.get("password")) !== String(f.get("password2"))) throw new AppError("u.password_mismatch");
      status = await verifyEmail(env, t, String(f.get("password") || ""));
    } catch (e) {
      return html(authFormPage(lang, nonce, "verify", localize(e, lang), t), nonce, { status: 400 });
    }
    if (!status) return invalid();
    const msg = status === "active" ? "u.verified_active" : "u.verified_pending";
    return html(messagePage(lang, nonce, format(lang, "u.verified_title"), format(lang, msg), "/login"), nonce);
  }

  if (path === "/forgot") {
    if (req.method === "GET") return html(authFormPage(lang, nonce, "forgot"), nonce);
    if (req.method !== "POST" || !sameOrigin()) return new Response(null, { status: 403 });
    const f = await req.formData();
    const ipKey = `forgot:${clientIp(req)}`;
    if (!(await overLimit(env, ipKey, 5))) {
      await bump(env, ipKey, 3600);
      await requestPasswordReset(env, url.origin, lang, f.get("email"));
    }
    // Same answer whether or not the account exists
    return html(messagePage(lang, nonce, format(lang, "u.check_inbox_title"), format(lang, "u.reset_sent"), "/login"), nonce);
  }

  if (path === "/reset") {
    const token = url.searchParams.get("token") || "";
    if (req.method === "GET") return html(authFormPage(lang, nonce, "reset", "", token), nonce);
    if (req.method !== "POST" || !sameOrigin()) return new Response(null, { status: 403 });
    const f = await req.formData();
    const t = String(f.get("token") || "");
    try {
      if (String(f.get("password")) !== String(f.get("password2"))) throw new AppError("u.password_mismatch");
      const ok = await resetPassword(env, t, String(f.get("password") || ""));
      if (!ok) return html(messagePage(lang, nonce, format(lang, "u.link_invalid_title"), format(lang, "u.link_invalid"), "/forgot"), nonce, { status: 400 });
    } catch (e) {
      return html(authFormPage(lang, nonce, "reset", localize(e, lang), t), nonce, { status: 400 });
    }
    return html(messagePage(lang, nonce, format(lang, "u.reset_done_title"), format(lang, "u.reset_done"), "/login"), nonce);
  }
  return null;
}

export const app: ExportedHandler<Env> = {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const nonce = newNonce();
    const lang = langFromRequest(req, parseLang(env.DEFAULT_LANG) ?? "en");
    const defaultTz = isValidTimezone(env.DEFAULT_TIMEZONE) ? env.DEFAULT_TIMEZONE : "UTC";

    // ?lang=xx → remember the choice in a cookie and drop it from the URL
    if (req.method === "GET" && parseLang(url.searchParams.get("lang"))) {
      url.searchParams.delete("lang");
      return redirect(url.pathname + url.search, { "Set-Cookie": `lang=${lang}; Path=/; Secure; SameSite=Lax; Max-Age=31536000` });
    }

    if (path === "/privacy" || path === "/terms") return html(legalPage(lang, nonce, path === "/privacy" ? "privacy" : "terms"), nonce);
    if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (path === "/healthz") return new Response("ok", { headers: { "Cache-Control": "no-store" } });

    const missing = missingCoreSecrets(env);
    if (missing.length) return path === "/setup" ? html(setupPage(lang, nonce, missing), nonce) : redirect("/setup");
    if (path === "/setup") return new Response(format(lang, "err.not_found"), { status: 404 });

    if (path.startsWith("/m/")) return handleSignedMedia(req, env, url);

    const page = await handleAccountPages(req, env, url, lang, nonce);
    if (page) return page;

    const auth = await getAuth(req, env);

    if (path === "/authorize") return handleAuthorize(req, env, url, auth, lang);

    if (path === "/logout" && req.method === "POST") {
      if (!auth || !checkCsrf(req, auth.session)) return new Response(null, { status: 403 });
      return redirect("/login", { "Set-Cookie": await destroySession(req, env) });
    }

    if (path.startsWith("/api/")) {
      if (!auth) return json({ error: format(lang, "err.login_required") }, 401);
      return handleApi(req, env, url, auth, lang);
    }

    if (!auth) return redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
    if (path.startsWith("/connect/")) return handleConnect(req, env, url, auth, lang);
    if (path === "/" && req.method === "GET") return html(dashboardPage(lang, nonce, defaultTz, auth.actor), nonce);
    return html(messagePage(lang, nonce, format(lang, "err.not_found"), path), nonce, { status: 404 });
  },
};

export type { Actor };
