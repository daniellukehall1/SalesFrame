# SalesFrame.ai — Codex Engineering & QA Instructions

## Product context

SalesFrame.ai is a premium real-time sales coaching SaaS application. It helps salespeople perform better during live calls, roleplays, reviews, and coaching workflows. The product should align with established sales methodologies such as Sandler, Challenger, GAP Selling, MEDDICC-style discovery, consultative selling, and modern revenue-team best practices.

The product experience must feel calm, premium, trustworthy, fast, and professional. The target UX principle is CALM:

- Clear: users always understand what is happening and what to do next.
- Assured: the interface builds confidence and avoids anxiety.
- Lightweight: avoid unnecessary complexity, noise, and over-explaining.
- Meaningful: every screen, state, and interaction should create obvious value.

Think like a combined product, engineering, security, and design review team from Apple, Stripe, Linear, Notion, and Airbnb.

## Non-negotiable operating rules

- Do not push to GitHub.
- Do not create or merge pull requests.
- Do not trigger Netlify deploys.
- Do not run production database migrations.
- Do not modify production data.
- Do not commit secrets, credentials, tokens, API keys, auth cookies, or `.env` files.
- Do not print secrets into logs, reports, test output, screenshots, or comments.
- Do not hard-code test credentials. Use environment variables such as:
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD`
  - `TEST_ORG_ID`
  - `TEST_SUPABASE_PROJECT_REF`
- If real credentials appear in prompts, code, logs, fixtures, or tests, flag this as a Critical security issue and replace them with safe placeholders.
- If a requested change could cause data loss, permission leakage, billing impact, or production outage, stop and document the risk instead of applying it silently.
- If a large redesign or new feature is desirable but not necessary to fix a defect, document it as a recommendation rather than building it immediately.

## Stack assumptions

Infer the actual framework and package manager from the repository. Do not assume without checking.

Known platform context:

- Frontend/backend app deployed on Netlify.
- Supabase is used for database and/or auth.
- Deepgram is used for real-time speech/transcription.
- The product likely includes real-time audio, transcripts, AI-generated guidance, user/org data, coaching records, and sales methodology content.

## Security expectations

Treat transcripts, recordings, coaching notes, sales calls, user profiles, organisations, and account metadata as sensitive.

Pay special attention to:

- Supabase Row Level Security policies.
- Cross-tenant data isolation.
- Authenticated vs unauthenticated access.
- Role-based access controls.
- Server-only usage of Supabase service-role or secret keys.
- Client-safe usage of publishable/anon keys only when RLS is enabled.
- Netlify environment variable exposure.
- Deepgram credential handling.
- Temporary client-side tokens for real-time audio.
- File uploads and transcript exports.
- XSS in transcript, notes, AI suggestions, customer names, uploaded content, and markdown-like rendered text.
- Prompt injection via call transcripts or user-entered sales notes.
- Leaking PII or call content through logs, analytics, errors, telemetry, or browser storage.
- Rate limiting for auth, audio, transcription, AI coaching, exports, and public APIs.
- Safe error messages that do not expose internals.

## Engineering standards

Before changing code:

1. Inspect the repo structure.
2. Identify the framework, routing model, state management, server/API layer, Supabase usage, Deepgram integration, test framework, lint/typecheck/build commands, and deployment configuration.
3. Check current git status.
4. Establish a baseline by running the appropriate validation commands if available.

When fixing issues:

- Reproduce or reason from code before patching.
- Prefer root-cause fixes over superficial patches.
- Write or update tests where practical.
- Keep changes cohesive and reviewable.
- Refactor when it materially improves correctness, maintainability, or UX.
- Avoid broad rewrites that are not needed for the issue.
- Avoid adding production dependencies unless there is a strong reason.
- Preserve product intent while improving implementation quality.
- Keep TypeScript types strict and useful.
- Remove dead code, duplicate logic, stale comments, and misleading abstractions when found.
- Ensure loading, empty, error, success, disabled, and offline-ish states are handled.
- Ensure mobile and desktop interactions both work well.
- Ensure accessible keyboard/focus behavior for all interactive UI.

## Validation expectations

Use the repo’s actual commands. Typical examples may include:

- install: `npm install`, `pnpm install`, `yarn install`, or equivalent
- typecheck: `npm run typecheck`
- lint: `npm run lint`
- tests: `npm test`
- unit tests: `npm run test:unit`
- e2e tests: `npm run test:e2e`
- build: `npm run build`
- preview/local server: `npm run dev` or `netlify dev`

Do not invent passing results. If a command fails, report the exact failure and whether it appears related to your changes.

## UX quality bar

The app should feel premium, calm, and launch-ready.

Review for:

- Clear information hierarchy.
- Low cognitive load.
- Smart defaults.
- Obvious next actions.
- Minimal friction.
- No dead ends.
- Calm loading states.
- Helpful empty states.
- Specific, human error messages.
- Trust-building success states.
- Consistent spacing, typography, buttons, cards, tables, forms, modals, icons, navigation, and interaction patterns.
- Fast perceived performance.
- Subtle, purposeful animation only.
- Mobile layouts that feel intentionally designed, not merely squeezed.

## Sales-coaching product quality bar

For SalesFrame-specific features, review:

- Whether real-time coaching appears at the right time.
- Whether guidance is concise enough to help during a live call.
- Whether suggestions are actionable, not generic.
- Whether methodology labels are accurate and useful.
- Whether coaching avoids overwhelming the seller.
- Whether transcript delays, partial transcripts, silence, interruptions, and reconnections are handled gracefully.
- Whether the UI distinguishes live, processing, completed, failed, and saved states.
- Whether the user can trust what is being recorded, transcribed, saved, shared, and deleted.
- Whether AI outputs are safely bounded and cannot be hijacked by transcript content.

## Accessibility expectations

Check and improve:

- Keyboard navigation.
- Focus states.
- ARIA labels and relationships.
- Dialog focus trapping and escape behavior.
- Form labels and errors.
- Contrast.
- Touch target sizes.
- Screen-reader-friendly status updates.
- Reduced-motion compatibility where relevant.
- Responsive font scaling.
- Mobile usability.

## Performance expectations

Check and improve:

- Initial load time.
- Bundle size.
- Unnecessary client-side code.
- Expensive re-renders.
- Transcript rendering performance.
- Long lists and tables.
- Real-time subscription cleanup.
- WebSocket/audio lifecycle cleanup.
- Memory leaks.
- Image and asset loading.
- Caching and invalidation.
- Supabase query efficiency.
- Missing indexes for common queries.
- Slow API routes/functions.
- Avoidable waterfalls.

## Data integrity expectations

Check:

- Database constraints.
- Foreign keys.
- Cascade behavior.
- Unique constraints.
- Required fields.
- Safe deletes.
- Orphaned records.
- Duplicate records.
- Race conditions.
- Optimistic UI rollback.
- Migration safety.
- Rollback notes for any schema change.
- Validation consistency between client, API, and database.

## Definition of done

A task is only done when:

- The issue is understood.
- The root cause is addressed.
- Relevant tests/checks were run.
- Remaining failures are documented.
- Security and data risks are considered.
- UX states are reviewed.
- Mobile and desktop implications are considered.
- The final response includes changed files, validation commands, results, risks, and recommended next steps.
