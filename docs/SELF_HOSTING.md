# Self-hosting Kervly

Everything runs on Cloudflare's free tier. In this guide `<URL>` is your Kervly address: `https://<worker>.<subdomain>.workers.dev`,
or your own domain if you set `CUSTOM_DOMAIN`.

[Türkçe](SELF_HOSTING.tr.md)

## 1. Cloudflare resources

Create one D1 database and two KV namespaces. The easiest way is from the dashboard: *Storage & Databases → D1* and *KV*.
You can also use the CLI:

```bash
npx wrangler d1 create kervly-db
npx wrangler kv namespace create kervly-oauth
npx wrangler kv namespace create kervly-sessions
```

Note the three ids.

## 2. GitHub configuration

Fork or clone this repository into your own GitHub account, then open *Settings → Secrets and variables → Actions*.

**Secrets**

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | *My Profile → API Tokens → Create Custom Token*. Account permissions: `Workers Scripts: Edit`, `D1: Edit`, `Workers KV Storage: Edit`. Add `Zone: Workers Routes: Edit` and `DNS: Edit` only if you use a custom domain. |
| `CLOUDFLARE_ACCOUNT_ID` | Shown on the right side of the Cloudflare dashboard home page |

**Variables**

| Name | Required | Example |
|---|---|---|
| `D1_DATABASE_ID` | yes | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `KV_OAUTH_ID` | yes | 32 hex characters |
| `KV_SESSIONS_ID` | yes | 32 hex characters |
| `D1_DATABASE_NAME` | if not `kervly-db` | `kervly-db` |
| `WORKER_NAME` | no | `kervly` |
| `CUSTOM_DOMAIN` | no | `app.example.com` (the zone must be on Cloudflare) |
| `DEFAULT_TIMEZONE` | no | `Europe/Istanbul` |
| `DEFAULT_LANG` / `MCP_LANG` | no | `en` or `tr` |
| `MEDIA_ALLOWED_HOSTS` | no | `raw.githubusercontent.com` |
| `TIKTOK_UNAUDITED` | no | `true` until your TikTok app passes the audit |
| `SUPERADMIN_EMAIL` | recommended | `you@example.com` — the superadmin account. Without it the superadmin signs in as `admin`. |
| `REGISTRATION` | no | `closed` (default), `approval` (waitlist, superadmin approves) or `open` |
| `MAX_BRANDS_PER_USER` | no | `3` (the superadmin has no limit) |
| `EMAIL_FROM` | for sign-up | `Kervly <noreply@example.com>` |
| `EMAIL_BINDING` | no | `true` to use the Cloudflare Email Service binding instead of Resend (needs Workers Paid) |
| `PUBLIC_URL` | no | Set automatically from `CUSTOM_DOMAIN`. Needed for email links and private-repo storage. |

These are not secrets, but keeping them out of the repository means your fork carries no personal ids.

## 3. Deploy

*Actions → Deploy → Run workflow*. Every later push to `main` redeploys automatically and applies database migrations.
The workflow does nothing until `D1_DATABASE_ID` is set.

## 4. Superadmin account (password + 2FA)

The superadmin is the owner of the instance. They see every user and brand, approve sign-ups and manage their own brands.

1. Open `<URL>`. You are redirected to `/setup`.
2. Choose a password of at least 12 characters and click **Generate values**. The values are generated in your browser only.
3. Add the four values as **Secrets** in Cloudflare: *Workers & Pages → your worker → Settings → Variables and Secrets*.
   They are `ADMIN_PASSWORD_HASH`, `ADMIN_TOTP_SECRET`, `ENCRYPTION_KEY` and `CONSENT_SECRET`.
4. Add `ADMIN_TOTP_SECRET` to your authenticator app.
5. Sign in at `<URL>` with `SUPERADMIN_EMAIL`, your password and the 6-digit code.

## 5. Users and email (optional)

With `REGISTRATION=approval` or `open`, people can create an account with their email at `<URL>/signup`. They confirm the
address through an emailed link and choose their password there. In `approval` mode the account then waits until the
superadmin approves it in *Admin*. Users can enable 2FA under *Account*.

Sending email needs `EMAIL_FROM` and one provider:

