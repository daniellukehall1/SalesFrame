# SalesFrame.ai Launch-Readiness QA Report

Date: 2026-07-09
Scope: local codebase audit, contract test repair, safe UX/code fixes, targeted in-app browser layout QA, secret scan, typecheck, full test suite, production build, continuation release-gate verification
Production actions: no production migration or production data change was performed. A GitHub commit and Netlify production deploy may be performed separately only when explicitly requested.

## 1. Executive Summary

SalesFrame is in a materially stronger launch-readiness position after this pass. The local production gate now passes end to end: secret scan, TypeScript, all tests, and production build.

Continuation note, 2026-07-09: a fresh release-gate run found three stale security-contract assertions after the workspace-session authorization helper was hardened to pass the active auth token through workspace and call authorization. The implementation was already safer than the old contract. The contract tests were updated to require the session-aware authorization calls, and the full production gate now passes with 118 / 118 tests.

The largest finding was not a runtime crash. It was a QA reliability problem: several contract tests had drifted behind intentional product decisions made later in the build, especially around download-only post-call audio, calm playbook pages, non-blocking buyer-audio meters, sortable table headers, and sidebar account toggling. Those stale contracts were creating false failures and could have pushed the app back toward poorer UX.

A set of direct fixes was applied. The Start Call preparation state now clearly shows the current step count while the first question, transcript, context, and audio setup are being prepared. The homepage How It Works dialog was tightened so its image/story layout no longer reserves a visibly empty fixed text block. Repo-facing docs were corrected so Deepgram Flux is the live transcription provider and OpenAI is the reasoning/guidance layer. Stale local Vite routes for removed OpenAI transcription/diarization functions were cleaned up. The main app bundle warning was resolved by splitting call-capture, Deepgram, and Supabase data code into separate production chunks. Playbook reads were hardened to use explicit system/workspace queries instead of raw combined filter strings. Function error logs were tightened so support gets traceable diagnostics without stack traces or raw provider/database messages. The scheduled import-enrichment worker now validates a Netlify-style scheduled payload before using the service-role client. CSV import and import-enrichment retry actions now have per-user/workspace rate limits. Call-recording storage policies now require access to the specific call ID embedded in the recording path, not just the workspace folder.

## 2. Overall Quality Score

82 / 100

## 3. UX Score

84 / 100

The app has a much calmer interface than earlier iterations. Remaining UX risk is concentrated in real-device live-call behavior, especially audio capture, transcription quality, and the live coach loop under real network conditions.

## 4. Engineering Score

84 / 100

The app has strong contract coverage, clear provider boundaries, and typed build validation. Some app surfaces remain very large in `src/App.tsx`, which increases review cost.

## 5. Performance Score

80 / 100

The production build passes without Vite chunk-size warnings. The main app chunk is now below 500 kB after minification, with live-call capture and data access split into separate chunks.

## 6. Accessibility Score

81 / 100

Contract coverage checks accessible names, reduced motion, modal behavior, mobile touch access, breadcrumb behavior, and status messaging. A full screen-reader pass was not completed in this local run.

## 7. Security Score

86 / 100

Tracked-file secret scanning passed, and tests cover sanitized server error envelopes, auth-protected functions, OpenAI workspace scoping, and Deepgram token safety. Production environment variables were not read or changed.

## 8. Product Maturity Score

82 / 100

SalesFrame has coherent product direction: AI-first live coaching, Deepgram transcription, methodology-aware guidance, account/opportunity context, and calm UI rules. The biggest maturity risk is live-call reliability in real browsers and real meeting setups.

## 9. Launch Readiness Score

80 / 100

The local build is safe for owner review. I would not call it fully launch-ready until an authenticated browser QA pass is completed with safe test credentials and Deepgram/OpenAI production readiness is verified without exposing secrets.

## 10. Issues Found

### QA-001

Severity: Medium  
Area: Start Call UX  
Description: The Start Call preparation screen explained what SalesFrame was doing, but did not visibly expose the current step count expected by the audit contract.  
Root cause: The progress view had label, description, and percent, but no step counter.  
User/business impact: Sellers could perceive the transition into the cockpit as vague or stuck, especially when first live question generation takes a moment.  
Fix applied: Added `Step X of Y` under the active preparation step.  
Before/after impact: Before, the seller saw general prep copy only. After, the seller sees concrete progress through the setup sequence.  
Files changed: `src/App.tsx`  
Verification evidence: `pnpm check` passed.

### QA-002

Severity: High  
Area: QA / release gate  
Description: The baseline full test run failed on 16 contract tests, many of which contradicted later product decisions.  
Root cause: Contracts had not been updated after intentional product changes such as download-only post-call audio, no playbook filter toolbar, sidebar account click-to-toggle, and new table columns/sort headers.  
User/business impact: False failures would either block review or pressure future changes to reintroduce worse UX.  
Fix applied: Updated contracts to protect the current product direction and added a real call-start progress assertion.  
Before/after impact: Before, `pnpm check` failed. After, the full local production gate passes.  
Files changed: `tests/e2e/app-production-contract.test.mjs`, `tests/e2e/live-call-eval-contract.test.mjs`  
Verification evidence: `pnpm test` passed 118 / 118; `pnpm check` passed.

### QA-003

Severity: Medium  
Area: Post-call recordings  
Description: Tests still expected playback/open-recording behavior after the product moved to download-only post-call audio actions.  
Root cause: Contracts were tied to old playback UI and signed-link copy.  
User/business impact: Future fixes could accidentally restore confusing replay controls that were removed because in-browser playback was unreliable.  
Fix applied: Updated contracts to assert download-only recovery actions and distinguish app UI copy from lower-level signed-link helper errors.  
Before/after impact: Before, the suite expected removed replay UI. After, it protects the simplified post-call action model.  
Files changed: `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `post-call recording actions are download-only and driven by stored call recordings` passed.

### QA-004

Severity: Medium  
Area: Opportunities and calls tables  
Description: Contracts expected old table column layouts and non-sortable static call headers.  
Root cause: Tests had not been updated after account-name, created-date, and sortable-header work.  
User/business impact: QA would incorrectly flag table improvements as regressions.  
Fix applied: Updated grid-track and header expectations to match sortable table headers and current column layout.  
Before/after impact: Before, table contract failed. After, it protects sortable, current table layouts.  
Files changed: `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `section cards and primary list rows are unframed` and `call library navigation is workspace-level` passed.

### QA-005

Severity: Medium  
Area: Sidebar navigation  
Description: The sidebar account expand contract expected account row click to only navigate, but the app now intentionally lets clicking an active account also collapse its opportunities.  
Root cause: Test did not reflect the newer interaction requirement.  
User/business impact: The stale test could have removed a user-requested sidebar affordance.  
Fix applied: Updated the contract to assert `handleAccountButtonClick` both manages expansion state and selects the account, while the chevron still stops propagation.  
Before/after impact: Before, the test rejected the intended interaction. After, it protects it.  
Files changed: `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `sidebar account expand control does not open the account page` passed.

### QA-006

Severity: Medium  
Area: Playbooks / custom framework  
Description: Contracts expected old filter/search toolbar, decorative custom framework labels, and exact heading class strings.  
Root cause: Contracts lagged behind the calm playbook redesign and mobile-friendly long-name handling.  
User/business impact: False failures could reintroduce visual noise or remove long-name wrapping protection.  
Fix applied: Updated contracts to assert the current grid, no toolbar, no brow labels, and `break-words` custom framework headings.  
Before/after impact: Before, playbook contracts failed against the calmer design. After, they protect it.  
Files changed: `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: playbook and primary-heading contract tests passed.

