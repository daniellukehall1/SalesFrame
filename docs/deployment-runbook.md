# SalesFrame Deployment Runbook

SalesFrame should have one boring release path:

1. GitHub stores the code.
2. Netlify deploys from GitHub.
3. Supabase stores database, auth, storage, and migrations.
4. Secrets live in Netlify and Supabase, not in GitHub or chat.

## Before Shipping

Run the production gate locally:

```sh
pnpm check
```

This runs secret scanning, TypeScript, tests, and the production build.

## Push Code To GitHub

Use a real local GitHub credential instead of pasting tokens into commands.

Recommended setup:

```sh
gh auth login
gh auth setup-git
git push origin main
```

If using a personal access token, it must have write access to
`daniellukehall1/SalesFrame`. Fine-grained tokens need Contents read/write for
the repository. Classic tokens need the `repo` scope.

If Git says `could not read Username` or `No anonymous write access`, the local
Git credential is not configured correctly. Re-run the `gh auth` steps above and
try the push again.

## Deploy To Netlify

The preferred production deploy is Git-based: pushing `main` triggers Netlify.
Use the Netlify dashboard deploy log as the source of truth.

Manual deploy fallback:

```sh
pnpm --package=netlify-cli dlx netlify status
pnpm --package=netlify-cli dlx netlify deploy --prod
```

The linked Netlify site should be:

- Project: `salesframe-ai`
- Production URL: `https://salesframe.ai`
- Site ID: `72b2645c-ffec-4e47-8d0e-e0f180384bb4`

If Netlify returns `Forbidden`, the active Netlify token/session does not have
deploy permission for the site, or the Netlify project/account is currently
blocked.

Check the site state:

```sh
pnpm --package=netlify-cli dlx netlify api getSite --data '{"site_id":"72b2645c-ffec-4e47-8d0e-e0f180384bb4"}'
```

Look for:

- `disabled`
- `disabled_reason`

If `disabled_reason` says account usage or credits were exceeded, GitHub can
still be pushed, but Netlify will not deploy until the Netlify account issue is
resolved in the dashboard.

## Required Environment Variables

Keep these in Netlify, not in GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_KEY_ENCRYPTION_SECRET`
- `VITE_LOGO_DEV_PUBLISHABLE_KEY`

Keep Supabase auth email templates and database migrations in sync before a
public release.

## Production Smoke Check

After deployment:

1. Open `https://salesframe.ai`.
2. Confirm login and signup routes load from the custom domain.
3. Confirm the app loads after auth.
4. Confirm Settings can save an OpenAI key.
5. Confirm account creation, enrichment, and logos work.
6. Confirm Start Call reaches audio preflight without console errors.
7. Confirm no protected API returns raw backend errors.

If something feels weird, do not ship around it. Fix it, run `pnpm check`, push,
and redeploy.