- **Resend** (free tier): verify your domain at [resend.com](https://resend.com), then add the Cloudflare secret `RESEND_API_KEY`.
- **Cloudflare Email Service**: set the variable `EMAIL_BINDING=true` (requires Workers Paid and an onboarded sending domain).

Without a provider, links are only written to the worker log, so keep `REGISTRATION=closed`.

> If `ENCRYPTION_KEY` changes, stored platform connections can no longer be decrypted and must be reconnected.

## 6. Brands and GitHub storage

In the dashboard, open *Brands → New brand*. Set an id, a name, a daily limit and a time zone. Then click
**Configure storage** on the brand card:

1. Create a repository for the brand's videos (private is fine).
2. GitHub → *Settings → Developer settings → Fine-grained tokens → Generate new token*. *Repository access*: only that
   repository. *Permissions → Contents*: **Read and write**. Pick an expiry you're comfortable with.
3. Enter the repository (`owner/name`), branch, folder and token, then click **Verify & save**. Kervly checks that the
   token can push and stores it encrypted.

You can now upload videos from the post dialog (up to 50 MB each) or pick videos already in the folder. Videos in private
repositories are handed to Instagram and TikTok through 30-minute signed links, so `PUBLIC_URL` must be set.

Alternatively, add **public video prefixes** (e.g. `https://raw.githubusercontent.com/you/videos/main/clips/`) in the brand
settings. Kervly only ever publishes `.mp4` files from the brand's storage folder or these prefixes.

You create **one app per platform** (below). Every brand then connects its own accounts with **Connect** in the dashboard.

## 7. YouTube

1. [Google Cloud Console](https://console.cloud.google.com/): create a project and enable **YouTube Data API v3**.
2. *Google Auth Platform*: set the audience to *External*, add the scope `.../auth/youtube.upload`, and add yourself as a test user.
   Then **Publish app → In production**. In *Testing* mode refresh tokens expire after 7 days.
3. *Clients → Create client → Web application*. Set *Authorized redirect URI* to `<URL>/connect/youtube/callback`.
4. Add Cloudflare secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Dashboard → select brand → YouTube → **Connect**. If you have several channels, choose the right one on Google's screen.
6. Google may keep uploads from unverified API projects **private**. If your first video stays private, submit the
   *YouTube API Services – Audit and Quota Extension Form* (free).

## 8. Instagram (Reels)

Requirement: a **professional** Instagram account (Business or Creator).

1. [Meta for Developers](https://developers.facebook.com/): *Create App*. Choose the use case *Manage messaging & content on Instagram*
   (Instagram API with Instagram Login).
2. *API setup with Instagram login*:
   - Add your Instagram account. If needed, use *App roles → Instagram Tester* and accept the invite in Instagram
     (*Settings → Apps and websites*).
   - *Business login settings → OAuth redirect URIs*: `<URL>/connect/instagram/callback`
   - Add Cloudflare secrets `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.
3. *App settings → Basic*: Privacy Policy URL `<URL>/privacy`, Terms URL `<URL>/terms`.
4. In *Development* mode, publishing works for accounts that have a role on the app. That's enough for your own brands.
5. Dashboard → select brand → Instagram → **Connect**. To connect another brand's account, sign in to Instagram with it first.

## 9. TikTok

1. [TikTok for Developers](https://developers.tiktok.com/): *Manage apps → Connect an app*.
2. App details: Terms URL `<URL>/terms`, Privacy URL `<URL>/privacy`, platform *Web*, website `<URL>`.
3. Add products **Login Kit** and **Content Posting API**, and enable **Direct Post**.
4. Login Kit redirect URI: `<URL>/connect/tiktok/callback`. Scopes: `user.info.basic`, `video.publish`.
5. Submit for review, then add Cloudflare secrets `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
6. Dashboard → select brand → TikTok → **Connect**.
7. **Audit:** until the Content Posting API audit is approved, TikTok only allows private (`SELF_ONLY`) posts. Kervly enforces this
   while `TIKTOK_UNAUDITED=true`. Set the variable to `false` after approval.

## 10. Connect your AI agent (MCP)

In Claude: *Settings → Connectors → Add custom connector*, URL `<URL>/mcp`. Click **Connect**, sign in and
click **Allow**. Each user connects with their own account and only sees their own brands. Other MCP clients that support OAuth work the same way.

Example prompt: *"List my Kervly brands, then schedule https://…/clip.mp4 for YouTube and TikTok tomorrow at 10:00 Istanbul time."*

## Troubleshooting
- **Storage: "token is invalid" / "cannot write"**: the token expired or lacks *Contents: Read and write* on that repository.
- **No verification email**: check `EMAIL_FROM`, the provider secret and the worker log.
- **"App keys are not configured"**: the platform's client id or secret is missing.
- **YouTube "token refresh failed"**: the Google app is still in *Testing*. Publish it and reconnect.
- **"Upload was interrupted"**: check whether the video appeared on the platform. If it didn't, click **Retry**.
- **Changing secrets**: adding a secret in Cloudflare creates a new worker version immediately. You don't need to redeploy.