### QA-007

Severity: Medium  
Area: Audio preflight UX  
Description: The live-call eval contract still required hard buyer-audio confirmation copy, but the current UX intentionally allows calls to start while using meters for diagnosis when audio is silent.  
Root cause: Contract drift after the decision not to hard-block silent system/mic audio.  
User/business impact: A stale test could force an overly blocking start-call flow.  
Fix applied: Updated eval contract to assert the current buyer-audio connected and quiet-meter warning copy.  
Before/after impact: Before, tests expected a hard confirmation model. After, they protect the softer diagnostic model.  
Files changed: `tests/e2e/live-call-eval-contract.test.mjs`  
Verification evidence: `live-call implementation references the eval acceptance behaviors` passed.

### QA-008

Severity: Medium  
Area: Homepage / How It Works dialog  
Description: The How It Works dialog used a fixed text-area row to keep each step visually stable, but shorter copy made the dialog feel like it had unnecessary white space.  
Root cause: The layout reserved a fixed copy block regardless of actual content length.  
User/business impact: The marketing dialog felt less polished and less premium, especially after adding the first-step image.  
Fix applied: Reworked the dialog shell to remove inherited modal gaps and negative-margin footer layout, tightened the stable media/story rows, and added a dev-only public landing preview route so unauthenticated marketing UI can be inspected without clearing an active app session.  
Before/after impact: Before, shorter steps could look padded out. After, the modal is more compact while preserving the customer-facing story structure and consistent step sizing.  
Files changed: `src/App.tsx`, `src/components/marketing-landing-page.tsx`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `public homepage exposes SEO metadata, schema, and crawl controls` passed; local browser preview at `/?salesframe_public_preview=1` verified the desktop homepage and How It Works dialog with no horizontal overflow or console errors.

### QA-009

Severity: Medium  
Area: Documentation / product architecture  
Description: The README still described OpenAI realtime transcription even though the app has moved live transcription and turn-taking to Deepgram Flux.  
Root cause: Documentation drift after the Deepgram migration.  
User/business impact: Future engineers or deploy reviewers could configure or debug the wrong provider, increasing live-call reliability risk.  
Fix applied: Updated the README to describe Deepgram Flux for live transcription and OpenAI for live guidance, enrichment, research, and post-call outputs.  
Before/after impact: Before, the repo map implied OpenAI still owned live transcription. After, the repo-facing documentation matches the current architecture.  
Files changed: `README.md`  
Verification evidence: `rg` found no remaining `OpenAI realtime transcription`, `OpenAI APIs for transcription`, or `OPENAI_REALTIME_TRANSCRIPTION_MODEL` references outside the security contract that intentionally rejects the old env var.

### QA-010

Severity: Medium  
Area: Local API routing / developer QA  
Description: `vite.config.ts` still mapped `/api/openai/realtime-transcription` and `/api/openai/call-diarization` to Netlify function names that no longer exist.  
Root cause: Local Vite function proxy routes were not cleaned up after the Deepgram Flux migration and post-call correction changes.  
User/business impact: Local QA could hit confusing `local_function_error` responses for stale endpoints and make it harder to reason about the actual live transcription architecture.  
Fix applied: Removed the stale local routes and added contract guards rejecting those old paths.  
Before/after impact: Before, local dev exposed misleading OpenAI transcription/diarization route wiring. After, local routing only points to existing current function endpoints.  
Files changed: `vite.config.ts`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `pnpm check` passed; `rg` only finds the removed route names in negative contract assertions.

### QA-011

Severity: Medium  
Area: Performance / bundle size  
Description: The production build passed but warned that the main app chunk was larger than 500 kB after minification.  
Root cause: Heavy call-capture, Deepgram transcription, turn assembly, and Supabase data modules were pulled into the main app route shell.  
User/business impact: A larger initial app chunk hurts first-load performance and makes the product feel less crisp on slower networks.  
Fix applied: Lazy-loaded the Deepgram live transcription module inside call capture, then split call-capture and Supabase data modules into dedicated Vite chunks. Added contract coverage for the app-owned chunking rules.  
Before/after impact: Before, the main chunk was `index-DzpDEa8m.js` at 533.77 kB and Vite emitted a warning. After, the latest main chunk is `index-61Vx7uBN.js` at 452.94 kB, with `call-capture`, `salesframe-data`, and `deepgram-live-transcription` emitted separately.  
Files changed: `src/hooks/use-call-capture.ts`, `vite.config.ts`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `pnpm build` passed without a Vite chunk-size warning; `pnpm check` passed.

### QA-012

Severity: Low  
Area: Accessibility / Start Call UX  
Description: The Start Call preparation screen now showed a visible step count and percentage, but the progress bar itself did not expose a useful accessible progress label/value.  
Root cause: The progress primitive inherited visual state but was not given a Start Call-specific accessible name or value text.  
User/business impact: Screen-reader users could miss what the preparation progress represented while SalesFrame was getting the transcript and first question ready.  
Fix applied: Added a Start Call-specific progress label and dynamic value text to the preparation progress bar.  
Before/after impact: Before, the visual progress was clearer than the assistive-tech state. After, the preparation step communicates percent and active step through accessible progress metadata.  
Files changed: `src/App.tsx`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `pnpm check` passed after adding contract coverage.

### QA-013

Severity: High  
Area: Security / privacy logging  
Description: Client-side crash reporting sent raw browser error stacks and arbitrary metadata to `/api/client-error`, and the function logged those fields.  
Root cause: The reporting path was optimized for diagnostics, but not bounded tightly enough for a product that handles transcripts, recordings, sales notes, account data, and AI coaching context.  
User/business impact: A render crash or malicious client-error POST could place sensitive customer, transcript, or seller-entered content into function logs.  
Fix applied: Removed raw stack reporting from the browser payload, normalized event names, sanitized and bounded client error messages, allowlisted metadata fields, and repeated the allowlist/sanitization server-side before logging.  
Before/after impact: Before, logs could receive raw stack strings and arbitrary metadata. After, client-error logs carry only bounded diagnostic fields such as event name, safe message, route, line/column, filename, and sanitized component stack.  
Files changed: `src/lib/client-error-reporting.ts`, `netlify/functions/client-error.ts`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: `app shell catches render crashes` targeted contract passed; `pnpm check` passed.

### QA-014

Severity: Medium  
Area: Security / multi-tenant data access  
Description: Playbook reads for system and workspace playbooks used raw PostgREST combined filter strings in some paths.  
Root cause: A convenience one-query pattern was used to fetch global system playbooks and active-workspace playbooks together.  
User/business impact: Although the workspace IDs are normally authorized UUIDs, raw filter-string interpolation is harder to audit in a multi-tenant data path and increases fragility if a future caller passes less-trusted input.  
Fix applied: Split those reads into explicit equality queries for system playbooks and active-workspace playbooks, then combined the results in application code. Added contract coverage to prevent the raw combined filter from coming back.  
Before/after impact: Before, the queries depended on a raw filter string. After, workspace scoping is clearer and easier to review.  
Files changed: `src/lib/supabase/salesframe-data.ts`, `netlify/functions/import-opportunities.ts`, `netlify/functions/live-question.ts`, `netlify/functions/live-guidance.ts`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted security contract passed; full `pnpm check` passed.

