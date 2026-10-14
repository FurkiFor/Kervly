# Kervly

**Self-hosted video scheduler for YouTube Shorts, Instagram Reels and TikTok — with an MCP server.**
Multi-brand, secure by default, and free to run on Cloudflare Workers.

[Türkçe](README.tr.md) · [Self-hosting guide](docs/SELF_HOSTING.md) · [Security](SECURITY.md) · [kervly.app](https://kervly.app)

> *Kervan* is Turkish for caravan. Kervly carries your videos to every platform, on time.

```
Your AI agent (Claude…) ──MCP: schedule_post──▶ /mcp ──┐
Dashboard (browser)    ──/api (session + CSRF)───────▶ ├─▶ D1 queue
                                                       │
Cron (every 5 min) ──▶ due post ──▶ streams the .mp4 from your allowlisted URL ──▶ YouTube / Instagram / TikTok
```

## Why
Paid schedulers cap the number of posts per month. Kervly is a small app you own, running on Cloudflare's free tier. It talks
directly to the official platform APIs, and your AI agent can drive it through MCP.

## Features
- **Brands**: each brand has its own YouTube, Instagram and TikTok accounts, video allowlist, daily limit and time zone.
- **Dashboard**: brands, account connections, scheduling, post list with cancel/retry, audit log. English and Turkish.
- **MCP server** (`/mcp`, Streamable HTTP + OAuth 2.1): `list_brands`, `schedule_post`, `list_posts`, `get_post`,
  `cancel_post`, `retry_post`, `connection_status`, `recent_activity`.
- **Publisher**: YouTube resumable uploads, Instagram Reels containers, TikTok Direct Post. Videos are streamed, never
  buffered. Instagram and TikTok processing is tracked, and tokens are refreshed before they expire.

## Security
| Layer | Measure |
|---|---|
| Dashboard sign-in | Single admin. Password (PBKDF2-SHA256) **+ mandatory TOTP 2FA**, per-IP rate limit, TOTP codes cannot be reused. |
| Sessions | `__Host-` cookie, HttpOnly, Secure, SameSite=Lax, 8 h. Only a hash of the session token is stored. |
| CSRF | `X-CSRF-Token` header + Origin check on every write. |
| MCP | OAuth 2.1 with PKCE and dynamic client registration (`@cloudflare/workers-oauth-provider`). Tokens are issued only after the admin signs in and approves the client. 1 h access tokens. |
| Platform tokens | AES-256-GCM encrypted in D1, bound to brand + platform. Never returned by any API, log or MCP tool. |
| Least privilege | YouTube `youtube.upload` only. Instagram `instagram_business_basic`, `instagram_business_content_publish`. TikTok `user.info.basic`, `video.publish`. |
| Media allowlist | A brand can only publish `.mp4` files under its own allowlisted prefixes. Prefixes may only use `MEDIA_ALLOWED_HOSTS`. MCP cannot change the allowlist, so even a compromised MCP client cannot post arbitrary content. |
| Abuse limits | Per brand/platform daily limit (capped by `MAX_POSTS_PER_DAY_CEILING`). The same video can't be scheduled twice for the same time. |
| No double posting | Each post is claimed with a conditional update before it is processed. Errors after an upload has finished never trigger a re-upload. |
| Browser | Strict nonce-based CSP, `frame-ancestors 'none'`, HSTS, nosniff, `no-store`. |
| Secrets | None in the repository. Secrets live in Cloudflare. Personal resource ids come from GitHub repository variables at deploy time. CI scans the history with gitleaks. |

## Quick start
See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**. In short: create a D1 database and two KV namespaces, set the GitHub
secrets/variables, run the *Deploy* workflow, open `/setup` to generate your admin secrets, then connect your platform accounts.

## Development
```bash
npm ci
cp .dev.vars.example .dev.vars          # then open http://localhost:8787/setup to generate values
npx wrangler d1 migrations apply DB --local
npm run dev                              # http://localhost:8787
npm run check                            # typecheck + unit tests + build
npm run e2e                              # end-to-end test against the dev server
```

## Kervly Cloud
Don't want to run it yourself? A hosted version is coming at **[kervly.app](https://kervly.app)**.

## License
[AGPL-3.0](LICENSE). You can use, modify and self-host Kervly freely. If you offer a modified version as a network
service, you must publish your changes under the same license.
