# Security Policy

## Reporting a vulnerability
Please **do not open a public issue**. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository (private vulnerability reporting).

Include steps to reproduce and the impact. You will get an answer within 7 days. Please give us a reasonable time to
release a fix before any disclosure.

## Scope
- The Worker code in `src/` (accounts, authentication, sessions, OAuth/MCP, tenant isolation, token storage, GitHub storage, signed media links, publisher).
- Deployment scripts and workflows in `scripts/` and `.github/`.

Out of scope: vulnerabilities in the platforms themselves (YouTube, Instagram, TikTok, Cloudflare) and issues that require
an already compromised admin account or Cloudflare account.

## Design notes for reviewers
- No secret is stored in the repository. Runtime secrets are Cloudflare secrets; personal resource ids are GitHub variables.
- Platform tokens are encrypted with AES-256-GCM using `ENCRYPTION_KEY`, with brand + platform as additional data.
- The MCP endpoint only accepts OAuth access tokens issued after an active user's interactive sign-in and consent. Tokens are bound to that user and stop working when their password is reset or the account is disabled.
- Storage tokens (`storage:<brand>`) and TOTP secrets (`totp:<user>`) are encrypted the same way, each with its own additional data.
- Every dashboard and MCP query is scoped to the acting user; only the superadmin can see other users' data.
- A brand can only publish media from its storage folder or allowlisted prefixes. These can only be changed in the dashboard.
- Private-repository videos are exposed only through `/m/<post>.mp4` links signed with an HKDF-derived HMAC key, valid for 30 minutes.

## Güvenlik açığı bildirimi (TR)
Lütfen herkese açık issue açmayın. Repoda **Security → Report a vulnerability** ile gizli olarak bildirin.