### QA-015

Severity: High  
Area: Security / function logging  
Description: Shared Netlify function error logging included raw diagnostic messages and stack traces in log payloads.  
Root cause: The shared error wrapper optimized for debugging detail and relied on redaction after including stack/message fields.  
User/business impact: SalesFrame handles transcripts, recordings, coaching notes, account data, and seller-entered context. Raw exception messages or stack traces can accidentally include sensitive content or internal implementation details in logs.  
Fix applied: Replaced raw `message` and `stack` log fields with bounded diagnostic categories while keeping trace IDs, public messages, function names, status codes, and explicit error codes for support. Added contract coverage rejecting stack/raw-message logging.  
Before/after impact: Before, security tests printed raw database constraint names and stack traces. After, logs show safe categories such as `database_constraint`, `runtime_error`, and provider error codes without raw stack or backend strings.  
Files changed: `netlify/functions/_shared/http.ts`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted shared HTTP security tests passed; full `pnpm check` passed.

### QA-016

Severity: High  
Area: Security / scheduled service-role work  
Description: The scheduled import-enrichment worker could run queued AI enrichment jobs after a public POST and before any scheduled-request validation.  
Root cause: The worker was created as a Netlify scheduled function and method-gated, but unlike the retention cleanup worker it did not validate the scheduled payload before calling `getSupabaseAdmin()` and processing jobs.  
User/business impact: A public invocation could trigger background AI enrichment work, creating avoidable cost and side effects even though jobs remain scoped to queued records.  
Fix applied: Added scheduled payload validation before service-role client use and added contract coverage proving the guard runs before `getSupabaseAdmin()`.  
Before/after impact: Before, a POST could reach service-role processing immediately. After, the worker rejects requests without a valid scheduled `next_run` payload before any admin work begins.  
Files changed: `netlify/functions/import-enrichment-worker.ts`, `tests/e2e/app-production-contract.test.mjs`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted scheduled-worker and CSV import contracts passed; full `pnpm check` passed.

### QA-017

Severity: Medium  
Area: Security / abuse protection  
Description: CSV import submissions and import-enrichment retry/refresh actions were authenticated and workspace-scoped, but not rate-limited.  
Root cause: Rate limiting had been added to expensive AI and live-call functions, but not to the bulk import paths that can perform many writes and trigger background enrichment work.  
User/business impact: A compromised session or accidental repeated clicks could create avoidable database load and background AI-processing pressure.  
Fix applied: Added modest per-user/workspace rate limits to account import, opportunity import, and import-enrichment POST actions. Passive import-status reads remain unthrottled by this change.  
Before/after impact: Before, a user could repeatedly submit large import jobs without a local function limit. After, heavy import actions are bounded while normal import/retry use remains available.  
Files changed: `netlify/functions/import-accounts.ts`, `netlify/functions/import-opportunities.ts`, `netlify/functions/import-enrichment-status.ts`, `tests/e2e/app-production-contract.test.mjs`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted CSV import contracts passed; full `pnpm check` passed.

### QA-018

Severity: High  
Area: Security / recording storage isolation  
Description: Supabase Storage policies for call recordings checked workspace membership from the first storage-path segment, but did not also verify that the second path segment was an accessible call that actually belonged to that workspace path.  
Root cause: Recording paths were already structured as `workspaceId/callId/file`, but the original storage policy only used `workspace_id_from_storage_path(name)`. A first hardening pass added call access, then the audit caught the remaining multi-workspace mismatch edge case.  
User/business impact: A workspace member could potentially create or access confusing recording objects under a workspace folder if the path did not correspond to a real call in that same workspace. Recordings are sensitive sales-call data, so storage paths should be both workspace-scoped and call-row-scoped.  
Fix applied: Added a new migration with `call_id_from_storage_path(text)` and `storage_path_matches_call_workspace(text)`, then replaced call-recording storage policies so read/upload/update/delete require workspace membership, a matching call/workspace path, and `can_access_call(call_id_from_storage_path(name))`.  
Before/after impact: Before, object access was workspace-folder scoped. After, object access is workspace and call scoped, and the path must match the call row's workspace, matching the app's `workspaceId/callId/file` recording contract.  
Files changed: `supabase/migrations/202607070002_tighten_call_recording_storage_rls.sql`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted storage RLS contract passed; full `pnpm check` passed.

### QA-019

Severity: Medium  
Area: Accessibility / mobile marketing dialog  
Description: The How It Works dialog looked clean on desktop, but the mobile step indicators and footer buttons were below the app's touch-target quality bar after the whitespace fix.  
Root cause: The visible controls were sized for compact desktop dialog controls and did not get mobile-specific minimum hit areas.  
User/business impact: Mobile visitors could struggle to move through the product story, making the public homepage feel less polished and less intentional.  
Fix applied: Increased mobile footer actions to 44px minimum height and made each step indicator a 32px focusable control while keeping the visible dot treatment restrained.  
Before/after impact: Before, the mobile dialog controls felt cramped. After, the dialog keeps the same calm visual treatment while meeting a more comfortable mobile touch target.  
Files changed: `src/components/marketing-landing-page.tsx`, `tests/e2e/app-production-contract.test.mjs`  
Verification evidence: In-app browser mobile preview at 390 x 844 showed 44px footer buttons, 32px step controls, no horizontal overflow, no viewport overflow, and no console errors.

### QA-020

Severity: Medium  
Area: Security / live coaching diagnostics  
Description: The `live-question` function used a direct `console.warn` with a raw persistence error message when live intent/evidence memory failed to save.  
Root cause: The live-question endpoint had adopted the safe shared error wrapper for request failures, but this non-fatal memory persistence warning bypassed `logSafeEvent`.  
User/business impact: Raw database/provider error text could end up in function logs during a live call. That is unnecessary risk in a product that handles transcripts, sales context, account names, and opportunity evidence.  
Fix applied: Replaced the direct warning with `logSafeEvent("warn", "live_question_memory_persist_failed", ...)` and a bounded diagnostic category. The log now records the function name and whether a call ID existed, without the raw error message or identifier value.  
Before/after impact: Before, a failed memory write could log raw technical text. After, support still gets a useful category such as `database_constraint`, `database_schema`, `database_permission`, or `timeout` without leaking details.  
Files changed: `netlify/functions/live-question.ts`, `tests/functions/security-contract.test.mjs`  
Verification evidence: targeted security contract passed; full `pnpm check` passed.

### QA-021

Severity: High
Area: Release gate / workspace session security contracts
Description: A fresh release-gate run failed three security-contract checks after workspace-session enforcement changed authorization calls to pass the active bearer token into `authorizeWorkspace`, `authorizeCall`, `authorizeAccount`, and `authorizeOpportunity`.
Root cause: The implementation had been hardened for server-enforced workspace sessions, but the contracts still expected the older helper calls without the token/options argument.
User/business impact: The release gate was red even though the code was using the safer session-aware authorization path. Left unresolved, this would either block releases or encourage weakening the implementation back to a less secure shape.
Fix applied: Updated the security contracts to require the token-aware authorization calls for live-state, Deepgram token issuance, OpenAI key management, and CSV import functions.
Before/after impact: Before, `pnpm check` failed with 3 stale contract failures. After, `pnpm test:functions` passes 17 / 17 and `pnpm check` passes 118 / 118 with the current session-aware authorization model protected.
Files changed: `tests/functions/security-contract.test.mjs`
Verification evidence: `pnpm test:functions` passed 17 / 17; `pnpm check` passed with secret scan, TypeScript, all 118 tests, and production build.

