# SalesFrame Production Smoke Checklist

Run this before every production deploy.

## Netlify And Supabase

- Local release gate completes with `pnpm check`.
- GitHub Actions release check passes on `main` or on the pull request being deployed.
- Secret scan completes with no tracked OpenAI, GitHub, Supabase secret, service-role, or credentialed database URLs.
- Netlify build completes with `pnpm build`.
- Netlify environment variables are configured: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LOGO_DEV_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_KEY_ENCRYPTION_SECRET`.
- `VITE_LOGO_DEV_PUBLISHABLE_KEY` is scoped to both Netlify Builds and Functions so account logos render in the browser and refresh during account enrichment.
- Account logos render from Logo.dev on a real account domain such as `usemultiplier.com`; image requests should not send an app-origin referrer unless that origin is explicitly allowlisted in Logo.dev.
- Supabase service-role key has not been shared in chat, committed, or stored in a browser-visible variable.
- Supabase RLS policies are enabled for workspace-owned tables.
- `call-recordings` and `call-artifacts` buckets are private.

## Authentication And Workspace Access

- Signed-out users can only see login, signup, terms, and privacy pages.
- Signed-in users can create and switch workspaces.
- Cross-workspace account, opportunity, call, customer research, realtime transcription, and post-call requests return `403`.
- Missing auth returns `401`; invalid input returns `400`.
- Repeated AI requests are throttled with `429` before they can create runaway OpenAI spend.

## Call Lifecycle

- Start Call creates or selects an account and opportunity before recording begins.
- Browser audio permission states are visible: requesting, denied, connecting, recording, paused, stopping, upload failed.
- A captured call writes transcript segments, call notes, and a private recording path to Supabase.
- Stop Call finalises duration, uploads the recording, and generates post-call outputs.
- Refreshing the page keeps transcript, notes, recording metadata, post-call outputs, and next-call brief visible.

## AI Features

- Saved OpenAI key shows a connected masked state and is not returned to the browser.
- Customer research runs from the Start Call and Add Account flows when enabled.
- Post-call output is generated from persisted transcript and notes.
- Malformed OpenAI JSON is handled as a retryable processing error, not saved as production data.

## Retention And Legal

- Expired call recordings are removed by the scheduled retention cleanup.
- Expired calls no longer expose broken replay links.
- `/terms` and `/privacy` render successfully for signed-out and signed-in users.

## Browser Smoke

- Login page renders without console errors.
- Home dashboard renders without console errors after sign-in.
- Workspace skeleton appears during workspace switch.
- Create account, create opportunity, Start Call, Stop Call, and Settings key-save flows complete without uncaught errors.
