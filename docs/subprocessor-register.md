# SalesFrame Service Provider and Subprocessor Register

Effective 12 July 2026. This register describes the providers implemented or intended for SalesFrame production. The public Privacy Policy remains the controlling customer-facing summary; executed provider terms, data processing agreements, and jurisdiction-specific notices must be reviewed before a new provider is enabled.

| Provider | Purpose | Information that may be processed | Intended processing location or boundary | Operational retention and controls |
| --- | --- | --- | --- | --- |
| Supabase | Authentication, relational database, row-level access controls, and private call/artifact storage | User/workspace records, customer records, calls, transcripts, recordings, notes, and application metadata | Project region selected by SalesFrame | Active-session RLS, composite tenant constraints, private buckets, and server-only service-role access. SalesFrame retention rules apply. |
| Netlify | Web hosting, CDN, serverless/background/scheduled functions, environment-secret storage, and operational request handling | Application requests and the data needed by each server function | Netlify infrastructure and configured deploy region(s) | Server secrets are Functions-only. Sensitive payloads and credentials must not be logged. |
| OpenAI | User-requested research, enrichment, live coaching, and post-call generation using the connected workspace/user API key | The minimum account, contact, opportunity, transcript, notes, playbook, and seller context needed for the selected feature | As configured for the user's OpenAI account and applicable OpenAI service | Saved API keys are encrypted server-side and are not returned to the browser. Contact-enrichment prompts exclude stored email, phone, profile URL, private notes, source URLs, database IDs, and ownership metadata. |
| Deepgram | Speech-to-text and turn detection | Live call audio and derived transcript/turn data | United States for the current production configuration | Browser one/two-channel capture uses Flux through a short-lived token. Meeting bot uses a separate Deepgram credential configured in Recall `us-west-2` and streams English Nova-3 with model-improvement opt-out. Raw Deepgram keys remain server/provider-side. |
| Recall.ai | Visible meeting-bot participation, meeting audio capture, participant/lifecycle events, real-time transcript transport, and mixed MP3 generation | Meeting URL, opaque correlation metadata, meeting platform, participant display/platform data, audio, speech activity, transcript, lifecycle, and recording metadata | Recall `us-west-2` (United States) | Planned production feature; disabled until legal/privacy approval. Provider media is configured for at most 24 hours and deletion is requested after verified transfer. Recall currently documents that custom metadata and meeting URLs are not deleted by Delete Bot Media and that the meeting URL is cleared 14 days after bot termination. |
| Logo.dev | Public company-logo retrieval | Public company domain used to request a logo | Provider infrastructure | Uses a browser-safe publishable key and public business identifiers. No call audio, transcript, contacts, or coaching context is sent. |

## Recall and Deepgram meeting-bot boundary

SalesFrame sends Recall only what is required to join and process the meeting. Account records, opportunity data, selected contacts, contact enrichment, seller notes, playbooks, and private coaching context remain in SalesFrame and are not included in Recall bot creation.

Recall sends finalized transcript and participant events to signed SalesFrame endpoints. SalesFrame verifies the exact raw request before storing or processing it. Participant names, transcript text, meeting URLs, provider payloads, and media download URLs are prohibited from logs and operational alerts.

Deepgram's meeting-bot credential and Project ID are configured directly in Recall's `us-west-2` transcription dashboard. This is separate from the Netlify Deepgram key used to mint temporary browser Flux tokens.

## Retention disclosure

The Meeting bot design targets:

1. Recall recording-media retention no longer than 24 hours.
2. Server-to-server transfer of mixed MP3 audio into private Supabase storage.
3. Byte-size and checksum verification before provider deletion.
4. Immediate Delete Bot Media request after verified transfer, with background retry until confirmed.

This does not support a promise that all provider-held meeting identifiers disappear within 24 hours. Recall's current [storage and retention documentation](https://docs.recall.ai/docs/storage-and-playback) says custom metadata and the meeting URL survive media deletion and that the meeting URL is cleared 14 days after bot termination. A shorter universal deletion claim requires a separately approved provider control or contractual commitment.

## Provider-change procedure

Before adding, replacing, changing region, or materially expanding a provider:

- Complete security, privacy, legal, data-residency, subprocessors, retention, and incident-notification review.
- Confirm the minimum data fields and lawful purpose.
- Update Terms, Privacy Policy, this register, internal data-flow documentation, and customer notices where required.
- Validate tenant isolation, authentication, encryption, logging, deletion, and outage/rollback behaviour.
- Keep the new feature disabled until production smoke and named approval are complete.

Questions or privacy requests can be sent to hello@salesframe.ai.