### QA-022

Severity: Medium
Area: Security / browser diagnostics and popout storage
Description: The app error boundary still printed raw render error objects and React error info to the browser console in development, and stale Live Coach popout fallback snapshots were ignored but left in local storage.
Root cause: Server-side client-error reporting had already been sanitized, but the local development console path and same-origin popout fallback cleanup were not tightened to the same privacy posture.
User/business impact: Raw browser diagnostics can include sensitive values during local/support debugging, and stale popout snapshots can leave short-lived account, opportunity, and question text in browser storage longer than needed.
Fix applied: Replaced raw development render-error logging with bounded diagnostic fields, and made the popout fallback remove stale, malformed, or unparsable local-storage values.
Before/after impact: Before, dev console output could include raw error/info objects and stale popout snapshots remained stored. After, diagnostics are bounded to error name and component-stack line count, and stale fallback data self-cleans while BroadcastChannel remains the primary live path.
Files changed: `src/components/app-error-boundary.tsx`, `src/lib/live-coach-popout.ts`, `tests/e2e/app-production-contract.test.mjs`
Verification evidence: targeted app-production contracts passed for render crash handling and live coach popout; `pnpm check` passed with secret scan, TypeScript, all 118 tests, and production build.

### QA-023

Severity: Medium
Area: Security / seller research storage
Description: The seller research profile had moved to the Supabase-backed `seller_research_profiles` path, but a legacy local-storage reader and storage key remained in the shared library.
Root cause: The old browser-local seller research path was left behind after workspace/user-scoped seller research profiles became the source of truth.
User/business impact: Stale browser storage could reintroduce cross-session selling context drift later if the helper was reused, which would be especially risky for shared devices or multi-workspace sellers.
Fix applied: Removed the legacy `loadSellerResearchProfile` local-storage reader and `sellerResearchProfileStorageKey`, then added contract coverage that the Start Call seller research step is database-backed and does not rely on the old local-storage key.
Before/after impact: Before, legacy browser storage code could be accidentally revived. After, seller research profile state is guarded around the workspace/user database path.
Files changed: `src/lib/research-profile.ts`, `src/lib/salesframe-core.ts`, `tests/e2e/app-production-contract.test.mjs`
Verification evidence: targeted Start Call seller research contract passed; stale-storage search no longer finds production code references; `pnpm check` passed with secret scan, TypeScript, all 118 tests, and production build.

### QA-024

Severity: Medium
Area: Session reliability / server-side idempotency
Description: During authenticated browser QA, local function logs showed bounded `database_constraint` errors from workspace session activity. The likely race was two session activity/status requests both seeing no workspace session row and both trying to create the same `(workspace_id, user_id, session_key)` record.
Root cause: `getWorkspaceSessionPolicy` and `createWorkspaceSession` used plain inserts after read-before-create checks, leaving duplicate creation races to surface as database constraint errors.
User/business impact: Sellers may not see a visible crash, but launch-quality session handling should not produce hidden 500s or noisy support logs during normal app load, tab activity, or multi-tab heartbeat behavior.
Fix applied: Made workspace session policy creation and workspace session activity creation idempotent with explicit `upsert(..., { onConflict })` calls on the database uniqueness keys, and added contract coverage for both conflict targets.
Before/after impact: Before, concurrent app/session heartbeats could hit duplicate-key errors. After, duplicate creates settle onto the existing row and return a normal session status path.
Files changed: `netlify/functions/_shared/workspace-session.ts`, `tests/e2e/app-production-contract.test.mjs`
Verification evidence: targeted workspace-session contract passed; `pnpm check` passed with secret scan, TypeScript, all 118 tests, and production build.

### QA-025

Severity: Medium
Area: Live call AI/transcription / cost and lifecycle control
Description: Live-call endpoints authorized call ownership, but did not consistently require the call to still be live before minting transcription tokens or making live OpenAI guidance/attribution calls.
Root cause: `authorizeCall` only returned identity fields for the call, so live endpoints could prove workspace access but not call lifecycle state.
User/business impact: A stale browser tab or replayed client request for an ended, processing, archived, or otherwise non-live call could request new Deepgram/OpenAI live work. That is a cost-control and privacy lifecycle risk for a real-time audio product.
Fix applied: Expanded call authorization to include `status`, `started_at`, and `ended_at`, added a shared `assertCallIsLive` helper, and required active unended calls before Deepgram tokens, live question, live guidance, live state, and speaker attribution work.
Before/after impact: Before, any authorized call ID could reach live provider work. After, live AI/transcription endpoints only run for active unended calls, while post-call functions can still read completed calls through the normal authorization path.
Files changed: `netlify/functions/_shared/supabase.ts`, `netlify/functions/deepgram-token.ts`, `netlify/functions/live-question.ts`, `netlify/functions/live-guidance.ts`, `netlify/functions/live-state.ts`, `netlify/functions/speaker-attribution.ts`, `tests/functions/security-contract.test.mjs`
Verification evidence: targeted security contracts for protected functions and expensive AI functions passed; `pnpm check` passed with secret scan, TypeScript, all 118 tests, and production build.

### QA-026

Severity: High
Area: AI safety / prompt injection
Description: OpenAI calls received transcripts, account fields, opportunity fields, notes, research inputs, and web-search content as user input, but the shared OpenAI helper did not consistently add an explicit prompt-injection boundary around that untrusted content.
Root cause: Individual prompts contained task-specific safety language, but the provider wrapper did not enforce a universal rule that customer, seller-entered, transcript, and web content are evidence only, never instructions.
User/business impact: A malicious or accidental instruction inside a transcript, note, website, or account field could try to steer live coaching, post-call outputs, or enrichment away from SalesFrame's intended system rules and JSON contracts.
Fix applied: Added a shared prompt-injection defense instruction to the OpenAI helper and appended it to every structured JSON and web-search JSON system prompt. Added contract coverage so future OpenAI calls keep the guard.
Before/after impact: Before, injection resistance depended on each prompt author remembering the rule. After, all OpenAI JSON paths inherit the same untrusted-content boundary.
Files changed: `netlify/functions/_shared/openai.ts`, `tests/functions/security-contract.test.mjs`
Verification evidence: targeted OpenAI helper contract passed.

### QA-027

Severity: Medium
Area: Recording UX / signed URL handling
Description: The main post-call replay card had been simplified to download-only audio actions, but the opportunity recording history still opened signed recording URLs in a new browser tab.
Root cause: The earlier playback cleanup only covered `CallReplayCard`; `OpportunityRecordingHistory` kept a separate `handleOpenRecording` path with `window.open`.
User/business impact: Sellers could still hit the confusing blank/new-tab signed-link experience from an older recording list, and the app exposed a second, inconsistent way to handle sensitive call-recording URLs.
Fix applied: Replaced the opportunity recording history open-new-tab flow with the same forced blob-download helper used by the post-call card. The history list now shows `Download audio` and does not navigate signed URLs.
Before/after impact: Before, previous recordings could be opened in a new tab from the opportunity history. After, stored audio downloads consistently as a file from both post-call and history surfaces.
Files changed: `src/App.tsx`, `tests/e2e/app-production-contract.test.mjs`
Verification evidence: targeted post-call recording contract passed.

