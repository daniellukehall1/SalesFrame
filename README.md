# SalesFrame

Glad you stopped in.

SalesFrame is built to help sellers run better calls. It listens in the browser, keeps the opportunity context close, and shows one natural next question at the right time.

No giant checklist. No robotic script. Just the next useful move.

## What It Does

SalesFrame is a commercial SaaS app for individual B2B sellers.

Status: actively developed.

During a call, it brings together:

- The selected workspace, account, and opportunity.
- Previous call history and saved opportunity evidence.
- Live transcript turns from browser audio capture.
- Selected sales playbooks and methodology gaps.
- Account enrichment, customer research, and seller context.
- OpenAI-powered live guidance.

The core promise:

> Real-time seller question guidance by opportunity and framework.

## Product Shape

SalesFrame is designed around a calm seller workflow:

1. Pick or create a workspace.
2. Add accounts and opportunities manually or through CSV import.
3. Save an OpenAI API key for the workspace.
4. Start a call from Home, Account, Opportunity, or Calls.
5. Let SalesFrame prepare audio, account context, and the first live recommendation.
6. Ask one natural question at a time while the app quietly tracks playbook coverage.
7. Review transcript, notes, evidence, follow-up, and next-call brief after the call.

## Key Features

- Supabase Auth for signup, login, recovery, and workspace-scoped sessions.
- Workspace-scoped accounts, opportunities, calls, playbooks, recordings, and AI settings.
- Account and opportunity record management with save flows.
- CSV import for accounts and opportunities.
- Logo.dev account logos from account domains.
- AI account enrichment with editable sales signals.
- Sales playbooks including MEDDICC, MEDDPICC, BANT, Force Management, SPIN, Sandler, Challenger, Gap Selling, Value Selling, Strategic Selling, SPICED, and Custom framework.
- Multi-playbook intent clustering so overlapping framework fields become one natural question.
- Browser-based no-bot call capture with audio preflight.
- OpenAI realtime transcription and live guidance.
- Post-call outputs including notes, evidence, follow-up, and next-call brief.
- Netlify Functions for all server-side AI and privileged operations.
- Supabase RLS and explicit authorization helpers for workspace safety.

## Tech Stack

- React 19
- Vite 8
- TypeScript 6
- Tailwind CSS 4
- shadcn-style components
- Supabase Auth, Postgres, RLS, Realtime, and Storage
- Netlify hosting and Netlify Functions
- OpenAI APIs for transcription, guidance, enrichment, research, and post-call outputs
- Logo.dev for account logo images

## Repo Map

```text
src/                    App, components, hooks, client data access, UI helpers
netlify/functions/      Server-side API routes for OpenAI, imports, auth checks, cleanup
supabase/migrations/    Database schema, RLS policies, storage, and app foundations
supabase/templates/     Branded Supabase email templates
docs/                   Product spec, design language, and implementation notes
tests/                  Contract, function, and live-call pipeline tests
public/                 Public assets, media, robots, sitemap, favicon
```

## Local Setup

Use Node 22.

```bash
corepack enable
pnpm install
pnpm dev
```

The app runs locally at:

```text
http://127.0.0.1:5173
```

## Environment Variables

Create a local `.env.local` from `.env.example`.

