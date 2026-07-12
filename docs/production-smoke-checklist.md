# SalesFrame Production Smoke Checklist

Run this before every production deploy. Meeting-bot checks apply whenever Recall code, configuration, schema, legal copy, or provider setup changes. Record evidence without customer data or secrets.

## Release gate

- Local release gate completes with `pnpm check`.
- GitHub Actions release check passes on the exact commit being deployed.
- Secret scan finds no tracked OpenAI, GitHub, Supabase, Deepgram, Recall, webhook, service-role, database, meeting URL, or test-login secret.
- Netlify build completes with `pnpm build`.
- The deploy is linked to the intended SalesFrame Netlify site and Supabase project.
- Production database preflight is read-only, reviewed, and clean before any authorised migration.
- No production data was modified during smoke preparation.

## Netlify and Supabase

- Core variables are configured with the correct scope: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LOGO_DEV_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_KEY_ENCRYPTION_SECRET`, and `DEEPGRAM_API_KEY`.
- `VITE_LOGO_DEV_PUBLISHABLE_KEY` is scoped to both Netlify Builds and Functions.
- Server secrets have no `VITE_` or `PUBLIC_` prefix and are absent from the browser bundle, source maps, request payloads, logs, and screenshots.
- Any Supabase, OpenAI-encryption, Deepgram, or Recall secret suspected of exposure has been rotated before release.
- Supabase RLS is enabled for workspace-owned tables; service-role functions perform explicit authorization.
- Cross-workspace composite account/opportunity/call/contact relationships are rejected.
- `call-recordings` and `call-artifacts` buckets are private.
- Existing database rows pass call/account/opportunity integrity checks.

## Authentication and workspace access

- Signed-out users can access only public/auth/legal pages.
- Signed-in users can create and switch workspaces.
- Cross-workspace account, opportunity, contact, call, customer-research, Deepgram-token, meeting-bot, participant-correction, and post-call requests return `403`.
- Missing or expired auth returns `401`; invalid input returns `400`.
- Owner-only environment readiness remains owner-scoped and rate-limited.
- Repeated AI requests are throttled with `429`.
- Repeated AI, token, enrichment, and bot-creation requests are throttled before they can create runaway spend.

## Existing browser capture regression

- One-channel and two-channel capture render and behave exactly as before the Meeting bot change.
- Browser microphone permission states are visible and calm: requesting, denied, connecting, recording, paused, stopping, and upload-retry required.
- The selected microphone is reused for preflight, recording, and live transcription.
- The one- and two-channel meters use a consistent perceived scale.
- `/api/deepgram/token` succeeds for an authorised call; the raw Deepgram key is absent from the browser and GitHub.
- Browser calls still use `flux-general-en`; no Recall/Nova configuration appears in their token or WebSocket path.
- Stop Call finalises duration, private recording upload, transcript, notes, and post-call outputs.
- Seller Research runs from Start Call when enabled; Customer Research runs from account enrichment when enabled.

## Recall launch gates

- Legal/privacy approval covers every supported production jurisdiction. Bot admission and visual branding are not treated as universally sufficient consent.
- Terms, privacy, and subprocessor copy explicitly name Recall.ai and Deepgram processing and disclose cross-border/US processing.
- The previously exposed Recall credential is revoked; its replacement was entered directly into Netlify and never copied into source, chat, tickets, shell history, screenshots, or logs.
- The Recall workspace uses current API v1.11 and region `us-west-2`; it is not a legacy-only v1.10 implementation.
- Recall API key, workspace verification secret, dashboard webhook, bots, recordings, and transcription credential all use `us-west-2`.
- The Deepgram API key and Project ID are configured directly in Recall's `us-west-2` transcription dashboard with the required role and set as default.
- Meeting bots produce English Deepgram `nova-3` finalized transcription with `mip_opt_out: true` and separate-stream diarization where available.
- `RECALL_MEETING_BOT_ENABLED` remains `false` until every item in this section and the platform matrix passes.
- Capacity defaults are `1` per user, `5` per workspace, and `25` global; the limits increase monotonically and match reviewed provider capacity.
- Rolling creation and 24-hour bot/minute defaults are configured at `3/15`, `12/60`, and `480/2400` for user/workspace, with a 120-minute reservation per new bot.
- Sequential create/end attempts still consume the durable rolling usage ledger; deleting an eligible completed call does not reset its rate or minute usage.
- `/api/system/env?workspaceId=<workspace-id>` reports Meeting bot ready without returning values.

## Meeting bot Start Call UX

- Meeting bot is the third capture option; account, opportunity, contacts, primary contact, call type, playbooks, and seller/product context remain selected.
- Selecting Meeting bot removes microphone, channel, system-audio, device, permission, meter, and direct Deepgram preflight controls.
- The form contains one Meeting URL field, detected platform, passive visible-participant disclosure, consent/authority copy, and one Join with SalesFrame action.
- Valid direct HTTPS Zoom, Google Meet, Teams, and Webex URLs are accepted, including passcode-bearing URLs.
- Redirectors, unsupported providers, HTTP, credentials-in-URL, localhost, private IPs, malformed URLs, and excessive URL input are rejected before provider work.
- Duplicate clicks create one call and one active bot session.
- While provisioning, submit is disabled and status is announced through `aria-live="polite"` without animated pills or noisy state badges.
- Retryable `429`, `502`, `503`, `504`, and `507` failures retry calmly for up to two minutes and respect `Retry-After`; permanent validation errors do not retry.
- Retry exhaustion offers Try meeting bot again, Use one channel, and Use two channels without duplicating call/contact/playbook records.
- Kill-switch or capacity failure shows a calm temporary-unavailability message and browser-capture alternatives.

## Meeting bot lifecycle

- Bot display name is `SalesFrame AI Notetaker` and the 1280x720 black/white branded tile renders before and during recording.
- No mixed MP4 is requested or produced for SalesFrame; mixed MP3 and transcript are present.
- Bot statuses map calmly through provisioning, joining, waiting room, recording, leaving, processing, completed, and failed.
- Locked, expired, ended, sign-in-required, denied, permission-denied, and lobby-timeout meetings show a specific safe explanation and next action.
- Switching tabs, hiding the browser, or locking a phone does not disconnect the bot.
- Page exit starts a 30-second grace. Reload/reopen within grace transfers control to the new cockpit instance, clears disconnect state, and preserves transcript/timer/status.
- A genuine close removes the bot after grace; a crashed visible cockpit is recovered and removed within two minutes, allowing for the one-minute schedule.
- Hidden/locked clients are not mistaken for crashes.
- Internal navigation away from an active cockpit confirms before ending the bot.
- Automatic leave passes for 10-minute waiting-room/no-participant limits, two-hour recording maximum, and 30 seconds after everyone leaves.

## Webhook security and durability

- Dashboard status endpoint is `https://salesframe.ai/api/recall/webhooks/status` and has the required bot, recording, and transcript subscriptions.
- Per-bot real-time endpoint is `https://salesframe.ai/api/recall/webhooks/realtime` and subscribes only to finalized transcript plus participant join/leave/update/speech-on/speech-off events.
- Valid current signatures over the exact raw request body receive a prompt `204`.
- Wrong, missing, stale, body-mismatched, or oversized signed requests are rejected before parsing, encryption, persistence, or processing.
- Secret rotation accepts multiple valid Recall signatures only during the intended overlap; the old configured secret is removed afterward.
- Duplicate webhook IDs produce one durable event and one downstream effect.
- Replayed, duplicate, delayed, out-of-order, and unknown/new status events cannot regress a terminal lifecycle state.
- Interrupted processing leases are reclaimed by recovery without losing or duplicating transcript turns.
- Logs and alerts omit raw provider bodies, meeting URLs/query strings, participant names/emails, transcript text, and media download URLs.