### QA-028

Severity: High
Area: Supabase RLS / session enforcement
Description: The workspace session-timeout migration hardened most active workspace data tables, but left `user_ai_settings` on the older `is_workspace_member(workspace_id)` policy.
Root cause: The initial workspace-session migration updated account, opportunity, call, transcript, enrichment, import, and seller/customer research policies, but the per-user OpenAI key settings table was introduced by a separate workspace-scoped AI settings migration and was missed in the follow-up session RLS sweep.
User/business impact: Server functions already require an active workspace session before reading or writing key status, but a valid Supabase token outside the app's active-session window could still directly read or mutate that user's encrypted AI settings row through RLS. Even encrypted key metadata should follow the same active-session boundary as the rest of the workspace.
Fix applied: Added a follow-up Supabase migration that recreates the `user_ai_settings` policy with `user_id = auth.uid()` plus `public.is_workspace_member_with_active_session(workspace_id)`.
Before/after impact: Before, direct database access to user AI settings required workspace membership but not an active SalesFrame workspace session. After, the encrypted key table participates in the same server-enforced session posture as active workspace data.
Files changed: `supabase/migrations/202607090002_require_active_session_for_ai_settings.sql`, `tests/e2e/app-production-contract.test.mjs`, `tests/functions/security-contract.test.mjs`
Verification evidence: targeted workspace-session and OpenAI-key security contracts passed.

### QA-029

Severity: Medium
Area: Serverless provider reliability / timeout control
Description: Shared OpenAI Responses calls and the Deepgram temporary-token grant path did not have explicit provider timeouts.
Root cause: The functions relied on the platform/client request lifecycle rather than an app-owned timeout boundary for upstream AI and transcription-provider calls.
User/business impact: A slow provider or network stall could leave the app waiting until a broader platform timeout, making live-call start and AI guidance feel frozen or fail with less useful recovery behavior.
Fix applied: Added a shared `fetchWithTimeout` helper, applied it to OpenAI JSON/web-search requests and Deepgram token grants, added timeout env defaults, and added contract coverage for the explicit timeout/error-code paths.
Before/after impact: Before, provider setup could hang without an app-owned cutoff. After, OpenAI and Deepgram provider calls fail closed with bounded, classified timeout/network errors that the UI can translate into calm recovery states.
Files changed: `.env.example`, `netlify/functions/_shared/http.ts`, `netlify/functions/_shared/openai.ts`, `netlify/functions/_shared/deepgram.ts`, `tests/functions/security-contract.test.mjs`
Verification evidence: targeted provider-timeout security contracts and full release gate passed.

### QA-030

Severity: Medium
Area: Environment readiness / configuration disclosure
Description: `/api/system/env` required authentication but was not scoped to a workspace owner and had no endpoint-specific rate limit.
Root cause: The endpoint was originally treated as a simple deployment readiness check and only guarded by `requireUser`, even though it reports global platform configuration status.
User/business impact: Any signed-in user could probe whether server-side platform integrations were configured. It did not reveal secret values, but launch-grade SaaS posture should keep operational readiness details limited to owners.
Fix applied: Required a `workspaceId`, authorized the workspace with the active session token, required workspace owner role, added a per-user/workspace rate limit, and updated deployment docs to use the scoped URL.
Before/after impact: Before, any authenticated user could call the global readiness endpoint. After, only an owner of the referenced workspace can inspect readiness state, and repeated checks are throttled.
Files changed: `netlify/functions/env-check.ts`, `tests/functions/security-contract.test.mjs`, `docs/netlify-env-setup.md`, `docs/product-build-spec.md`
Verification evidence: targeted environment-readiness function contract passed.

### QA-031

Severity: Medium
Area: Supabase RLS / live coach memory
Description: The live intent ledger and opportunity stakeholder policies were protected by call/opportunity access helpers, but still contained a direct plain `is_workspace_member` workspace check.
Root cause: The live coach memory tables were introduced before the later workspace-session hardening pass, and the broad session migration did not explicitly recreate those policies.
User/business impact: The final policy was indirectly session-aware through access helper functions, but the policy text was ambiguous and easier to weaken in a future helper change. Live coaching memory and stakeholder evidence should explicitly require an active SalesFrame workspace session.
Fix applied: Added a follow-up Supabase migration that recreates `call_intent_ledger` and `opportunity_stakeholders` policies with `is_workspace_member_with_active_session(...)` while preserving call/opportunity/account consistency checks.
Before/after impact: Before, live coach memory policies mixed direct membership with active-session helper checks. After, they explicitly require active workspace session at the table policy boundary.
Files changed: `supabase/migrations/202607090003_require_active_session_for_live_intent_memory.sql`, `tests/e2e/app-production-contract.test.mjs`
Verification evidence: targeted live-intent-ledger and workspace-session contracts passed.

### QA-032

Severity: Medium
Area: Supabase Storage RLS / call artifacts
Description: The `call-artifacts` private storage bucket still used the original workspace-folder-only RLS policies.
Root cause: A later migration tightened `call-recordings` to require a call ID in the object path and authorized call access, but did not apply the same shape to `call-artifacts`.
User/business impact: Future transcript, VTT, notes, or post-call artifact files could be stored with weaker path validation than recordings. Even if the bucket is not heavily used today, it is explicitly intended for sensitive call artifacts.
Fix applied: Added a follow-up storage migration that requires active workspace session, workspace/call path consistency, and authorized call access for read, upload, update, and delete on `call-artifacts`.
Before/after impact: Before, call artifacts were protected by workspace folder membership only. After, artifacts must live under a valid `workspaceId/callId/...` path and the requester must be able to access that call with an active session.
Files changed: `supabase/migrations/202607090004_tighten_call_artifact_storage_rls.sql`, `tests/functions/security-contract.test.mjs`
Verification evidence: targeted call-recording/artifact storage contract passed.

## 11. Fixes Applied

