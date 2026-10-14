# Security Policy

## Reporting a vulnerability
Please **do not open a public issue**. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository (private vulnerability reporting).

Include steps to reproduce and the impact. You will get an answer within 7 days. Please give us a reasonable time to
release a fix before any disclosure.

## Scope
- The Worker code in `src/` (authentication, sessions, OAuth/MCP, token storage, media allowlist, publisher).
- Deployment scripts and workflows in `scripts/` and `.github/`.

Out of scope: vulnerabilities in the platforms themselves (YouTube, Instagram, TikTok, Cloudflare) and issues that require
an already compromised admin account or Cloudflare account.

## Design notes for reviewers
- No secret is stored in the repository. Runtime secrets are Cloudflare secrets; personal resource ids are GitHub variables.
- Platform tokens are encrypted with AES-256-GCM using `ENCRYPTION_KEY`, with brand + platform as additional data.
- The MCP endpoint only accepts OAuth access tokens issued after the admin's interactive sign-in (password + TOTP) and consent.
- A brand can only publish media under its allowlisted prefixes. The allowlist can only be changed in the dashboard.

## Güvenlik açığı bildirimi (TR)
Lütfen herkese açık issue açmayın. Repoda **Security → Report a vulnerability** ile gizli olarak bildirin.