## Transcript, attribution, and coaching

- Recall persists only finalized utterances as evidence; partial transcript delivery is not subscribed or treated as customer truth.
- Utterances merge and commit on speech-off plus continuation grace, participant floor change, three-second silence, or call end.
- Overlaps, interruptions, long monologues, adjacent same-speaker fragments, duplicate provider events, and out-of-order delivery are stable and exactly once.
- The question engine evaluates committed turns, seller feedback, and existing audit/heartbeat events only.
- No question transition occurs solely because someone joined/left or after a short silence.
- No more than one question transition occurs per committed buyer turn unless seller feedback requests another.
- Existing questions remain stable until answered, invalidated, materially followed up, or clearly passed by the conversation.
- Live transcript and buyer-confirmed evidence outrank contact enrichment and general context.
- Seller, exact-email, exact/preferred-name, unique-first-name, fuzzy, ambiguous, collision, and seller-corrected participant matching cases pass.
- Automatic matching can mark an existing account contact attended, but never creates a contact, creates an opportunity relationship, or pretends seller confirmation.
- Seller correction locks the mapping for the call; ambiguous identities remain unknown and prompt at most once.
- Only server-fetched call/account/opportunity/contact/playbook context reaches the question engine; private sales context is not sent to Recall.

## Audio finalisation and retention