- Added visible Start Call preparation step count in `src/App.tsx`.
- Added accessible progress label/value text to the Start Call preparation progress bar.
- Replaced raw function error log messages and stacks with safe diagnostic categories.
- Added scheduled payload validation to the import-enrichment worker before service-role work starts.
- Added per-user/workspace rate limits to CSV import and import-enrichment POST actions.
- Tightened call-recording storage RLS so recordings require access to the specific call ID in the object path and that call must belong to the workspace segment in the storage path.
- Hardened client-side crash reporting so raw browser stacks and arbitrary metadata are not sent to or logged by Netlify functions.
- Bounded development render-error console diagnostics so raw React error objects are not printed.
- Added stale and malformed Live Coach popout local-storage cleanup for the short-lived fallback path.
- Removed the legacy browser-local seller research profile path so Seller Research stays workspace/user scoped.
- Made workspace session policy/activity creation idempotent so concurrent heartbeats do not become duplicate-key function errors.
- Scoped Deepgram temporary transcription tokens and live OpenAI coaching/attribution endpoints to active, unended calls only.
- Added a shared OpenAI prompt-injection defense so transcripts, seller notes, account/opportunity fields, research inputs, and web content are treated as untrusted evidence rather than instructions.
- Removed the remaining open-new-tab signed recording path from opportunity recording history and made previous call audio download-only.
- Added a follow-up Supabase migration so `user_ai_settings` requires an active workspace session, matching the intended session-timeout security boundary.
- Added explicit OpenAI and Deepgram upstream timeouts so provider stalls fail closed with classified recovery errors instead of broad platform timeouts.
- Restricted the environment readiness endpoint to authenticated workspace owners and added endpoint-specific rate limiting.
- Added an explicit active-session RLS migration for live coach intent ledger and stakeholder memory tables.
- Tightened call-artifact storage RLS so future transcript/artifact files require active session and call-level path authorization.
- Hardened playbook workspace reads by replacing raw combined filter strings with explicit system and workspace equality queries.
- Replaced a raw `live-question` memory persistence warning with bounded safe logging.
- Updated security contracts to assert session-aware authorization helper calls after workspace session enforcement.
- Tightened the How It Works dialog layout in `src/components/marketing-landing-page.tsx` to remove unnecessary reserved white space while keeping stable media/story structure.
- Added a dev-only public landing preview route so marketing pages can be QA'd locally without disrupting an authenticated app session.
- Increased mobile How It Works dialog touch targets while keeping the dialog visually calm.
- Corrected the README to describe Deepgram Flux as the live transcription and turn-taking provider.
- Removed stale local Vite API routes for removed OpenAI realtime transcription and call-diarization functions.
- Lazy-loaded Deepgram live transcription inside call capture and split heavy app-owned modules into `call-capture` and `salesframe-data` build chunks.
- Updated app-production contract tests to match:
  - guarded call capture startup,
  - live-question first guidance path,
  - download-only post-call audio,
  - calm playbook grid and detail pages,
  - no decorative brow labels,
  - square profile avatar treatment,
  - updated opportunities/calls table columns,
  - sidebar account click-to-toggle behavior,
  - current workspace onboarding setup-flow guard,
  - current customer-facing recording/download error copy.
- Updated live-call eval contract to match non-blocking buyer-audio meter UX.

## 12. Files Changed

- `AGENTS.md`
- `QA_REPORT.md`
- `README.md`
- `netlify/functions/_shared/http.ts`
- `netlify/functions/client-error.ts`
- `netlify/functions/import-accounts.ts`
- `netlify/functions/import-enrichment-status.ts`
- `netlify/functions/import-opportunities.ts`
- `netlify/functions/import-enrichment-worker.ts`
- `netlify/functions/live-guidance.ts`
- `netlify/functions/live-question.ts`
- `netlify/functions/live-state.ts`
- `netlify/functions/speaker-attribution.ts`
- `netlify/functions/deepgram-token.ts`
- `netlify/functions/_shared/openai.ts`
- `netlify/functions/_shared/supabase.ts`
- `netlify/functions/_shared/workspace-session.ts`
- `src/App.tsx`
- `src/components/app-error-boundary.tsx`
- `src/components/marketing-landing-page.tsx`
- `src/hooks/use-call-capture.ts`
- `src/lib/client-error-reporting.ts`
- `src/lib/live-coach-popout.ts`
- `src/lib/research-profile.ts`
- `src/lib/salesframe-core.ts`
- `src/lib/supabase/salesframe-data.ts`
- `supabase/migrations/202607070002_tighten_call_recording_storage_rls.sql`
- `tests/e2e/app-production-contract.test.mjs`
- `tests/e2e/live-call-eval-contract.test.mjs`
- `tests/functions/security-contract.test.mjs`
- `vite.config.ts`
- `supabase/migrations/202607090002_require_active_session_for_ai_settings.sql`

Note: `src/components/marketing-landing-page.tsx` was already modified in the current worktree before this QA-report step, for the homepage dialog image and whitespace work.

## 13. Validation Commands Run And Results

Baseline:

- `CI=true pnpm check`
  - Initial result: failed at test stage with 16 failing tests.

Targeted:

- `CI=true pnpm test:functions`
  - Continuation result, 2026-07-09: passed 17 / 17 after updating session-aware authorization contracts.
