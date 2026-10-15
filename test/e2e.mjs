// Local end-to-end test: node test/e2e.mjs (while `npm run dev` is running with .dev.vars)
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomBytes } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:8787";
const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split("\n").filter(Boolean).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const PASSWORD = process.env.TEST_PASSWORD || "test-password-1234";
const ADMIN_EMAIL = vars.SUPERADMIN_EMAIL || "admin";

let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log("✓", name); } else { fail++; console.log("✗", name, extra); }
}
function b32dec(s) { const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, v = 0; const o = []; for (const c of s) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); }
function totp(secret, offset = 0) {
  const ctr = Math.floor(Date.now() / 30000) + offset; const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(ctr));
  const h = createHmac("sha1", b32dec(secret)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}
const b64url = (b) => Buffer.from(b).toString("base64url");

async function login(code) {
  const r = await fetch(`${BASE}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ email: ADMIN_EMAIL, password: PASSWORD, code, next: "/" }) });
  return r;
}

// 1) Protected pages
let r = await fetch(`${BASE}/api/posts`, { redirect: "manual" });
check("API without session → 401", r.status === 401);
r = await fetch(`${BASE}/setup`, { redirect: "manual" });
check("/setup is 404 after setup", r.status === 404);
r = await fetch(`${BASE}/privacy`);
check("privacy page is public", r.status === 200 && (await r.text()).includes("Privacy"));
check("CSP header present", (r.headers.get("content-security-policy") || "").includes("frame-ancestors 'none'"));

// 2) Failed login
r = await login("000000");
check("wrong TOTP code rejected", r.status === 401);

// 3) Successful login
r = await login(totp(vars.ADMIN_TOTP_SECRET));
check("valid login → 302", r.status === 302, r.status);
const setCookie = r.headers.get("set-cookie") || "";
check("cookie is HttpOnly+Secure", /HttpOnly/.test(setCookie) && /Secure/.test(setCookie));
const cookie = setCookie.split(";")[0];
// The same code cannot be reused
r = await login(totp(vars.ADMIN_TOTP_SECRET));
check("TOTP code cannot be reused", r.status === 401);

const me = await (await fetch(`${BASE}/api/me`, { headers: { cookie } })).json();
check("session works", Boolean(me.csrf));
const H = { cookie, "Content-Type": "application/json", "X-CSRF-Token": me.csrf };

// 4) CSRF
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: "{}" });
check("write without CSRF token → 403", r.status === 403);

// 5) Brands
r = await fetch(`${BASE}/api/brands`, { method: "POST", headers: H, body: JSON.stringify({ id: "demo", name: "Demo", media_prefixes: ["https://raw.githubusercontent.com/example/videos/main/clips/"], max_posts_per_day: 5, timezone: "Asia/Dubai" }) });
check("create brand", r.status === 200, await r.clone().text());
r = await fetch(`${BASE}/api/brands`, { method: "POST", headers: H, body: JSON.stringify({ id: "second", name: "Second", media_prefixes: ["https://evil.com/a/b/"] }) });
check("prefix on a disallowed host rejected", r.status === 400);
r = await fetch(`${BASE}/api/brands`, { method: "POST", headers: H, body: JSON.stringify({ id: "second", name: "Second", media_prefixes: ["https://raw.githubusercontent.com/example/other/main/clips/"] }) });
check("second brand", r.status === 200);

// 6) Create posts (dashboard)
const media = "https://raw.githubusercontent.com/example/videos/main/clips/demo.mp4";
{
  let a = await (await fetch(`${BASE}/api/account/storage`, { headers: { cookie } })).json();
  check("account storage starts empty", a.storage === null, JSON.stringify(a));
  r = await fetch(`${BASE}/api/account/storage`, { method: "POST", headers: H, body: JSON.stringify({ repo: "not a repo", token: "x" }) });
  check("account storage rejects a bad repo", r.status === 400);
  r = await fetch(`${BASE}/api/account/storage`, { method: "POST", headers: H, body: JSON.stringify({ repo: "owner/name" }) });
  check("account storage needs a token the first time", r.status === 400);
  r = await fetch(`${BASE}/api/brands`, { method: "POST", headers: H, body: JSON.stringify({ id: "nostore", name: "No store" }) });
  const nb = await r.json();
  check("brand without account storage gets no folder", r.status === 200 && nb.folder === null && nb.storage === null, JSON.stringify(nb).slice(0, 200));
  await fetch(`${BASE}/api/brands/nostore/delete`, { method: "POST", headers: H });
}

{
  const c = await (await fetch(`${BASE}/api/calendar?brand=demo`, { headers: { cookie } })).json();
  check("dashboard calendar API", /^\d{4}-\d{2}$/.test(c.month ?? "") && c.days?.length >= 28 && c.max_posts_per_day === 5, JSON.stringify(c).slice(0, 200));
  const a = await (await fetch(`${BASE}/api/analytics?brand=demo&days=90`, { headers: { cookie } })).json();
  check("dashboard analytics API", a.days === 90 && a.series?.length === 90 && a.totals, JSON.stringify(a).slice(0, 200));
  r = await fetch(`${BASE}/api/calendar?brand=demo&month=nope`, { headers: { cookie } });
  check("calendar API rejects a bad month", r.status === 400);
}

const when = new Date(Date.now() + 2 * 86400_000);
const localWhen = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(when).replace(" ", "T");
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: H, body: JSON.stringify({ brand: "demo", platforms: ["youtube", "tiktok"], media_url: media, title: "Test", caption: "Description", tags: ["demo"], publish_at_local: localWhen }) });
let j = await r.json();
check("2 posts from the dashboard", r.status === 200 && j.created?.length === 2, JSON.stringify(j));
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: H, body: JSON.stringify({ brand: "demo", platforms: ["youtube"], media_url: media, title: "Test", publish_at_local: localWhen }) });
check("duplicate post rejected", r.status === 400);
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: H, body: JSON.stringify({ brand: "demo", platforms: ["youtube"], media_url: "https://evil.com/x.mp4", title: "T", publish_at_local: localWhen }) });
check("URL outside allowlist rejected", r.status === 400);
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: { ...H, cookie: `${cookie}; lang=tr` }, body: JSON.stringify({ brand: "demo", platforms: ["youtube"], media_url: "https://evil.com/x.mp4", title: "T", publish_at_local: localWhen }) });
check("error message in Turkish (lang=tr)", (await r.json()).error.includes("izin"));
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: { ...H, cookie: `${cookie}; lang=en` }, body: JSON.stringify({ brand: "demo", platforms: ["youtube"], media_url: "https://evil.com/x.mp4", title: "T", publish_at_local: localWhen }) });
check("error message in English (lang=en)", (await r.json()).error.includes("not allowed"));
r = await fetch(`${BASE}/?lang=tr`, { headers: { cookie }, redirect: "manual" });
check("?lang sets cookie", r.status === 302 && (r.headers.get("set-cookie") || "").startsWith("lang=tr"));
r = await fetch(`${BASE}/api/posts`, { method: "POST", headers: H, body: JSON.stringify({ brand: "second", platforms: ["youtube"], media_url: media, title: "T", publish_at_local: localWhen }) });
check("another brand's video rejected", r.status === 400);

// 6b) Edit a scheduled post and read the overview
{
  const list = await (await fetch(`${BASE}/api/posts?brand=demo&status=scheduled`, { headers: { cookie } })).json();
  const target = list.posts.find((p) => p.platform === "youtube");
  r = await fetch(`${BASE}/api/posts/${target.id}/edit`, { method: "POST", headers: H, body: JSON.stringify({ title: "Edited title" }) });
  check("edit scheduled post", r.status === 200 && (await r.json()).title === "Edited title");
  const ov = await (await fetch(`${BASE}/api/overview?brand=demo`, { headers: { cookie } })).json();
  check("overview endpoint", typeof ov.counts?.upcoming === "number" && Array.isArray(ov.checklist?.platforms));
}

// 7) MCP without a token
r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
check("MCP without token → 401", r.status === 401);
check("WWW-Authenticate resource_metadata", (r.headers.get("www-authenticate") || "").includes("resource_metadata"));
r = await fetch(`${BASE}/.well-known/oauth-authorization-server`);
const meta = await r.json();
check("OAuth metadata", Boolean(meta.registration_endpoint && meta.token_endpoint));

// 7b) DCR + PKCE + consent
const redirect_uri = "https://claude.ai/api/mcp/auth_callback";
r = await fetch(`${BASE}/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Test Claude", redirect_uris: [redirect_uri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
const client = await r.json();
check("client registration", Boolean(client.client_id), JSON.stringify(client));
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const authQs = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri, state: "st123", code_challenge: challenge, code_challenge_method: "S256", scope: "publish", resource: `${BASE}/mcp` });
r = await fetch(`${BASE}/authorize?${authQs}`, { redirect: "manual" });
check("authorize without session → login", r.status === 302 && (r.headers.get("location") || "").startsWith("/login"));
r = await fetch(`${BASE}/authorize?${authQs}`, { headers: { cookie }, redirect: "manual" });
const page = await r.text();
const headers0 = r.headers;
check("consent page", r.status === 200 && page.includes("wants to connect"), r.status + page.slice(0, 200));
const consentCookie = (r.headers.get("set-cookie") || "").split(";")[0];
const handle = /name="handle" value="([^"]+)"/.exec(page)?.[1];
r = await fetch(`${BASE}/authorize`, { method: "POST", redirect: "manual", headers: { cookie: `${cookie}; ${consentCookie}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ handle, decision: "approve", scope: "publish" }) });
const loc = r.headers.get("location") || "";
check("approve → redirect to client", r.status === 302 && loc.startsWith(redirect_uri), r.status + " " + loc);
const code = new URL(loc).searchParams.get("code");
r = await fetch(`${BASE}/oauth/token`, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri, client_id: client.client_id, code_verifier: verifier, resource: `${BASE}/mcp` }) });
const tok = await r.json();
check("access token", Boolean(tok.access_token), JSON.stringify(tok));

// 8) MCP calls
const call = async (method, params, id = 1) => {
  const res = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
};
let m = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
check("MCP initialize", m.body?.result?.serverInfo?.name === "kervly");
check("notification → 202", (await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) })).status === 202);
m = await call("tools/list", {});
check("MCP tools/list", m.body?.result?.tools?.length === 17);
m = await call("tools/call", { name: "list_brands", arguments: {} });
check("MCP list_brands", m.body?.result?.structuredContent?.brands?.length === 2);
const when2 = new Date(Date.now() + 3 * 86400_000).toISOString().replace("Z", "+00:00");
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "demo", platforms: ["youtube", "instagram"], media_url: media, title: "MCP testi", caption: "c", tags: ["a"], publish_at: when2, options: { youtube: { privacy: "unlisted" } } } });
check("MCP schedule_post", m.body?.result?.structuredContent?.created?.length === 2, JSON.stringify(m.body));
const pid = m.body?.result?.structuredContent?.created?.[0]?.id;
m = await call("tools/call", { name: "list_posts", arguments: { status: "scheduled" } });
check("MCP list_posts", (m.body?.result?.structuredContent?.posts?.length ?? 0) >= 4);
m = await call("tools/call", { name: "cancel_post", arguments: { id: pid } });
check("MCP cancel_post", m.body?.result?.structuredContent?.status === "cancelled");
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "demo", platforms: ["youtube"], media_url: "https://raw.githubusercontent.com/x/y/main/videos/a.mp4", title: "t", publish_at: when2 } });
check("MCP URL outside allowlist → isError", m.body?.result?.isError === true);
// Calendar, auto-scheduling and analytics
m = await call("tools/call", { name: "get_calendar", arguments: { brand: "demo" } });
const cal = m.body?.result?.structuredContent;
check("MCP get_calendar returns the month", /^\d{4}-\d{2}$/.test(cal?.month ?? "") && cal?.days?.length >= 28, JSON.stringify(m.body).slice(0, 300));
m = await call("tools/call", { name: "get_calendar", arguments: { brand: "demo", month: "2026-13" } });
check("MCP get_calendar rejects a bad month", m.body?.result?.isError === true);
m = await call("tools/call", { name: "suggest_slots", arguments: { brand: "demo", platforms: ["youtube", "tiktok"], count: 3 } });
const slots = m.body?.result?.structuredContent?.slots;
check("MCP suggest_slots returns 3 future slots", slots?.length === 3 && slots.every((x) => Date.parse(x.publish_at) > Date.now() + 5 * 60_000), JSON.stringify(m.body).slice(0, 300));
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "demo", platforms: ["youtube"], media_url: media, title: "Auto slot" } });
const auto = m.body?.result?.structuredContent?.created?.[0];
check("MCP schedule_post without publish_at picks a free future slot", auto && Date.parse(auto.publish_at) > Date.now() + 5 * 60_000 && auto.status === "scheduled", JSON.stringify(m.body).slice(0, 300));
m = await call("tools/call", { name: "get_analytics", arguments: { brand: "demo", days: 7 } });
const an = m.body?.result?.structuredContent;
check("MCP get_analytics shape", an?.days === 7 && an?.series?.length === 7 && an?.totals && an?.by_platform?.youtube, JSON.stringify(m.body).slice(0, 300));
m = await call("tools/call", { name: "get_youtube_stats", arguments: { brand: "demo" } });
check("MCP get_youtube_stats without a connection → isError", m.body?.result?.isError === true);
m = await call("tools/call", { name: "get_youtube_videos", arguments: { brand: "demo" } });
check("MCP get_youtube_videos without a connection → isError", m.body?.result?.isError === true);
m = await call("tools/call", { name: "get_youtube_insights", arguments: { brand: "demo", days: 28 } });
check("MCP get_youtube_insights without a connection → isError", m.body?.result?.isError === true);
r = await fetch(`${BASE}/api/youtube/insights?brand=demo`, { headers: { cookie } });
check("dashboard insights API without a connection → 400", r.status === 400);
m = await call("tools/call", { name: "create_upload_link", arguments: { brand: "demo", file_name: "clip.mp4" } });
check("MCP create_upload_link without GitHub storage → isError", m.body?.result?.isError === true);
m = await call("tools/call", { name: "upload_video", arguments: { brand: "demo", source_url: "http://127.0.0.1/a.mp4" } });
check("MCP upload_video refuses a private/plain-http source", m.body?.result?.isError === true);
r = await fetch(`${BASE}/upload/demo/clip.mp4?e=${Date.now() + 60000}&s=AAAA`, { method: "PUT", body: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) });
check("upload link with a bad signature → 403", r.status === 403);
r = await fetch(`${BASE}/upload/demo/clip.mp4`, { method: "GET" });
check("upload link only accepts PUT", r.status === 405);
m = await call("tools/call", { name: "get_calendar", arguments: {} });
check("MCP asks for a brand when the user has several", m.body?.result?.isError === true && /demo/.test(JSON.stringify(m.body)), JSON.stringify(m.body).slice(0, 200));
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "demo", platforms: ["youtube"], media_url: media, title: "Opts", publish_at: when2, options: { youtube: { language: "tr", license: "creativeCommon", aiGenerated: false, embeddable: true } } } });
check("MCP schedule_post accepts the extra YouTube options", m.body?.result?.structuredContent?.created?.[0]?.options?.language === "tr", JSON.stringify(m.body).slice(0, 300));
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "demo", platforms: ["youtube"], media_url: media, title: "Bad", publish_at: when2, options: { youtube: { language: "turkish!" } } } });
check("MCP schedule_post rejects a bad language code", m.body?.result?.isError === true);
m = await call("tools/call", { name: "get_analytics", arguments: { brand: "yok" } });
check("MCP get_analytics unknown brand → isError", m.body?.result?.isError === true);
m = await call("tools/call", { name: "connection_status", arguments: {} });
check("MCP connection_status has no tokens", !JSON.stringify(m.body).includes("access_token") && m.body?.result?.structuredContent?.connections?.length === 6);
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "yok", platforms: ["youtube"], media_url: media, title: "t", publish_at: when2 } });
check("MCP unknown brand → isError", m.body?.result?.isError === true);
r = await fetch(`${BASE}/login?next=${encodeURIComponent("/\t/evil.com")}`);
check("login next with control chars is sanitized", !(await r.text()).includes("evil.com"));
r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: "Bearer sahte.token.deger", "Content-Type": "application/json" }, body: "{}" });
check("fake token → 401", r.status === 401);

// 9) Multi-user: sign-up, approval, isolation
{
  const userEmail = `user${Date.now()}@example.com`;
  const userPass = "user-password-123";
  r = await fetch(`${BASE}/signup`, { method: "POST", body: new URLSearchParams({ email: userEmail, terms: "on" }) });
  check("sign-up accepted", r.status === 200);
  // Without an email provider the link is logged by the dev server
  await new Promise((res) => setTimeout(res, 500));
  const log = readFileSync(process.env.DEVLOG, "utf8");
  const token = [...log.matchAll(/\/verify\?token=([A-Za-z0-9_-]+)/g)].pop()?.[1];
  check("verification link issued", Boolean(token));
  r = await fetch(`${BASE}/verify?token=${token}`);
  check("verification page asks for a password", r.status === 200 && (await r.text()).includes('name="password2"'));
  r = await fetch(`${BASE}/verify`, { method: "POST", body: new URLSearchParams({ token, password: userPass, password2: userPass }) });
  check("password set on verification", r.status === 200);
  r = await fetch(`${BASE}/verify`, { method: "POST", body: new URLSearchParams({ token, password: "another-pass-123", password2: "another-pass-123" }) });
  check("verification link works once", r.status === 400);
  const tryLogin = (code = "") => fetch(`${BASE}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ email: userEmail, password: userPass, code, next: "/" }) });
  r = await tryLogin();
  check("unapproved user cannot sign in", r.status === 401);
  const users = await (await fetch(`${BASE}/api/admin/users`, { headers: { cookie } })).json();
  const u = users.users.find((x) => x.email === userEmail);
  check("admin sees the new user", Boolean(u));
  r = await fetch(`${BASE}/api/admin/users/${u.id}/approve`, { method: "POST", headers: H });
  check("admin approves", r.status === 200);
  r = await tryLogin();
  check("approved user signs in", r.status === 302);
  const ucookie = (r.headers.get("set-cookie") || "").split(";")[0];
  const ume = await (await fetch(`${BASE}/api/me`, { headers: { cookie: ucookie } })).json();
  const UH = { cookie: ucookie, "Content-Type": "application/json", "X-CSRF-Token": ume.csrf };
  const ub = await (await fetch(`${BASE}/api/brands`, { headers: { cookie: ucookie } })).json();
  check("user sees no foreign brands", ub.brands.length === 0);
  r = await fetch(`${BASE}/api/posts?brand=demo`, { headers: { cookie: ucookie } });
  const up = await r.json();
  check("user cannot list another brand's posts", (up.posts || []).length === 0);
  r = await fetch(`${BASE}/api/overview?brand=demo`, { headers: { cookie: ucookie } });
  check("user cannot open another brand", r.status === 400);
  r = await fetch(`${BASE}/api/calendar?brand=demo`, { headers: { cookie: ucookie } });
  check("user cannot open another brand's calendar", r.status === 400);
  r = await fetch(`${BASE}/api/analytics?brand=demo`, { headers: { cookie: ucookie } });
  check("user cannot open another brand's analytics", r.status === 400);
  r = await fetch(`${BASE}/api/admin/users`, { headers: { cookie: ucookie } });
  check("user cannot open admin API", r.status === 403);
  const adminPosts = await (await fetch(`${BASE}/api/posts?brand=demo&status=scheduled`, { headers: { cookie } })).json();
  r = await fetch(`${BASE}/api/posts/${adminPosts.posts[0].id}/cancel`, { method: "POST", headers: UH });
  check("user cannot cancel another user's post", r.status === 400);
  r = await fetch(`${BASE}/api/brands`, { method: "POST", headers: UH, body: JSON.stringify({ id: `ub${Date.now() % 100000}`, name: "User brand" }) });
  check("user creates own brand", r.status === 200);
  const all = await (await fetch(`${BASE}/api/brands`, { headers: { cookie } })).json();
  check("superadmin sees every brand", all.brands.some((b) => b.owner_email === userEmail));
  r = await fetch(`${BASE}/api/admin/users/${u.id}/disable`, { method: "POST", headers: H });
  r = await fetch(`${BASE}/api/me`, { headers: { cookie: ucookie } });
  check("disabled user's session ends", r.status === 401);
  r = await fetch(`${BASE}/api/brands/demo/storage`, { method: "POST", headers: H, body: JSON.stringify({ repo: "not a repo", token: "x" }) });
  check("storage input is validated", r.status === 400);
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
