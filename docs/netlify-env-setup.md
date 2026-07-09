# Netlify Environment Setup

SalesFrame uses browser-safe Supabase variables in the Vite app and server-only secrets in Netlify Functions.

## Required Netlify Variables

| Variable | Scope | Source | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser + Functions | Supabase project settings | Safe to expose to the browser. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + Functions | Supabase project API settings | Safe to expose to the browser. |
| `VITE_LOGO_DEV_PUBLISHABLE_KEY` | Browser + Functions | Logo.dev publishable key | Safe to expose. Set for both Builds and Functions so account enrichment can save logo metadata and the browser can render it. |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions only | Supabase project API settings | Secret. Never add a `VITE_` prefix. |
| `OPENAI_KEY_ENCRYPTION_SECRET` | Functions only | Generated app secret | Secret used to encrypt each seller's OpenAI key before storing it. |
| `DEEPGRAM_API_KEY` | Functions only | Deepgram project settings | Secret. Used only by Netlify Functions to mint short-lived Flux tokens. |

Before running the CLI commands below, link this repo to a Netlify project:

```bash
netlify link
```

If the site does not exist yet, create it in Netlify first, then link the local repo to that site.

## Current Frontend Values

```bash
netlify env:set VITE_SUPABASE_URL "https://iuwjjxjicnorxlxzepup.supabase.co"
netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY "sb_publishable_miosbt6oQM8gT-IPp32u3Q_2_9yEzaP"
netlify env:set VITE_LOGO_DEV_PUBLISHABLE_KEY "<logo-dev-publishable-key>"
```

When configuring this in the Netlify UI, include both `Builds` and `Functions` scopes. Vite compiles it into the browser bundle at build time, and Netlify Functions use it when account enrichment refreshes account logo metadata. Logo images are requested without a referrer in V1 because some publishable Logo.dev keys return `404` when the browser sends a local or production origin that has not been explicitly allowlisted.

## Server Secrets

Get the service role key from Supabase:

1. Open the SalesFrame Supabase project.
2. Go to Project Settings, then API.
3. Copy the `service_role` key.
4. Save it in Netlify as a secret:

```bash
netlify env:set SUPABASE_SERVICE_ROLE_KEY "<supabase-service-role-key>" --secret
```

Generate the OpenAI key encryption secret once and keep it stable:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
netlify env:set OPENAI_KEY_ENCRYPTION_SECRET "<generated-secret>" --secret
netlify env:set DEEPGRAM_API_KEY "<deepgram-api-key>" --secret
```

Changing `OPENAI_KEY_ENCRYPTION_SECRET` after users save keys will make existing encrypted OpenAI keys unreadable. If it ever must rotate, build a key-rotation flow first.

Rotate any Deepgram key that has appeared outside Netlify before production. The browser never receives the raw key; it receives only a short-lived token from `/api/deepgram/token`.

## Optional Function Defaults

```bash
netlify env:set OPENAI_TEXT_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_LIVE_STATE_MODEL "gpt-5.4-nano"
netlify env:set OPENAI_LIVE_QUESTION_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_LIVE_COACH_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_ACCOUNT_ENRICHMENT_MODEL "gpt-5.4-mini"
netlify env:set OPENAI_RESEARCH_WEB_SEARCH "true"
netlify env:set DEEPGRAM_FLUX_MODEL "flux-general-en"
netlify env:set DEEPGRAM_DIARIZE_MODEL "latest"
netlify env:set DEEPGRAM_FLUX_EAGER_EOT_THRESHOLD "0.4"
netlify env:set DEEPGRAM_FLUX_EOT_THRESHOLD "0.75"
netlify env:set DEEPGRAM_FLUX_EOT_TIMEOUT_MS "5000"
```

## Local Development

`.env.local` should contain the same values for local Netlify Functions. It is ignored by Git.

```bash
VITE_SUPABASE_URL=https://iuwjjxjicnorxlxzepup.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_miosbt6oQM8gT-IPp32u3Q_2_9yEzaP
VITE_LOGO_DEV_PUBLISHABLE_KEY=<logo-dev-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
OPENAI_KEY_ENCRYPTION_SECRET=<generated-secret>
DEEPGRAM_API_KEY=<deepgram-api-key>
```

Use Netlify Dev when testing function-backed actions like Save Key, customer research, Deepgram token creation, and post-call outputs.

```bash
netlify dev
```

Running the Vite dev server directly is still useful for UI work, but it does not serve Netlify Functions.

## Verification

After Netlify variables are set, sign in as a workspace owner and open:

```text
/api/system/env?workspaceId=<workspace-id>
```

Expected response:

```json
{
  "ready": true,
  "missing": []
}
```

This endpoint is owner-scoped and rate-limited. It reports missing configuration without exposing secret values.

For call transcription specifically, sign in and let Start Call run the live transcript check, or call the authenticated health endpoint:

```text
/api/deepgram/health
```

Expected response:

```json
{
  "data": {
    "provider": "deepgram_flux",
    "ready": true
  }
}
```

If this returns `deepgram_key_missing`, `deepgram_auth_failed`, or `deepgram_rate_limited`, fix the Netlify `DEEPGRAM_API_KEY` secret before testing call capture.

The endpoint reports only variable names and configured status. It never returns secret values.