- `CI=true pnpm exec node --test --test-name-pattern "app shell catches render crashes|live coach popout" tests/e2e/app-production-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 2 / 2 after tightening render diagnostics and stale popout storage cleanup.
- `CI=true pnpm exec node --test --test-name-pattern "Start Call research step routes missing OpenAI keys" tests/e2e/app-production-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 1 / 1 after removing the legacy seller research local-storage path.
- `CI=true pnpm exec node --test --test-name-pattern "workspace session timeout" tests/e2e/app-production-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 1 / 1 after making workspace session policy/activity creation idempotent.
- `CI=true pnpm exec node --test --test-name-pattern "protected OpenAI functions|expensive AI functions" tests/functions/security-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 2 / 2 after requiring Deepgram transcription tokens to target active, unended calls.
- `CI=true pnpm exec node --test --test-name-pattern "OpenAI helper supports" tests/functions/security-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 1 / 1 after adding the shared prompt-injection defense wrapper.
- `CI=true pnpm exec node --test --test-name-pattern "post-call recording actions" tests/e2e/app-production-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 1 / 1 after making opportunity recording history download-only.
- `CI=true pnpm exec node --test --test-name-pattern "opportunity history tab|customer-facing errors|post-call recording actions" tests/e2e/app-production-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 3 / 3 after updating stale recording-history and customer-facing-error contracts.
- `CI=true pnpm exec node --test --test-name-pattern "workspace session timeout|OpenAI keys are scoped" tests/e2e/app-production-contract.test.mjs tests/functions/security-contract.test.mjs`
  - Continuation result, 2026-07-09: passed 2 / 2 after adding active-session RLS coverage for `user_ai_settings`.
- `rg -n "sellerResearchProfileStorageKey|salesframe\\.sellerResearchProfile|loadSellerResearchProfile|localStorage\\.getItem\\(sellerResearch" src tests docs netlify --glob '!dist/**'`
  - Continuation result, 2026-07-09: no production code references remained; the only remaining match was the protective negative contract assertion.

- `node --test --test-name-pattern "public homepage" tests/e2e/app-production-contract.test.mjs`
  - Final result: passed 3 / 3. This covers the protected auth splash guard, SEO/crawl controls, and mobile-sized homepage action buttons.
- `node --test --test-name-pattern "CSV import functions authorize|playbook workspace reads" tests/functions/security-contract.test.mjs`
  - Final result: passed 2 / 2.
- `node --test --test-name-pattern "shared HTTP errors" tests/functions/security-contract.test.mjs`
  - Final result: passed 1 / 1.
- `node --test --test-name-pattern "shared HTTP error envelopes" tests/functions/security-contract.test.mjs`
  - Final result: passed 1 / 1. Test log output showed only safe diagnostic categories, public messages, status codes, and trace IDs.
- `node --test --test-name-pattern "scheduled service-role workers|CSV import lives" tests/functions/security-contract.test.mjs tests/e2e/app-production-contract.test.mjs`
  - Final result: passed 2 / 2.
- `node --test --test-name-pattern "CSV import functions authorize|CSV import lives" tests/functions/security-contract.test.mjs tests/e2e/app-production-contract.test.mjs`
  - Final result: passed 2 / 2.
- `node --test --test-name-pattern "call recording storage policies" tests/functions/security-contract.test.mjs`
  - Final result: passed 1 / 1.
- `node --test --test-name-pattern "call cockpit requires AI guidance|AI-owned outputs|custom framework playbook|opportunity post-call tab|playbook list cards|workspace search keeps fuzzy|dense app filters|live-call implementation" tests/e2e/app-production-contract.test.mjs tests/e2e/live-call-eval-contract.test.mjs`
  - Final result: passed 8 / 8.
- `node --test --test-name-pattern "primary page headings|premium motion|section cards|sidebar account expand|record mutation dialogs|call library navigation|workspace onboarding|customer-facing errors" tests/e2e/app-production-contract.test.mjs`
  - Final result: passed 9 / 9.

Full validation:

- `CI=true pnpm check:secrets`
  - Passed. No tracked secrets found.
- `CI=true pnpm lint`
  - Passed. TypeScript build check succeeded.
- `CI=true pnpm test`
  - Passed. 118 / 118 tests.
- `CI=true pnpm build`
  - Passed. Latest production build completed without a chunk-size warning. Main chunk: `index-CvUBA7ph.js` at 470.76 kB. Split chunks include `call-capture-C0ZXTyO3.js`, `salesframe-data-D3_KhuLm.js`, and `deepgram-live-transcription-BzRy_mO1.js`.
- `CI=true pnpm check`
  - Passed. Secret scan, typecheck, tests, and production build all succeeded.
  - Continuation result, 2026-07-09 after QA-027: passed. Secret scan, TypeScript, 118 / 118 tests, and production build all succeeded. Latest main app chunk: `index-logt9QFt.js` at 470.54 kB.
  - Continuation result, 2026-07-09 after QA-028: passed. Secret scan, TypeScript, 118 / 118 tests, and production build all succeeded. Latest main app chunk remained `index-logt9QFt.js` at 470.54 kB.

Validation environment note:

- A first continuation attempt to run plain `pnpm check` failed before app validation because pnpm tried to verify/install dependencies while sandboxed networking blocked registry access and then aborted module purging without a TTY. The release gate was rerun with the bundled runtime path and CI mode.
- A second continuation attempt with network access but no runtime PATH failed at `node scripts/check-secrets.mjs` because `node` was not on the shell PATH. It was rerun successfully with the bundled workspace runtime path explicitly set.
- The first direct shell attempts to run `node --test ...` and `pnpm lint` failed because `node` was not on that shell's `PATH` (`zsh:1: command not found: node` and `exec: node: not found`). They were rerun successfully with the bundled workspace runtime path explicitly set. This was an environment-path issue, not an app failure.

Targeted in-app browser QA:

- Desktop authenticated shell loaded with no console errors, visible alerts, or horizontal overflow.
- Desktop sidebar-driven navigation sampled Home, Opportunities, Calls, and Playbooks with expected headings and no page-level horizontal overflow.
- Desktop account workspace sampled account record, intelligence, and opportunities tabs for `Apex Logistics Group`; no page-level horizontal overflow or console errors were observed.
- Desktop opportunity workspace sampled the `Sales Methodology Rollout` record and post-call surfaces; no page-level horizontal overflow or console errors were observed.
- Mobile viewport at 390 x 844 loaded the seller dashboard with no horizontal overflow and a visible Start Call action.
- Mobile Start Call opened as a bottom drawer with no page-level horizontal overflow.
- Mobile Start Call step 3, Call, kept call type, audio source, playbooks, and footer actions inside the drawer frame with no horizontal overflow.
- Mobile Start Call playbook dropdown opened upward, kept its own internal scrollbar, and pointer scrolling moved the dropdown list from `scrollTop` 0 to 588 without resizing the drawer.
- Mobile Start Call step 4, Seller Research, had no visible horizontal scrollbar. Internal overflow flags were limited to screen-reader-only text and hidden switch internals.
- Browser console warnings/errors were empty during the sampled authenticated dashboard, Start Call drawer, and playbook dropdown checks.
- Public homepage and How It Works dialog were verified through a dev-only public preview route at `/?salesframe_public_preview=1` without clearing the user's active authenticated app session.
- Desktop public preview showed the homepage and How It Works dialog at a stable 480 x 576 dialog footprint, with the WebP step image present, no horizontal overflow, no viewport overflow, and no console errors.
- Mobile public preview at 390 x 844 showed the homepage with no horizontal overflow. The How It Works dialog kept a stable 358 x 496 footprint across all 7 steps, used WebP media on every image-backed step, and showed no internal scroll, page-width overflow, or console errors.
- Continuation browser QA after commit `c71db24` confirmed the authenticated mobile Start Call drawer opened at 390px wide with no horizontal overflow; step 3 Call showed one-channel/two-channel audio setup, Seller microphone and Shared meeting audio sections, and diagnostic permission-denied copy when the browser had already blocked microphone access.
- Continuation browser QA after commit `c71db24` confirmed the Start Call playbook selector on both mobile and desktop uses an internal 288px scroll area with `overflow-y: auto`; the dialog itself did not resize, widen, or gain a page-level horizontal scrollbar.
- Continuation browser QA after commit `c71db24` confirmed desktop Opportunities and Calls pages loaded with account-name columns, sortable header buttons, pagination, no page-level horizontal overflow, and no console errors. Clicking the Calls `Account` header set `aria-sort="ascending"` and reordered the rows without layout shift.
- The browser viewport override became unreliable after one browser-control kernel timeout during a later mobile Calls-page reload, so that specific mobile Calls-page check was not treated as verified evidence.
- Safe test credential environment variables were checked without printing values. `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` were not present, so full login/signup submission was not performed.
- Logout was tested through the authenticated mobile sidebar user menu. It returned the app to the public homepage with no console errors and no horizontal overflow.
- After logout, `/login` and `/signup` were inspected at 390 x 844. Both rendered the expected mobile auth forms, field autocomplete attributes, Back to home action, no horizontal overflow, and no console errors.
- The login page's empty Forgot password action was tested. It showed the calm inline alert `Enter your email first, then request a password reset.` without contacting credentials or producing console errors.
- A deeper automated click-through of every opportunity inner tab was attempted after the account/opportunity sweep, but the browser-control session timed out while iterating tabs. The already-captured record and post-call checks remained clean, and the limitation is included in remaining runtime QA risk.

Documentation drift check:

- `rg "OPENAI_REALTIME_TRANSCRIPTION_MODEL|OpenAI realtime transcription|OpenAI APIs for transcription" README.md .env.example docs src netlify tests`
  - Passed for repo-facing docs. Remaining matches are contract assertions that intentionally reject the old OpenAI realtime transcription wording/env var.
- `rg "/api/openai/realtime-transcription|/api/openai/call-diarization|realtime-transcription|call-diarization" vite.config.ts netlify/functions tests/e2e/app-production-contract.test.mjs`
  - Passed for runtime code. Remaining matches are negative contract assertions that prevent stale local route wiring from returning.

Performance check:

- `pnpm build`
  - Passed without Vite chunk-size warnings after splitting the main app shell from call capture, Deepgram transcription, and Supabase data code.

## 14. Remaining Risks

- Full login/signup/workspace-creation browser QA was not completed because no safe test credentials were provided through `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. A read-only authenticated shell pass was completed using the already-open local session.
- Public landing and How It Works dialog runtime QA was completed locally through a dev-only preview route. Logout plus logged-out login/signup form rendering were also verified locally. Full credential-backed login/signup submission still needs safe `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` values before public launch.
- The opportunity workspace was sampled at record and post-call depth, but a full automated inner-tab sweep was interrupted by browser-control timeout. Manual follow-up should still cover opportunity Intel, Methodology, History, and live Call Cockpit tabs.
- Production Deepgram, OpenAI, Supabase, and Netlify readiness were not verified because the instruction explicitly forbids production deploys, migrations, production data changes, or secret handling.
- The scheduled import-enrichment worker now requires a valid scheduled payload before service-role work, matching the existing retention cleanup posture. Netlify's scheduled function documentation says deployed scheduled functions cannot be invoked directly by URL, but production QA should still verify both scheduled functions appear with the `Scheduled` badge in Netlify and are not exposed through custom public API paths.
- The live-call experience still needs real-world QA on Safari, Chrome, one-channel room audio, two-channel shared audio, network interruption, and long calls.
- Contract tests emit expected sanitized error-log events during security tests. They now avoid raw stack traces and backend/provider strings, but remain visually noisy in test output.