Browser-safe values:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_LOGO_DEV_PUBLISHABLE_KEY=
```

Server-only values for Netlify Functions:

```text
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_KEY_ENCRYPTION_SECRET=
```

Optional model defaults:

```text
OPENAI_TEXT_MODEL=
OPENAI_TRANSCRIPTION_MODEL=
OPENAI_RESEARCH_WEB_SEARCH=
OPENAI_LIVE_COACH_MODEL=
OPENAI_LIVE_STATE_MODEL=
OPENAI_SPEAKER_ATTRIBUTION_MODEL=
```

Local migration helper:

```text
SUPABASE_DATABASE_URL=
```

Keep secrets in Netlify and Supabase. Do not commit live secret values to GitHub.

## Scripts

```bash
pnpm dev              # Start local Vite app
pnpm build            # Typecheck and build production assets
pnpm check            # Run the release gate: secret scan, lint, tests, and production build
pnpm check:secrets    # Scan tracked files for high-risk committed secrets
pnpm lint             # Typecheck without building
pnpm test             # Run all Node test files
pnpm test:e2e         # Run app contract tests
pnpm test:functions   # Run function/security tests
```

## Supabase

Supabase is the system of record for:

- Workspaces
- Accounts
- Opportunities
- Calls
- Transcript segments
- Call speakers
- Playbooks and playbook fields
- Opportunity evidence
- Account enrichment profiles and runs
- Recordings and storage lifecycle metadata
- Workspace OpenAI key metadata

Before changing production data behavior:

1. Add or update a migration in `supabase/migrations`.
2. Keep RLS enabled.
3. Make sure Netlify Functions explicitly authorize workspace/account/opportunity/call access before privileged writes.
4. Update generated types or local type definitions when schema changes.
5. Add a contract test for the new behavior.

## Netlify

Netlify deploys from GitHub.

GitHub Actions runs `pnpm check` on pushes and pull requests to `main`. That gate runs the secret scan, typecheck, tests, and production build before Netlify should be treated as release-ready.

Build settings:

```text
Build command: pnpm build
Publish directory: dist
Functions directory: netlify/functions
Node version: 22
```

Production URL:

```text
https://salesframe.ai
```

Netlify owns the production environment variables for server functions. GitHub stores code only.

## OpenAI

SalesFrame is OpenAI-first.

The browser never receives the seller's OpenAI API key after it is saved. Frontend calls go through `/api/openai/*`, where Netlify Functions decrypt and use the workspace-scoped key.

The live coach should not invent local fallback questions. If AI is unavailable, the UI should pause clearly and help the seller fix the connection.

## QA Checklist

Run this before deploying meaningful app changes:

```bash
pnpm check
```

For UX-sensitive changes, also verify in the browser:

- Signup and login flows.
- Workspace creation and switching skeletons.
- Account creation, save, enrichment, and Logo.dev avatar rendering.
- Opportunity creation, save, playbook selection, and deletion.
- CSV import upload, mapping, review, and summary.
- Start Call preflight and loading progress.
- Call cockpit recording controls, transcript, and live guidance controls.
- Post-call replay, transcript download, notes, and next-call brief.
- Dark and light mode persistence.
- Mobile viewport layout.

## Design Principles

SalesFrame should feel like a calm sales coach.

- One clear primary action.
- No decorative pill labels.
- Human-voiced empty states.
- Loading copy that explains what is happening now.
- Error states that offer a recovery path.
- Toggles only for persistent settings.
- Buttons for one-time actions.
- Strict methodology in the background.
- Natural conversation in the foreground.

More detail lives in:

- `docs/product-build-spec.md`
- `docs/design-language-states.md`

## Deployment Flow

For ordinary releases:

1. Make the change.
2. Run `pnpm check`.
3. Commit to `main`.
4. Push to GitHub.
5. Confirm Netlify deploys the exact commit.
6. Smoke check `https://salesframe.ai`.

## Security Notes

- Never commit service role keys, OpenAI keys, personal access tokens, or database passwords.
- Treat any shared token as exposed and rotate it.
- Keep Supabase service role usage server-side only.
- Keep RLS on for workspace data.
- Add explicit authorization helpers before any privileged function action.
- Prefer structured AI outputs and fail closed when model output is malformed.

## Contributing

Keep changes small and useful.

When adding a feature:

1. Follow existing shadcn-style UI patterns.
2. Keep live-call UI calm.
3. Add or update tests for the behavior.
4. Update docs when product behavior changes.
5. Run the release checklist before pushing.

## Support

Questions, access, and product feedback:

```text
hello@salesframe.ai
```

## License

Proprietary software.

All rights reserved by ALLYCHAT PTY LTD.
