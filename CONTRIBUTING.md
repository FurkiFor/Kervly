# Contributing

Thanks for helping! Issues and pull requests are welcome in English or Turkish.

1. `npm ci`, then follow the *Development* section of the README.
2. Keep changes focused and add tests (`test/unit.test.ts`, `test/e2e.mjs`).
3. User-facing text goes through `src/i18n.ts` (server messages) or the `UI` dictionary in `src/ui.ts`. Add both English and Turkish.
4. Never commit secrets, `.dev.vars` or `wrangler.deploy.json`. CI runs gitleaks on every push.
5. `npm run check` must pass.

By contributing you agree that your contribution is licensed under the AGPL-3.0.