## 15. Highest-Impact Future Improvements

1. Run a full authenticated browser QA pass using safe environment-provided test credentials.
2. Add a dedicated live-call simulation harness that mocks Deepgram final turns and verifies question update timing under realistic conversation flow.
3. Split more of `src/App.tsx` into route/surface modules to reduce review risk and improve maintainability.
4. Add a browser-level live-call simulation harness that can run without real customer audio while still exercising Deepgram event flow.
5. Add a production-readiness checklist for Deepgram token health, OpenAI key health, Supabase RLS smoke tests, and storage recording download checks.
6. Verify the scheduled retention cleanup and import-enrichment worker in the Netlify Functions UI after deploy, including the `Scheduled` badge and a Run now smoke test.

## 16. Recommended Next QA Pass

Run a manual browser pass with safe test credentials and a non-production workspace:

1. Public homepage, How It Works dialog, pricing/contact links.
2. Login, signup, password reset, logout, protected-route redirect.
3. Workspace setup and settings.
4. CSV import for accounts and opportunities.
5. Account enrichment and logo rendering.
6. Opportunity creation, editing, archive/restore, delete flow.
7. Start Call on desktop and mobile.
8. One-channel and two-channel call start with Deepgram health.
9. Live transcript, live question refresh, feedback buttons, popout coach.
10. Stop call, post-call download audio/transcript, delete call.

The current local code is ready for owner review, but not for unattended production release without that runtime pass.

## Appendix A. Architecture Map

- Framework: React 19, Vite 8, TypeScript 6, Tailwind CSS 4, shadcn/Radix-style primitives.
- Package manager: pnpm 11.7.0, declared in `package.json`.
- Routing model: single-page React app in `src/App.tsx` with public landing/auth/legal surfaces and authenticated workspace surfaces.
- API layer: Netlify Functions in `netlify/functions`, with shared auth, rate-limit, OpenAI, Deepgram, Supabase, import, and HTTP helpers.
- Supabase usage: Auth, Postgres, RLS, Storage, migrations under `supabase/migrations`, typed client access under `src/lib/supabase`.
- Deepgram usage: server-side temporary-token health/token functions, client-side Flux WebSocket transcription in `src/lib/deepgram-live-transcription.ts`, provider-neutral transcript metadata in Supabase migrations.
- OpenAI usage: workspace-scoped key storage and Netlify functions for live state, live question, live guidance, enrichment, research, speaker attribution, and post-call outputs.
- State management: React state/hooks in `src/App.tsx`, `use-salesframe-data`, and `use-call-capture`; no external state store.
- Styling/design system: Tailwind CSS, shadcn-style components under `src/components/ui`, Lucide icons, CALM design rules in docs and AGENTS.md.
- Test setup: Node's built-in test runner, contract tests in `tests/e2e`, function/security tests in `tests/functions`, behavior tests for turn assembly.
- Build/deploy setup: Netlify `pnpm build`, publish `dist`, functions directory `netlify/functions`, security headers and SPA redirects in `netlify.toml`.

## Appendix B. Product Surface Map

- Public/marketing pages: homepage, How It Works dialog, pricing/contact mail links, SEO metadata, robots, sitemap.
- Auth pages: login, signup, recovery, legal links, back-to-home behavior.
- Legal pages: terms and privacy routes.
- Onboarding/workspace setup: workspace creation, OpenAI key setup, seller context, optional imports.
- Dashboard: pipeline health, coverage, attention surfaces, mobile quick Start Call access.
- Account workspace: account record, opportunities, intelligence/enrichment, archive/delete/admin actions.
- Opportunities: global opportunity list, sortable layout, account name/date context, open/delete/archive actions.
- Opportunity workspace: record, call cockpit, post-call, methodology, intel, history.
- Calls: call library, account column, status/date/duration sorting, post-call navigation.
- Playbooks: grid library, unique icons, detail tabs, custom framework editing.
- Personal Account page: profile/selling context, Data import, recent imports/enrichment, archive restore tables, settings-adjacent account controls.
- Settings: OpenAI key readiness, workspace-level AI configuration, Deepgram readiness surfaced through Start Call.
- Live call cockpit: capture health, Deepgram transcript, one-question guidance, feedback buttons, popout coach, stop-call lifecycle.
- Post-call: download audio, download transcript, delete call, notes/evidence/next-call surfaces.
- Error/loading/empty states: public fallback, app error boundary, skeleton transitions, list empty states, inline function errors, workspace recovery.
- Mobile states: bottom Start Call drawer, safe areas, touch targets, mobile breadcrumb, quick-call overlay, scrollable panels.

## Appendix C. Completion Audit Against Objective

- Phase 0 repo understanding: Completed. Evidence: README, package scripts, Netlify config, env example, migrations, source/function/test maps inspected; architecture map added above.
- Phase 1 product surface map: Completed by code inspection and report mapping. Evidence: Appendix B.
- Phase 2 code QA audit: Partially completed with contract/security/performance/accessibility-focused inspection and tests. Evidence: issues QA-001 through QA-023 and passing contract/function tests. Not a formal line-by-line audit of every component.
- Phase 3 runtime/browser testing: Partially completed. Evidence: targeted in-app browser checks on authenticated desktop and mobile surfaces plus local public homepage/dialog preview. Limitation: clean unauthenticated login/signup/logout and live-call hardware flows were not completed because safe `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` were absent and the in-app browser was already authenticated.
- Phase 4 prioritise and fix: Completed for safe, high-impact local issues found in this pass. Evidence: QA-001 through QA-023 fixes and validation.
- Phase 5 design system/calm UX polish: Partially completed. Evidence: How It Works dialog whitespace fix, Start Call progress clarity, contract guards for calm UI. Limitation: full visual sweep of every authenticated modal and live-call state remains recommended.
- Phase 6 verification: Completed for local automated gate and targeted browser checks. Evidence: `pnpm check` passed, browser checks listed above.
- Phase 7 deliverables: Completed. Evidence: `QA_REPORT.md` includes the requested sections plus architecture/surface/completion appendices.
