// Local end-to-end test: node test/e2e.mjs (while `npm run dev` is running with .dev.vars)
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomBytes } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:8787";
const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split("\n").filter(Boolean).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const PASSWORD = process.env.TEST_PASSWORD || "test-password-1234";

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
  const r = await fetch(`${BASE}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ password: PASSWORD, code, next: "/" }) });
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
check("consent page", r.status === 200 && page.includes("is requesting access"), r.status + page.slice(0, 200));
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
check("MCP tools/list", m.body?.result?.tools?.length === 8);
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
m = await call("tools/call", { name: "connection_status", arguments: {} });
check("MCP connection_status has no tokens", !JSON.stringify(m.body).includes("access_token") && m.body?.result?.structuredContent?.connections?.length === 6);
m = await call("tools/call", { name: "schedule_post", arguments: { brand: "yok", platforms: ["youtube"], media_url: media, title: "t", publish_at: when2 } });
check("MCP unknown brand → isError", m.body?.result?.isError === true);
r = await fetch(`${BASE}/login?next=${encodeURIComponent("/\t/evil.com")}`);
check("login next with control chars is sanitized", !(await r.text()).includes("evil.com"));
r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: "Bearer sahte.token.deger", "Content-Type": "application/json" }, body: "{}" });
check("fake token → 401", r.status === 401);

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