- On `recording.done`, mixed MP3 downloads server-to-server, uploads to the correct private Supabase call path, and passes byte-size and checksum verification.
- A different existing call recording is never overwritten silently.
- Final turn buffers flush before post-call work.
- Post-call outputs and next-call brief run exactly once and retain meeting-bot provenance.
- Recall media deletion is requested only after private transfer verifies, and completion is persisted.
- Transfer, post-call, and provider-deletion failures recover through scheduled workers without exposing sensitive URLs or content.
- Encrypted provisioning URLs are deleted after success/final failure; encrypted webhook payloads and turn buffers expire on schedule.
- Provider-media age is monitored against the 24-hour deadline.
- Product/legal copy does not promise universal 24-hour deletion: Recall currently documents that meeting URL/custom metadata survives Delete Bot Media and meeting URLs are cleared 14 days after bot termination.
- The current provider retention statement is rechecked against [Recall's documentation](https://docs.recall.ai/docs/storage-and-playback) before general enablement.

## Platform matrix

Use disposable meetings and synthetic participant names:

| Check | Zoom | Google Meet | Teams | Webex |
| --- | --- | --- | --- | --- |
| Join and waiting-room admission | Pass | Pass | Pass | Pass |
| Correct name and branded tile | Pass | Pass | Pass | Pass |
| Final transcript and participant events | Pass | Pass | Pass | Pass |
| Host denial/permission-denied handling | Pass | Pass | Pass | Pass |
| Meeting-ended finalization | Pass | Pass | Pass | Pass |
| MP3 transfer and Recall media deletion | Pass | Pass | Pass | Pass |

Do not mark the matrix complete from code inspection; retain redacted sandbox evidence for each provider.

## AI features

- Saved OpenAI key shows a connected masked state and is never returned to the browser.
- Seller Research runs from Start Call when enabled; account/contact enrichment remains optional and blank-only.
- Post-call output is generated from persisted transcript and notes.
- Malformed model JSON is handled as a retryable processing error and is not saved as production truth.
- Prompt-injection text in a transcript cannot alter system instructions, authorize data access, or complete methodology evidence without buyer speech.

## Desktop, mobile, and accessibility

- Login, Home, account, opportunity, Start Call, cockpit, settings, terms, and privacy render without console errors at representative desktop and mobile sizes.
- Meeting URL, status, fallback, participant correction, and Stop/Leave controls have at least 44px touch targets.
- No meeting-bot form, dialog, participant row, status, error, or legal copy causes horizontal overflow.
- Buttons, switches, comboboxes, dialogs/drawers, focus outlines, and disabled/loading states render correctly on Safari, Chrome, mobile Safari, and mobile Chrome.
- Keyboard flow reaches every action in logical order; Dialog/Drawer focus is trapped and restored correctly; Escape does not silently end an active bot.
- Status changes are announced politely without repetitive screen-reader chatter.
- Reduced-motion mode removes nonessential motion.
- Returning from another browser tab does not replace the app with a full-page skeleton or reload healthy workspace data.

## Retention and legal

- Scheduled retention cleanup and meeting-bot recovery appear as Scheduled functions in Netlify and complete without secrets or customer content in logs.
- Expired calls no longer expose broken replay links.
- `/terms`, `/privacy`, and the subprocessor register render successfully and match the deployed effective date.
- In-product copy says the seller confirms authority to record; it does not give legal advice or claim admission is sufficient in every jurisdiction.
- A named legal/privacy approver has signed off before `RECALL_MEETING_BOT_ENABLED=true`.

## Monitoring and rollback readiness

- PII-free dashboards show provisioning/admission success, timing, retry/fallback, transcript/question latency, attribution outcomes, active capacity, billed minutes, webhook failures, media transfer, and deletion age.
- Alerts exist for duplicate bots, signature failures, stalled sessions, repeated webhook failures, capacity approaching 25, and provider media nearing the 24-hour deadline.
- Alert payloads contain only opaque internal/provider IDs and safe codes.
- Setting `RECALL_MEETING_BOT_ENABLED=false` blocks new bots while webhook, recovery, transfer, post-call, and deletion functions continue for existing sessions.
- Active bots can be removed through the authorised idempotent server endpoint.
- The additive migration is not reversed while historical bot rows exist.
- One- and two-channel browser capture remain available throughout rollback.

See [Recall Meeting Bot Operations](./recall-meeting-bot-operations.md) for deployment order, signed sandbox verification, incidents, and rollback.
