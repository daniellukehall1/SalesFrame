# Netlify Environment Setup

SalesFrame uses browser-safe Supabase variables in the Vite app and server-only secrets in Netlify Functions. Meeting bots add a second transcription path:

- Browser one- and two-channel capture continues to use Deepgram Flux through short-lived browser tokens.
- Recall meeting bots use Deepgram Nova-3 streaming through Recall. The Deepgram credential for this path is configured in Recall's transcription dashboard, not exposed to the browser and not read from the browser-capture `DEEPGRAM_API_KEY` setting.

## Required Netlify variables

| Variable | Scope | Source | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser + Functions | Supabase project settings | Safe to expose to the browser. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + Functions | Supabase project API settings | Safe to expose to the browser. |
| `VITE_LOGO_DEV_PUBLISHABLE_KEY` | Browser + Functions | Logo.dev publishable key | Safe to expose. Set for Builds and Functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions only | Supabase project API settings | Secret. Never add a `VITE_` prefix. |
| `OPENAI_KEY_ENCRYPTION_SECRET` | Functions only | Generated app secret | Encrypts each seller's OpenAI key. Keep stable. |
| `DEEPGRAM_API_KEY` | Functions only | Deepgram project settings | Secret. Mints short-lived tokens for direct browser Flux capture only. |

## Meeting bot variables

Meeting bot configuration is server-only. The feature must remain disabled until every launch gate in [Recall Meeting Bot Operations](./recall-meeting-bot-operations.md) passes.

| Variable | Requirement | Notes |
| --- | --- | --- |
| `RECALL_MEETING_BOT_ENABLED` | Required gate | Default `false`. Set `true` only after the migration, signed webhook, platform, retention, and legal/privacy gates pass. |
| `RECALL_REGION` | Required | Must be `us-west-2` for this rollout. The code rejects any other value. |
| `RECALL_API_KEY` | Required when enabled | Secret API key from the current Recall workspace in `us-west-2`. Functions only. |
| `RECALL_MEDIA_DOWNLOAD_HOSTS` | Required when enabled | Exact comma-separated public hostnames observed on signed Recall transcript and mixed-MP3 artifacts in `us-west-2`. Wildcards, IP addresses, local hosts, ports, and paths are rejected. Reconfirm through sandbox events before rollout. |
| `RECALL_WORKSPACE_VERIFICATION_SECRET` | Required when enabled | One or more `whsec_` secrets used to verify raw webhook bodies. Comma- or whitespace-separate old and new values during rotation. |
| `MEETING_BOT_CRYPTO_SECRET` | Required when enabled | At least 32 characters. Derives AES-256-GCM and HMAC keys for short-lived URLs, webhook payloads, and internal dispatch authentication. |
| `MEETING_BOT_MAX_PER_USER` | Optional | Default `1`; safe maximum `5`. |
| `MEETING_BOT_MAX_PER_WORKSPACE` | Optional | Default `5`; safe maximum `25`. |
| `MEETING_BOT_MAX_GLOBAL` | Optional | Default `25`; safe maximum `100`. |
| `MEETING_BOT_RATE_WINDOW_MINUTES` | Optional | Rolling creation window. Default `60`; safe range 10 to 1440 minutes. |
| `MEETING_BOT_USER_ROLLING_CREATION_LIMIT` | Optional | Default `3` bot creations per user in the rolling window. |
| `MEETING_BOT_WORKSPACE_ROLLING_CREATION_LIMIT` | Optional | Default `15` bot creations per workspace in the rolling window. |
| `MEETING_BOT_USER_DAILY_BOT_LIMIT` | Optional | Default `12` creations per user over a rolling 24 hours. |
| `MEETING_BOT_WORKSPACE_DAILY_BOT_LIMIT` | Optional | Default `60` creations per workspace over a rolling 24 hours. |
| `MEETING_BOT_USER_DAILY_MINUTE_LIMIT` | Optional | Default `480` reserved/consumed bot minutes per user over a rolling 24 hours. |
| `MEETING_BOT_WORKSPACE_DAILY_MINUTE_LIMIT` | Optional | Default `2400` reserved/consumed bot minutes per workspace over a rolling 24 hours. |
| `MEETING_BOT_RESERVED_MINUTES` | Optional | Default `120`, matching the maximum bot recording window. Reserved at creation and settled to actual rounded-up minutes when the call ends. |
| `RECALL_SVIX_WEBHOOK_SECRET` | Legacy only | Use only for a legacy Recall dashboard status webhook that requires a separate endpoint secret. Real-time events always use the workspace verification secret. |
| `RECALL_PUBLIC_BASE_URL` | Optional | Canonical HTTPS production origin. Netlify's `URL` value is used when omitted. Do not include a path, credentials, port, or preview origin. |
| `RECALL_BOT_IMAGE_URL` | Optional | Same-origin path or URL for the branded JPEG. Defaults to `/media/salesframe-meeting-bot.jpg`. |
| `RECALL_BOT_IMAGE_B64` | Operational fallback | Base64 JPEG override. Prefer the deployed same-origin asset so a large image is not held in environment configuration. |

