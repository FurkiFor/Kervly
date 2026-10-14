# Contributing

Kervly is developed by its owner only. Commits to `main` and pull requests are accepted from the owner (@FurkiFor) alone.
Pull requests from anyone else are closed automatically by `.github/workflows/owner-only.yml`.

You are still free to use, fork and self-host Kervly under the AGPL-3.0. See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).
Security problems go through **Security → Report a vulnerability** (see [SECURITY.md](SECURITY.md)).

## For the owner

1. `npm ci`, then follow the *Development* section of the README.
2. Keep changes focused and add tests (`test/unit.test.ts`, `test/e2e.mjs`).
3. User-facing text goes through `src/i18n.ts` (server messages) or the `UI` dictionary in `src/ui.ts`. Add both English and Turkish.
4. Never commit secrets, `.dev.vars` or `wrangler.deploy.json`. CI runs gitleaks on every push.
5. `npm run check` must pass.

## Branch policy

`main` is protected by a repository ruleset: only the repository admin (the owner) can push to it, and force pushes and
deletion are blocked for everyone else. See `.github/rulesets/main-owner-only.json`.
