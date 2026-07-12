# Recall Meeting Bot Operations

This runbook covers the controlled rollout and operation of SalesFrame's Recall meeting bot. It is deliberately separate from browser capture: one- and two-channel calls continue to use Deepgram Flux, while meeting bots use Deepgram Nova-3 through Recall in `us-west-2`.

The default production state is disabled. No production migration, secret configuration, webhook registration, or enablement is authorised by this document.

## Fixed service contract

- Supported meetings: Zoom, Google Meet, Microsoft Teams, and Webex direct HTTPS URLs.
- Bot identity: `SalesFrame AI Notetaker` with the 1280x720 SalesFrame JPEG tile.
- Output: finalized English transcript and mixed MP3 audio only. No mixed video file is requested.
- Transcription: Deepgram streaming `nova-3`, `mip_opt_out: true`, with separate streams for diarization where available.
- Capture begins when the admitted bot enters the call.
- Automatic leave: 10-minute waiting-room timeout, 10-minute no-participant timeout, two-hour recording maximum, and 30 seconds after everyone leaves.
- Product capacity defaults: one active bot per user, five per workspace, and 25 globally.
- Abuse and cost defaults: three creations per user and 15 per workspace per rolling hour; 12 bots/480 reserved or consumed minutes per user and 60 bots/2400 minutes per workspace per rolling 24 hours. Each creation reserves 120 minutes until the session settles to actual rounded-up recording time.
- Recall media retention request: 24 hours, followed by verified transfer and an earlier delete-media request whenever possible.

The bot's visible name, branded camera tile, and admission are disclosure signals; they are not a universal legal-consent mechanism. A documented jurisdictional privacy and recording-consent review is a production launch gate.

## Provider retention limitation