Capacity settings must satisfy `per user <= per workspace <= global`. Rate and daily workspace limits must be at least their user equivalents, and the workspace minute limit must be at least the user limit. Start with the documented defaults; raising them requires an observed-capacity, abuse, and Recall account review. Usage is enforced transactionally in a server-only ledger and cannot be reset by ending or deleting calls sequentially.

## Security gate before configuration

A Recall API credential was previously shared outside an approved secret manager. Treat it as compromised:

1. Revoke it in Recall before any test or production configuration.
2. Create a replacement under a production service account in the `us-west-2` workspace.
3. Enter the replacement directly into Netlify's encrypted environment-variable UI with Functions scope. Do not paste it into chat, a ticket, a shell command, source, screenshots, logs, or `.env` files.
4. Confirm the old credential can no longer authenticate.
5. Run the repository secret scan before release.

Recall API keys do not expire automatically and must be explicitly disabled when rotated. Use a current API v1.11 workspace; if the existing workspace is legacy-only, create a new current workspace rather than adapting this integration to v1.10. See [Recall API authentication](https://docs.recall.ai/reference/authentication) and [v1.11 release notes](https://docs.recall.ai/docs/api-v111-release-notes).

## Recall and Deepgram region setup

All Recall resources for this integration must be created in `us-west-2`: API key, workspace verification secret, webhook endpoint, bots, recordings, and transcription credentials. Recall regions are isolated.

In the Recall `us-west-2` transcription dashboard:

1. Create or choose a dedicated Deepgram project for meeting-bot transcription.
2. Create a fresh Deepgram API key in that project. Recall documents that the key needs Member, Admin, or Owner access; the Default role will fail transcription.
3. Enter both the Deepgram API key and its Project ID directly in Recall's `us-west-2` transcription dashboard and mark the credential as the default for the region.
4. Do not copy that credential into the frontend. Bot creation selects English `nova-3`, perfect/separate-stream diarization where available, and `mip_opt_out: true` server-side.
5. Keep the separate Netlify `DEEPGRAM_API_KEY` configured for existing browser Flux capture.

See [Recall's Deepgram setup](https://docs.recall.ai/docs/deepgram). The selected Recall region is US processing; any broader data-residency promise requires a separate provider and legal review.

## Recall webhook setup

Create the following dashboard endpoint in the Recall `us-west-2` workspace:

```text
https://salesframe.ai/api/recall/webhooks/status
```

Subscribe it to the bot lifecycle events and recording/transcript artifact events needed by SalesFrame:

- All bot status changes, including `bot.joining_call`, `bot.in_waiting_room`, `bot.in_call_not_recording`, `bot.recording_permission_allowed`, `bot.recording_permission_denied`, `bot.in_call_recording`, `bot.call_ended`, `bot.done`, and `bot.fatal`.
- `recording.done`, `recording.failed`, and `recording.deleted`.
- `transcript.done` and `transcript.failed`.

The real-time endpoint is attached automatically to each bot creation request and must not be created as a second dashboard webhook:

```text
https://salesframe.ai/api/recall/webhooks/realtime
```

It receives only finalized `transcript.data` and participant join, leave, update, speech-on, and speech-off events. Partial transcript delivery is intentionally disabled in v1.

Create a workspace verification secret before testing. Both endpoints verify Recall's signature against the exact raw body, enforce timestamp tolerance, and reject unverified requests before storage or processing. A workspace created before 15 December 2025 may require its dashboard status endpoint's separate Svix secret in `RECALL_SVIX_WEBHOOK_SECRET`; do not set that variable for a current workspace. See [Recall request verification](https://docs.recall.ai/docs/authenticating-requests-from-recallai) and [webhook types](https://docs.recall.ai/reference/webhooks-overview).

During workspace-secret rotation, place both valid `whsec_` values in `RECALL_WORKSPACE_VERIFICATION_SECRET` until Recall's overlap window ends, then remove the old value. Never print either secret while verifying configuration.

## Current frontend values

Before using the CLI, link this repository to the intended Netlify site with `netlify link`. Browser-safe values can then be set for Builds and Functions:

```bash
netlify env:set VITE_SUPABASE_URL "https://iuwjjxjicnorxlxzepup.supabase.co"
netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY "sb_publishable_miosbt6oQM8gT-IPp32u3Q_2_9yEzaP"
netlify env:set VITE_LOGO_DEV_PUBLISHABLE_KEY "<logo-dev-publishable-key>"
```

When configuring these in the Netlify UI, include both Builds and Functions scopes. Vite compiles them into the browser bundle, while functions use the same public values for scoped Supabase access.

## Existing server secrets

Get the service-role key from the SalesFrame Supabase project and enter it directly into Netlify with Functions scope. Generate the OpenAI encryption secret once and keep it stable. Changing it after users save keys makes existing encrypted values unreadable without a migration.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Use the generated value only in the Netlify secret form; do not include it in the command history. Rotate any Deepgram key that has appeared outside Netlify. The browser receives only a short-lived token from `/api/deepgram/token`, never the raw browser-capture key.

## Non-secret defaults

Next Call uses its dedicated `OPENAI_NEXT_CALL_BRIEF_MODEL` setting and defaults directly to `gpt-5.4-mini` when the setting is omitted. It does not inherit `OPENAI_TEXT_MODEL`.

```bash
netlify env:set OPENAI_TEXT_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_LIVE_STATE_MODEL "gpt-5.4-nano"
netlify env:set OPENAI_LIVE_QUESTION_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_LIVE_COACH_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_NEXT_CALL_BRIEF_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_ACCOUNT_ENRICHMENT_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_RESEARCH_WEB_SEARCH "true"
netlify env:set DEEPGRAM_FLUX_MODEL "flux-general-en"
netlify env:set DEEPGRAM_DIARIZE_MODEL "latest"
netlify env:set DEEPGRAM_FLUX_EAGER_EOT_THRESHOLD "0.4"
netlify env:set DEEPGRAM_FLUX_EOT_THRESHOLD "0.75"
netlify env:set DEEPGRAM_FLUX_EOT_TIMEOUT_MS "5000"
netlify env:set RECALL_REGION "us-west-2"
netlify env:set RECALL_MEETING_BOT_ENABLED "false"
netlify env:set MEETING_BOT_MAX_PER_USER "1"
netlify env:set MEETING_BOT_MAX_PER_WORKSPACE "5"
netlify env:set MEETING_BOT_MAX_GLOBAL "25"
netlify env:set MEETING_BOT_RATE_WINDOW_MINUTES "60"
netlify env:set MEETING_BOT_USER_ROLLING_CREATION_LIMIT "3"
netlify env:set MEETING_BOT_WORKSPACE_ROLLING_CREATION_LIMIT "15"
netlify env:set MEETING_BOT_USER_DAILY_BOT_LIMIT "12"
netlify env:set MEETING_BOT_WORKSPACE_DAILY_BOT_LIMIT "60"
netlify env:set MEETING_BOT_USER_DAILY_MINUTE_LIMIT "480"
netlify env:set MEETING_BOT_WORKSPACE_DAILY_MINUTE_LIMIT "2400"
netlify env:set MEETING_BOT_RESERVED_MINUTES "120"
```

## Local development

`.env.local` is ignored by Git. It may contain local Supabase, OpenAI-encryption, and browser Deepgram values. Do not copy production Recall credentials into local files. Use a separate non-production Recall workspace and non-production secret values for integration tests.

Use Netlify Dev when testing function-backed actions:

```bash
netlify dev
```

Running Vite directly remains useful for UI work, but it does not serve Netlify Functions. Never enable meeting bots in a local environment whose webhook origin is not canonical public HTTPS.

## Configuration verification

After variables are set, sign in as a workspace owner and request:

```text
/api/system/env?workspaceId=<workspace-id>
```

The owner-scoped, rate-limited response reports variable names and configured state only. With the feature disabled, `features.meetingBot.ready` may be true without Recall secrets. Before enablement, set all secrets in a non-production context and expect:

```json
{
  "ready": true,
  "missing": [],
  "features": {
    "meetingBot": {
      "enabled": true,
      "ready": true,
      "missing": []
    }
  }
}
```

For direct browser transcription, `/api/deepgram/health` should continue to report `deepgram_flux` ready. It does not validate Recall's Nova-3 credential. Validate the bot transcription credential with a signed Recall sandbox meeting and a finalized `transcript.data` event.

## Provider retention boundary

Bot creation requests Recall media retention of 24 hours. SalesFrame then transfers the mixed MP3 to private Supabase storage, verifies size and checksum, and requests provider-media deletion as soon as finalization succeeds.

That is not a universal 24-hour deletion guarantee. Under Recall's current [storage and retention documentation](https://docs.recall.ai/docs/storage-and-playback), Delete Bot Media removes recording media but does not immediately remove custom metadata or the meeting URL; Recall says the meeting URL is cleared 14 days after bot termination. SalesFrame must disclose this boundary and must not promise deletion of all Recall-held URL metadata within 24 hours unless Recall provides a separately approved control or contractual commitment.

## Deployment and rollback

Deploy in this order only after explicit production authorisation:

1. Rotate credentials and complete legal/privacy approval.
2. Run the read-only migration preflight, apply the additive migration, and validate RLS, constraints, and functions.
3. Deploy functions and the frontend with `RECALL_MEETING_BOT_ENABLED=false`.
4. Configure Recall status webhooks and run signed sandbox verification.
5. Run Zoom, Meet, Teams, and Webex smoke tests in the deploy context.
6. Enable the feature for production and monitor the first sessions closely.

For rollback, set `RECALL_MEETING_BOT_ENABLED=false` first. This blocks new bot creation without disabling webhook receipt, media transfer, provider deletion, or abandoned-bot recovery. Allow active sessions to finalise safely or remove them through the authorised server flow. Do not roll back the additive database migration while historical bot rows exist.
