import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { ADMIN_USER, isPlatform, missingCoreSecrets, type Env } from "./env";
import { checkCsrf, checkLogin, createSession, destroySession, getSession, type Session } from "./auth";
import { html, json, newNonce, redirect, safeNext, securityHeaders, zonedToUtc } from "./http";
import { consentPage, dashboardPage, legalPage, loginPage, messagePage, setupPage } from "./ui";
import { audit, cancelPost, createPost, listPosts, recentAudit, retryPost } from "./db";
import { ADAPTERS, connectionStatus, deleteConnection, saveConnection } from "./connections";
import { BRAND_ID_RE, createBrand, deleteBrand, getBrand, isValidTimezone, listBrands, updateBrand } from "./brands";
import { b64url, randomToken, sha256, sha256Hex } from "./crypto";
import { AppError, format, langFromRequest, localize, parseLang, type Lang } from "./i18n";

async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("Content-Length") || 0) > 64 * 1024) throw new AppError("err.too_large");
  if (!(req.headers.get("Content-Type") || "").includes("application/json")) throw new AppError("err.json_expected");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("err.bad_body");
  return body as Record<string, unknown>;
}

async function handleApi(req: Request, env: Env, url: URL, session: Session, lang: Lang): Promise<Response> {
  const path = url.pathname;
  if (req.method !== "GET" && !checkCsrf(req, session)) return json({ error: format(lang, "err.csrf") }, 403);
  try {
    if (path === "/api/me" && req.method === "GET") return json({ user: session.user, csrf: session.csrf, lang });
    if (path === "/api/activity" && req.method === "GET") return json({ activity: await recentAudit(env, lang, 40) });

    // Brands
    if (path === "/api/brands" && req.method === "GET") return json({ brands: await listBrands(env), hosts: env.MEDIA_ALLOWED_HOSTS });
    if (path === "/api/brands" && req.method === "POST") {
      const b = await createBrand(env, await readJson(req));
      await audit(env, "ui", "brand.create", `${b.id} ${JSON.stringify(b.media_prefixes)}`);
      return json(b);
    }
    const bm = /^\/api\/brands\/([a-z0-9-]{2,32})(\/delete)?$/.exec(path);
    if (bm && req.method === "POST") {
      if (bm[2]) {
        await deleteBrand(env, bm[1]);
        await audit(env, "ui", "brand.delete", bm[1]);
        return json({ ok: true });
      }
      const b = await updateBrand(env, bm[1], await readJson(req));
      await audit(env, "ui", "brand.update", `${b.id} ${JSON.stringify(b.media_prefixes)} limit=${b.max_posts_per_day} tz=${b.timezone}`);
      return json(b);
    }

    // Connections
    if (path === "/api/connections" && req.method === "GET") {
      return json({ connections: await connectionStatus(env, url.searchParams.get("brand") || undefined) });
    }
    const cm = /^\/api\/connections\/([a-z0-9-]{2,32})\/([a-z]+)\/delete$/.exec(path);
    if (cm && req.method === "POST" && isPlatform(cm[2])) {
      await getBrand(env, cm[1]);
      await deleteConnection(env, cm[1], cm[2], "ui");
      return json({ ok: true });
    }

    // Posts
    if (path === "/api/posts" && req.method === "GET") {
      const posts = await listPosts(
        env,
        {
          brand: url.searchParams.get("brand") || undefined,
          status: url.searchParams.get("status") || undefined,
          platform: url.searchParams.get("platform") || undefined,
          limit: Number(url.searchParams.get("limit")) || 100,
        },
        lang,
      );
      return json({ posts });
    }
    if (path === "/api/posts" && req.method === "POST") {
      const b = await readJson(req);
      const brand = await getBrand(env, b.brand);
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
              brand.id,
              { platform, media_url: b.media_url, title: b.title, caption: b.caption, tags: platform === "youtube" ? b.tags : undefined, publish_at: when },
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
    const pm = /^\/api\/posts\/(p_[A-Za-z0-9_-]{6,20})\/(cancel|retry)$/.exec(path);
    if (pm && req.method === "POST") {
      return json(pm[2] === "cancel" ? await cancelPost(env, pm[1], "ui", lang) : await retryPost(env, pm[1], "ui", lang));
    }
    return json({ error: format(lang, "err.not_found") }, 404);
  } catch (e) {
    if (!(e instanceof AppError)) console.error("api error", e);
    return json({ error: e instanceof AppError ? localize(e, lang) : format(lang, "err.internal") }, e instanceof AppError ? 400 : 500);
  }
}

/** OAuth connection of a brand's platform account: /connect/<platform>?brand=<id> and the callback. */
async function handleConnect(req: Request, env: Env, url: URL, session: Session, lang: Lang): Promise<Response> {
  const m = /^\/connect\/([a-z]+)(\/callback)?$/.exec(url.pathname);
  if (!m || !isPlatform(m[1])) return new Response(format(lang, "err.not_found"), { status: 404 });
  const platform = m[1];
  const adapter = ADAPTERS[platform];
  const redirectUri = `${url.origin}/connect/${platform}/callback`;
  const fail = (e: unknown) => redirect(`/?error=${encodeURIComponent(localize(e, lang).slice(0, 200))}`);
  if (!adapter.configured(env)) return fail(new AppError("c.app_keys", { platform }));

  if (!m[2]) {
    // Start: state + PKCE, bound to this session, valid for 10 minutes
    const brandId = url.searchParams.get("brand") || "";
    if (!BRAND_ID_RE.test(brandId)) return fail(new AppError("c.no_brand"));
    try {
      await getBrand(env, brandId);
    } catch (e) {
      return fail(e);
    }
    const state = randomToken(24);
    const verifier = randomToken(48);
    const challenge = b64url(await sha256(verifier));
    await env.SESSIONS.put(
      `os:${await sha256Hex(state)}`,
      JSON.stringify({ platform, brand: brandId, verifier, csrf: await sha256Hex(session.csrf) }),
      { expirationTtl: 600 },
    );
    return redirect(adapter.authUrl(env, redirectUri, state, challenge));
  }

  // Callback: the state is single-use and must belong to this session
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const key = `os:${await sha256Hex(state)}`;
  const raw = state ? await env.SESSIONS.get(key) : null;
  if (raw) await env.SESSIONS.delete(key);
  const saved = raw ? (JSON.parse(raw) as { platform: string; brand: string; verifier: string; csrf: string }) : null;
  if (!saved || saved.platform !== platform || saved.csrf !== (await sha256Hex(session.csrf))) return fail(new AppError("c.state"));
  if (url.searchParams.get("error") || !code) return fail(new AppError("c.denied", { platform }));
  try {
    const acc = await adapter.exchange(env, code, redirectUri, saved.verifier);
    await saveConnection(env, saved.brand, platform, acc);
    await audit(env, "ui", "connection.create", `${saved.brand}/${platform} ${acc.account_name}`);
    return redirect(`/?connected=${platform}&brand=${encodeURIComponent(saved.brand)}`);
  } catch (e) {
    await audit(env, "ui", "connection.error", `${saved.brand}/${platform} ${localize(e, "en")}`);
    return fail(e);
  }
}

/** MCP OAuth consent: only the signed-in admin can approve a client. */
async function handleAuthorize(req: Request, env: Env, url: URL, session: Session | null, lang: Lang): Promise<Response> {
  const nonce = newNonce();
  if (!session) return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
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
      return new Response(consentPage(lang, nonce, details, consent.handle), { headers });
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
        userId: ADMIN_USER,
        metadata: { approvedAt: Date.now() },
        scope: approved.request.scope,
        props: { userId: ADMIN_USER },
      });
      await audit(env, "ui", "mcp.authorize", approved.request.clientId);
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

    if (path === "/login") {
      if (req.method === "GET") return html(loginPage(lang, nonce, safeNext(url.searchParams.get("next"))), nonce);
      if (req.method === "POST") {
        const origin = req.headers.get("Origin");
        if (origin && origin !== url.origin) return new Response(format(lang, "err.bad_origin"), { status: 403 });
        const f = await req.formData();
        const next = safeNext(String(f.get("next") || "/"));
        const r = await checkLogin(req, env, String(f.get("password") || ""), String(f.get("code") || ""));
        if (!r.ok) {
          await audit(env, "anon", "login.fail", r.reason);
          return html(loginPage(lang, nonce, next, format(lang, `login.${r.reason}`)), nonce, { status: r.reason === "limited" ? 429 : 401 });
        }
        const { cookie } = await createSession(env);
        await audit(env, "ui", "login.ok", "");
        return redirect(next, { "Set-Cookie": cookie });
      }
      return new Response(null, { status: 405 });
    }

    const session = await getSession(req, env);

    if (path === "/authorize") return handleAuthorize(req, env, url, session, lang);

    if (path === "/logout" && req.method === "POST") {
      if (!session || !checkCsrf(req, session)) return new Response(null, { status: 403 });
      return redirect("/login", { "Set-Cookie": await destroySession(req, env) });
    }

    if (path.startsWith("/api/")) {
      if (!session) return json({ error: format(lang, "err.login_required") }, 401);
      return handleApi(req, env, url, session, lang);
    }

    if (!session) return redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
    if (path.startsWith("/connect/")) return handleConnect(req, env, url, session, lang);
    if (path === "/" && req.method === "GET") return html(dashboardPage(lang, nonce, defaultTz), nonce);
    return html(messagePage(lang, nonce, format(lang, "err.not_found"), path), nonce, { status: 404 });
  },
};