Recall currently distinguishes recording media deletion from bot metadata deletion. Its [storage and retention documentation](https://docs.recall.ai/docs/storage-and-playback) says Delete Bot Media removes recording data, but custom metadata and the meeting URL are not deleted at that moment; the meeting URL is cleared 14 days after bot termination.

Consequences:

- SalesFrame can target provider media deletion within 24 hours, but must not claim that all Recall-held meeting URL metadata is removed within 24 hours.
- Privacy, customer contracts, security questionnaires, and in-product copy must describe the current 14-day URL-metadata boundary unless Recall supplies an approved stronger control.
- If a customer or jurisdiction requires every URL identifier to be removed in less than 14 days, Meeting bot must remain unavailable for that customer or jurisdiction until a provider-approved control exists.
- Provider retention behaviour must be rechecked before each material launch because it is an external, changeable contract.

## Data flow and trust boundaries

1. An authenticated seller submits a supported meeting URL against an existing scoped call.
2. A server function authorizes user, workspace, account, opportunity, and call relationships.
3. The URL is AES-256-GCM encrypted in the private provisioning table; only an HMAC fingerprint is used for idempotency.
4. A server worker sends the URL and an opaque correlation token to Recall. Account, opportunity, contact, playbook, seller notes, and enrichment context are never sent to Recall.
5. Recall joins visibly and sends signed lifecycle events to `/api/recall/webhooks/status`.
6. Recall sends signed finalized transcript and participant events to `/api/recall/webhooks/realtime`.
7. The app verifies the raw body before parsing or persisting, durably claims each event, and processes it asynchronously.
8. Committed transcript turns feed the existing provider-neutral question engine. Partial transcript text is not evidence.
9. At completion, the server downloads mixed MP3 audio, uploads it to private Supabase call storage, verifies size and checksum, flushes transcript buffers, and triggers post-call processing once.
10. Only after the private transfer is verified does the server request Recall media deletion and record deletion completion.

Meeting URLs, participant names, transcript text, provider payloads, and download URLs must never appear in application logs, analytics, alert payloads, screenshots, or support tickets.

## Production launch gates

All gates require named evidence and an owner:

- Security: the previously exposed Recall key is revoked; replacement credentials exist only in Recall/Deepgram/Netlify secret stores; repository secret scan is clean.
- Provider: a current API v1.11 Recall workspace exists in `us-west-2`; the API key, verification secret, webhook endpoint, bot, recording, and transcription credential are all in that region.
- Download boundary: `RECALL_MEDIA_DOWNLOAD_HOSTS` contains only the exact current hostnames returned by signed `us-west-2` transcript and mixed-MP3 sandbox artifacts; both downloads reject redirects and any unlisted host.
- Deepgram: the project ID and a correctly privileged key are configured directly in Recall's `us-west-2` transcription dashboard; a real finalized Nova-3 transcript succeeds.
- Legal/privacy: supported-jurisdiction recording consent, visible disclosure, subprocessor, cross-border processing, and the 14-day meeting-URL retention limitation are approved and published.
- Data: the additive migration preflight is clean; composite ownership constraints, RLS, service-only mutations, idempotency, recovery, and cleanup functions are validated.
- Webhooks: valid signed events receive `204`; invalid, stale, replayed, oversized, duplicate, and out-of-order events fail or deduplicate safely; no unverified body is stored.
- Capture: existing one- and two-channel Flux paths pass unchanged and never read Recall credentials.
- Platforms: real sandbox meetings pass on Zoom, Meet, Teams, and Webex, including admission, denial, lobby timeout, meeting ended, and permission denied.
- Lifecycle: refresh within 30 seconds restores the session; hidden/background tabs do not disconnect; confirmed cockpit exit removes the bot; the watchdog removes abandoned bots within two minutes.
- Finalization: MP3 transfer, size/checksum verification, private attachment, transcript flush, exactly-once post-call work, Recall media deletion, and retry recovery all pass.
- UX/accessibility: desktop and mobile layouts have no horizontal overflow, controls are at least 44px, statuses are calm text, focus order is correct, and status changes are announced politely.
- Operations: dashboards, capacity visibility, PII-free alerts, on-call owner, incident procedures, and kill-switch access are ready.

## Deployment sequence

Use this order after explicit production authorisation:

1. Revoke the exposed Recall API key and create a production service-account key in `us-west-2`.
2. Configure the Recall workspace verification secret and the Deepgram project/key in the same Recall region.
3. Add Netlify server-only secrets and capacity settings while `RECALL_MEETING_BOT_ENABLED=false`.
4. Run `supabase/preflight/202607120001_recall_meeting_bot.sql` read-only against production and retain the redacted result.
5. Apply `supabase/migrations/202607120001_recall_meeting_bot.sql` and validate its additive constraints, policies, indexes, and functions.
6. Deploy webhook, provisioning, watchdog, media-transfer, frontend, and controller changes with the feature disabled.
7. Configure the Recall dashboard status endpoint at `https://salesframe.ai/api/recall/webhooks/status`.
8. Run signed webhook sandbox events and a non-production end-to-end meeting on each platform.
9. Confirm the public terms, privacy policy, and subprocessor register reflect Recall and Deepgram processing.
10. Enable Meeting bot, then watch the first production sessions and capacity in real time.

Do not enable the feature before the migration: the application depends on database-level idempotency, authorization, leases, and retention controls.

## Webhook acceptance check

Use Recall's dashboard test/resend facility or an isolated test workspace. Do not copy signing secrets into scripts, command history, screenshots, or logs.

Verify:

- Valid current signatures over the exact raw body receive `204` promptly.
- The same webhook ID sent twice produces one claimed inbox event and one downstream effect.
- A stale timestamp, changed body, missing signature, wrong secret, or oversized body is rejected before storage.
- During verification-secret rotation, both provider signatures are accepted only for the intended overlap window; the old configured secret is removed afterward.
- Unknown event/status values are acknowledged safely without corrupting or regressing a terminal session.
- Status processing remains non-blocking and Recovery can claim an event after an interrupted worker lease.
- Logs contain only event type and safe operational codes, never provider payloads or customer data.

For a current workspace, the workspace verification secret signs dashboard and real-time webhooks. A legacy workspace created before 15 December 2025 may use a separate dashboard Svix endpoint secret for status events; real-time events still use the workspace secret. See [Recall request verification](https://docs.recall.ai/docs/authenticating-requests-from-recallai).

## Platform smoke matrix

Run each scenario with a disposable meeting and synthetic participant names. Do not use customer calls for initial validation.

| Scenario | Zoom | Google Meet | Teams | Webex |
| --- | --- | --- | --- | --- |
| Direct URL accepted and platform detected | Required | Required | Required | Required |
| Bot appears with correct name and tile | Required | Required | Required | Required |
| Waiting room and admission state | Required | Required | Required | Required |
| No browser microphone/system-audio prompt | Required | Required | Required | Required |
| Final transcript and participant events | Required | Required | Required | Required |
| Speaker mapping and seller correction lock | Required | Required | Required | Required |
| Question changes at most once per committed buyer turn | Required | Required | Required | Required |
| Host denial/permission error is specific and calm | Required | Required | Required | Required |
| Meeting-end finalization and media deletion | Required | Required | Required | Required |

Also test password/passcode URLs, expired links, locked meetings, sign-in-required meetings, duplicate clicks, provider capacity, retry expiry, one- and two-channel fallback, phone lock, tab hide, reload within grace, and a simulated browser crash.

## PII-free monitoring

Collect counts, durations, status classes, safe error codes, platform, and region only:

- Bot provisioning success, retry, fallback, and admission success rates.
- Rolling creation-limit and daily bot/minute-budget rejections by safe category.
- P50/P95 bot creation, admission, first finalized transcript, and first-question latency.
- P50/P95 verified webhook-to-database latency.
- Final transcript-to-question latency and question transitions per committed buyer turn.
- Active bots by user/workspace/global capacity; billed minutes.
- Automatic, ambiguous, and seller-corrected attribution rates without names.
- Webhook signature failures, duplicate deliveries, retries, stalled leases, and recovery outcomes.
- Audio transfer/checksum failures, post-call failures, media-deletion failures, and age to deletion.
- Sessions approaching 10-minute lobby/no-participant limits, two-hour recording limit, or 24-hour media deadline.

Alert on:

- Any duplicate Recall bots for one call.
- A sustained signature-failure increase or any signature failures after secret rotation should have completed.
- A session without heartbeat/recovery progress beyond two minutes.
- A verified recording that has not transferred, or provider media that has not deleted, as the 24-hour deadline approaches.
- Repeated webhook processing failures or a Recall dashboard endpoint being disabled.
- Global active capacity at 20 or more, leaving headroom below the default limit of 25.
- A mismatch between call, account, opportunity, or workspace ownership.

Alerts must identify internal opaque IDs and safe codes only. Operators may use authorised internal tooling to resolve the record; alert payloads must not contain meeting URLs, participant names, audio, or transcript text.

## Incident procedures

### Stop new bots

Set `RECALL_MEETING_BOT_ENABLED=false`. Confirm new creation requests show the calm temporary-unavailability response and browser-capture alternatives. Keep webhook, recovery, transfer, deletion, and finalization functions deployed so existing sessions can close safely.

### Credential exposure

Disable the affected Recall, Deepgram, or Netlify secret immediately; enable the kill switch; create a replacement in the same region; rotate the workspace verification secret with overlap; review provider access logs; and run the repository secret scan. Never paste the exposed value into the incident record.

### Webhook verification failures

Keep the feature disabled, confirm endpoint/region pairing and the correct current-versus-legacy secret type, inspect PII-free failure counts, and use Recall's signed resend. Do not weaken signature checks or accept unsigned payloads as a workaround.

### Stalled or abandoned bot

Let the scheduled recovery worker claim the session. If it cannot, use the authorised server deletion flow to remove the bot, then confirm the call end state, encrypted URL scrubbing, and media cleanup. Avoid manual database status edits.

### Media transfer or provider deletion failure

Keep retrying through the background recovery path until the 24-hour media deadline. Verify private Supabase object size/checksum before any Recall deletion. If deletion remains unconfirmed near deadline, alert the incident owner and Recall support using only the provider bot ID and approved metadata.

### Provider outage or capacity pressure

Leave existing bots under watchdog control, block new creation with the kill switch if failures persist, and offer one- or two-channel capture. Do not raise capacity above the reviewed limit during an incident.

## Rollback

1. Disable new meeting bots with the global feature flag.
2. Allow active bots to finish or remove them through the idempotent server endpoint.
3. Confirm every active session reaches a terminal state and all encrypted provisioning URLs are scrubbed.
4. Leave webhook handlers and recovery scheduled functions operational until media transfer/deletion and post-call work settle.
5. Revert frontend exposure only after active-session restoration is no longer needed.
6. Do not reverse the additive migration while historical meeting-bot records exist. A later reviewed migration may remove unused objects after retention and audit requirements are satisfied.

Existing browser Flux capture is the supported fallback throughout rollback.
