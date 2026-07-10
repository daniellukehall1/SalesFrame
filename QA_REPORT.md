# SalesFrame Launch-Readiness QA Report

Date: 10 July 2026

Scope: frontend, authenticated workspace, public site, Supabase schema/RLS, Netlify Functions, Deepgram capture, AI workflows, accessibility, security, performance, and production smoke testing.

Release state reviewed: local `main` plus the production deployment that was live at the start of this audit.

## 1. Executive summary

SalesFrame has a strong product foundation and a notably calm, coherent seller experience. The public site, authentication, dashboard, account/contact/opportunity/call libraries, Playbooks, Settings, and the non-destructive portions of Start Call were exercised at desktop and mobile sizes in production. The inspected production pages had no horizontal overflow, mobile controls met the 44px target, the public navigation menu remained open after selection, and the browser console contained no warnings or errors during the smoke pass.

The audit also found launch-significant issues that static contracts had not caught. The most serious were server-trust boundaries around recording retention, enrichment-job ownership, session activity, and Deepgram token quotas. Safe local fixes now bind recording paths to their call, make queue and session mutation server-owned, verify enrichment-job provenance, make session polling read-only, authorize live-call heartbeats, and add a durable Deepgram quota. None of these changes has been applied to production.

The release is **not ready for a public launch yet**. Production still needs the new migration reviewed and applied through its compatibility rollout after the read-only preflight. Separately, the scheduled enrichment worker and synchronous post-call pipeline can exceed Netlify execution limits, post-call writes are not idempotent, direct call/audio deletion is not transactionally recoverable, workspace loading is unbounded, and two-hour recordings remain entirely memory-resident until stop. Those are reliability blockers for sustained launch traffic.

The supplied real login credential was used only in the SalesFrame login form, was not written to the repository, fixtures, screenshots, or this report, and the browser session was logged out after testing. Because the credential was disclosed in chat, it must be rotated before release.

## 2-9. Scores

Scores describe the patched local source, before deployment of the new migration and functions.

| Dimension | Score | Assessment |
|---|---:|---|
| Overall quality | 68/100 | Strong product and UI foundation; launch reliability and production hardening remain incomplete. |
| UX | 82/100 | Calm, consistent, mobile-friendly core flows; recovery gaps remain in post-call processing. |
| Engineering | 70/100 | Good typing and contracts; the root application and data bootstrap are too broad and several async workflows need durable job design. |
| Performance | 49/100 | Public bundle, unbounded workspace bootstrap, live transcript work, and recording memory retention are material risks. |
| Accessibility | 80/100 | Auth and most controls are strong; this pass fixed major keyboard, landmark, heading, progress, and error-association defects. Semantic table work remains. |
| Security | 64/100 | Important local hardening is now present, but it is unapplied and prompt minimisation plus production configuration verification remain. |
| Product maturity | 73/100 | Core seller workflow is credible and thoughtfully designed; failure recovery and durable background processing need to catch up. |
| Launch readiness | 52/100 | **No-go** until the release gates in this report are cleared. |

## 10. Issues found

### Critical

#### CRED-001 — Real credential disclosed in the QA request

- **Severity:** Critical
- **Area:** Credential hygiene
- **Description:** A real account password was supplied in the conversation to authorize the production smoke test.
- **Root cause:** Manual sharing of a reusable password rather than a temporary test account or one-time credential.
- **User/business impact:** Anyone with access to the conversation could potentially attempt account access until the password is rotated.
- **Fix applied or recommendation:** The credential was not copied into code, tests, reports, screenshots, or logs; the browser was logged out. Rotate the password immediately and revoke other active sessions. Use a dedicated least-privilege QA account for future audits.
- **Before/after impact:** The audit session is closed and no repository trace was created; account risk remains until rotation.
- **Files changed:** None.
- **Verification evidence:** Repository secret scan passed; a source search found no introduced credential value; production browser returned to the public homepage after logout.

### High — fixed locally, not deployed

#### SEC-001 — Retention cleanup trusted a user-mutable recording path

- **Severity:** High
- **Area:** Supabase, storage, scheduled function
- **Description:** A workspace member could change `calls.recording_storage_path`; the service-role cleanup job later deleted the stored path without verifying it belonged to that row.
- **Root cause:** Broad row update permission and no constraint/trigger connecting storage path segments to `workspace_id` and call `id`.
- **User/business impact:** A crafted row could make cleanup delete another call's audio as a confused deputy.
- **Fix applied or recommendation:** Added a scoped-path trigger and NOT VALID constraint, made identity/retention fields non-client-updatable, prevented replacement/clearing of an attached path by authenticated users, and narrowed call column grants. A six-hour, service-owned compatibility window lets already-open legacy clients finish an unregistered upload; after the deadline, a null-to-path transition must atomically lock and consume the caller's active registration. Cleanup locks the same ledger row before claiming it, so attachment and deletion cannot both win.
- **Before/after impact:** Before, any trusted path was deleted. After local deployment, only paths scoped to the selected workspace/call can be attached or removed.
- **Files changed:** `supabase/migrations/202607100002_launch_security_hardening.sql`, `supabase/preflight/202607100002_launch_security_hardening.sql`, `netlify/functions/retention-cleanup.ts`.
- **Verification evidence:** New security contracts cover cross-call path rejection, mismatch skipping, grants, and canonical cleanup; TypeScript passes.

#### SEC-002 — Enrichment jobs could be forged to spend another member's OpenAI key

- **Severity:** High
- **Area:** RLS, background enrichment, billing boundary
- **Description:** Broad client insert/update policies allowed job owner and worker-control fields to be supplied directly, while the worker used `created_by_user_id` to decrypt that user's key.
- **Root cause:** Queue rows were treated as trusted server jobs even when client mutation was allowed.
- **User/business impact:** A member could potentially attribute work to another member and consume that person's provider quota.
- **Fix applied or recommendation:** Removed authenticated queue/import-run mutation, added a server-issued authorization marker, validated import-run owner/workspace provenance before account authorization or key lookup, and fail-closed/skipped unmarked or mismatched jobs. Exhausted jobs now terminate, explicit retry starts a fresh bounded attempt cycle, and the preflight requires an operator decision for legacy unmarked jobs.
- **Before/after impact:** Before, ownership was row-controlled. After local deployment, only a server-created, provenance-matched job reaches provider-key use.
- **Files changed:** migration, preflight, `netlify/functions/_shared/import-enrichment.ts`, `src/lib/supabase/database.types.ts`.
- **Verification evidence:** New contracts assert policy/grant removal, server marker creation, provenance checks, and skip-before-key behavior.

#### SEC-003 — Idle-session polling renewed idle sessions and call heartbeats were forgeable

- **Severity:** High
- **Area:** Authentication/session enforcement
- **Description:** The one-minute status poll called a mutating get-or-create helper, and any truthy `activeCallId` could suppress idle expiry without authorizing a live call. Session timestamps were also directly client-writable.
- **Root cause:** Status and activity operations shared one mutating helper; server-owned timestamps were exposed through client write policies.
- **User/business impact:** Idle tabs could remain active indefinitely and a forged call ID could weaken the workspace timeout control.
- **Fix applied or recommendation:** Added a read-only status path, removed direct authenticated session mutation, whitelisted activity types, authorized and asserted-live the supplied call, verified workspace match, and stopped hidden-tab visibility events from counting as activity.
- **Before/after impact:** Polling now observes/expiring sessions without refreshing activity; only a real authorized active call can extend a session.
- **Files changed:** migration, `workspace-session.ts`, `session-status.ts`, `session-activity.ts`, `src/App.tsx`.
- **Verification evidence:** Contracts assert read-only status usage, grant removal, call authorization, and visible-only activity.

#### SEC-004 — Deepgram token rate limit was bypassable and isolate-local

- **Severity:** High
- **Area:** Deepgram, cost control, abuse prevention
- **Description:** Arbitrary `sourceKind` values changed the in-memory rate-limit key, and cold starts/multiple isolates reset the counter.
- **Root cause:** Unvalidated input participated in quota identity and no durable quota existed.
- **User/business impact:** Repeated temporary-token issuance could consume platform quota and degrade live-call availability.
- **Fix applied or recommendation:** Restricted source kinds to the four real capture modes, removed source kind from quota identity, retained the in-process limiter, and added a transactionally claimed Supabase user/call quota protected by an advisory lock and service-role-only function. The hourly retention job globally purges expired grant rows through an indexed timestamp.
- **Before/after impact:** Quota identity is stable and survives function isolate churn after the migration is applied.
- **Files changed:** migration, `netlify/functions/deepgram-token.ts`, database types.
- **Verification evidence:** Contracts verify the allowlist, stable key, service-only RPC, advisory lock, and denial path.

#### SEC-005 — Recording upload recovery could orphan, overwrite, or delete customer audio

- **Severity:** High
- **Area:** Recording privacy and retention
- **Description:** Audio upload completed before the call row stored its path. The deterministic key was uploaded with overwrite enabled, and blind compensating deletion after an ambiguous update failure could remove a valid recording.
- **Root cause:** Mutable object keys, a non-conditional pointer update, and no state-aware recovery decision around the upload-then-link sequence.
- **User/business impact:** Sensitive audio could be overwritten, orphaned outside scheduled retention, or deleted even though its database update had committed.
- **Fix applied or recommendation:** Generate an immutable random object key, disable overwrite, refuse calls that already have a pointer, and register every path in a private reconciliation ledger before Storage accepts bytes. Registrations are limited to three outstanding per call, twelve per user, and one hundred per workspace under consistently ordered advisory locks. Every unconsumed row counts until cleanup deletes it, so expiry or a stalled claim cannot reopen quota. Attachment first locks and confirms the exact private Storage object exists, then locks, validates, and consumes the registration inside the call-pointer transaction. A failed call update therefore restores the registration automatically, while a successful recording leaves no normal cleanup backlog. Cleanup uses a service-role-only `FOR UPDATE SKIP LOCKED` claim RPC, marks `cleanup_started_at`, retries stale claims after fifteen minutes, and drains up to four batches of fifty per hourly run (up to 4,800 claims/day) before reconciling ambiguous rows. Direct authenticated Storage update remains available solely during the bounded legacy window and automatically denies after enforcement. The preflight inventories older unreferenced objects and active calls for operator review.
- **Before/after impact:** Concurrent uploaders cannot overwrite one another, pending-registration abuse is bounded across call/user/workspace scopes, and cleanup cannot claim a row that won attachment. Every preserved ambiguous upload remains discoverable for bounded retry even after its call or workspace is deleted.
- **Files changed:** `src/lib/supabase/salesframe-data.ts`, `src/lib/supabase/recording-upload-integrity.ts`, `src/lib/supabase/database.types.ts`, `netlify/functions/retention-cleanup.ts`, the launch-hardening migration/preflight, and recording/security contracts.
- **Verification evidence:** Deterministic recovery-decision tests cover winner, concurrent loser, missing call, null pointer, and failed re-read states; source contracts require registration before upload, the controlled cutoff, private ledger grants, all three pending limits, row-lock coordination, service-only cleanup claims, stale-claim retry, the unique key, non-upsert upload, and conditional attach. SQL has not been executed against a live Supabase database in this pass.

### High — remaining launch blockers

#### REL-001 — Scheduled import enrichment cannot fit its 30-second execution budget

- **Severity:** High
- **Area:** Netlify scheduled functions
- **Description:** The hourly worker processes up to eight jobs serially; one OpenAI web-search call may take 45 seconds.
- **Root cause:** Long provider work is performed directly in a scheduled function instead of a durable background queue with one bounded lease.
- **User/business impact:** Jobs time out, remain locked until stale recovery, and may wait almost an hour for another attempt.
- **Fix applied or recommendation:** Not safe to rewrite in this pass. Move one job per lease to a true background function/queue, renew leases, schedule follow-up work, and add the global `(status, run_after, priority, created_at)` index.
- **Before/after impact:** Unchanged; still a launch blocker.
- **Files changed:** None for this issue.
- **Verification evidence:** `import-enrichment-worker.ts` and `_shared/import-enrichment.ts` static timing review; Netlify scheduled limit is 30 seconds.

#### REL-002 — Post-call processing can exceed 60 seconds and is not idempotent

- **Severity:** High
- **Area:** Post-call AI and data integrity
- **Description:** Two long OpenAI calls, up to 120 sequential speaker corrections, and non-idempotent output inserts run synchronously.
- **Root cause:** A multi-stage job was implemented as one request without durable job state, uniqueness, batching, or atomic finalisation.
- **User/business impact:** Timeouts can leave calls stuck in processing and retries can create duplicate outputs/briefs.
- **Fix applied or recommendation:** Error copy is now truthful, but an automatic retry was deliberately not added because writes are not idempotent. Move to a durable background job, batch speaker corrections, add per-call uniqueness, and upsert final artefacts atomically.
- **Before/after impact:** Messaging no longer falsely promises automatic recovery; the processing risk remains.
- **Files changed:** `src/App.tsx` copy only.
- **Verification evidence:** Static review of `post-call-outputs.ts` and related migrations.

#### PERF-001 — Workspace bootstrap is an unbounded 23+ request fan-out

- **Severity:** High
- **Area:** Data loading and scalability
- **Description:** Workspace load fetches full calls, transcripts, notes, speakers, outputs, briefs, evidence, and a signed URL per recording before rendering paginated screens.
- **Root cause:** Whole-workspace hydration rather than summary-first, page-scoped queries.
- **User/business impact:** Load time and database/storage traffic grow with customer history; large workspaces can become slow or fail.
- **Fix applied or recommendation:** Return lightweight summaries, server-paginate accounts/opportunities/calls, lazy-load call detail and signed URLs, select explicit columns, and replace full refreshes with mutation-scoped invalidation.
- **Before/after impact:** Unchanged; launch blocker for larger workspaces.
- **Files changed:** None.
- **Verification evidence:** `src/App.tsx` workspace loading and `salesframe-data.ts` query review.

#### PERF-002 — Two-hour recordings remain entirely in browser memory until stop

- **Severity:** High
- **Area:** Audio reliability
- **Description:** One-second recording chunks accumulate for the full call and upload once at stop. A page crash loses all audio.
- **Root cause:** No incremental/resumable upload or durable local recovery state.
- **User/business impact:** Long calls can create memory pressure, a large non-resumable upload, and total recording loss on crash/close.
- **Fix applied or recommendation:** This pass clears chunks after stop so post-call screens no longer retain the completed blob. The launch-grade fix is incremental/resumable upload with explicit recoverable state.
- **Before/after impact:** Post-stop leak fixed; in-call accumulation and crash loss remain.
- **Files changed:** `src/hooks/use-call-capture.ts`.
- **Verification evidence:** Capture contract verifies chunk clearing; static lifecycle review confirms in-call accumulation remains.

#### PERF-003 — Public routes front-load authenticated call-capture code

- **Severity:** High
- **Area:** Bundle architecture and SEO acquisition performance
- **Description:** The public entry statically imports shared application chunks, including call capture. Existing artifact review measured about 262KB gzip JavaScript on public pages and 371KB on authenticated entry.
- **Root cause:** Manual chunking and source import edges defeat the intended public/auth route split.
- **User/business impact:** Slower first load and weaker Core Web Vitals on acquisition pages.
- **Fix applied or recommendation:** Lazy-load authenticated feature boundaries, stop forcing app source into shared manual chunks, and add manifest-based public/auth gzip budgets in CI.
- **Before/after impact:** Unchanged.
- **Files changed:** None.
- **Verification evidence:** `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, and generated asset graph review.

#### PERF-004 — Live transcript work scales poorly over long calls

- **Severity:** High
- **Area:** Real-time UI performance
- **Description:** Partial updates repeatedly scan/sort the full transcript, build a full signature, render all rows, and update the root application timer each second.
- **Root cause:** Array-wide derived work and root-level state instead of incremental keyed state and windowed rendering.
- **User/business impact:** Long calls can stutter precisely when the seller most needs reliable guidance.
- **Fix applied or recommendation:** Keep transcript lines by ID, maintain a last-28 AI buffer incrementally, throttle partial display updates, virtualise history, and isolate timer/live-call state from the app root.
- **Before/after impact:** Superseded live-state network requests are now aborted; transcript computation/render cost remains.
- **Files changed:** `src/App.tsx` for request cancellation only.
- **Verification evidence:** Static review of Deepgram callback, transcript reducers, `LiveRail`, and root timer.

#### UX-001 — Failed post-call generation has no safe retry path

- **Severity:** High
- **Area:** Recovery UX
- **Description:** A failed post-call request sets an error but provides no retry or real polling.
- **Root cause:** The backend job is synchronous/non-idempotent, so the UI cannot safely repeat it.
- **User/business impact:** Sellers can keep their transcript/recording but may never receive notes or next-call plan.
- **Fix applied or recommendation:** Copy now states that the attempt failed. Add retry only after REL-002 makes generation durable and idempotent.
- **Before/after impact:** Trustworthy state communication improved; functional recovery remains blocked.
- **Files changed:** `src/App.tsx`.
- **Verification evidence:** Source review of the stop/generation request and `PostCallPanel`.

#### DATA-001 — Existing contact/call relationship constraint is still NOT VALID in production

- **Severity:** High
- **Area:** Data integrity and rollout
- **Description:** The contact migration intentionally added the call account/opportunity relationship constraint without validating historical rows.
- **Root cause:** Safe additive rollout deferred validation until a read-only preflight could be reviewed.
- **User/business impact:** Historical mismatches can remain even though new writes are protected.
- **Fix applied or recommendation:** Run `supabase/preflight/202607100001_contact_management.sql` read-only, manually review any results, then validate separately under explicit production authorization.
- **Before/after impact:** New writes are safer; historical integrity remains unverified.
- **Files changed:** None in this pass.
- **Verification evidence:** Migration/preflight review; production preflight was not run under this task's constraints.

#### SEC-006 — AI prompts select and pass broader rows than necessary

- **Severity:** High
- **Area:** Privacy and data minimisation
- **Description:** Several AI functions select full account/opportunity/call/research rows and can include internal IDs, ownership, retention, archive, and storage metadata.
- **Root cause:** Prompt DTOs are built from broad database rows rather than explicit projections.
- **User/business impact:** Unnecessary customer metadata reaches the model provider and expands prompt-injection/cost surface.
- **Fix applied or recommendation:** Replace `select("*")` with explicit projections, construct compact prompt DTOs, cap user-entered field/array lengths, and test forbidden fields.
- **Before/after impact:** Unchanged; no raw transcript HTML/log sink was found, but minimisation remains required.
- **Files changed:** None.
- **Verification evidence:** Static review of `customer-research.ts`, `live-guidance.ts`, and `post-call-outputs.ts`.

#### TEST-001 — Launch hardening lacks database/runtime integration coverage

- **Severity:** High
- **Area:** Release verification
- **Description:** The new hardening contracts inspect source structure, but they do not execute the Supabase migration or prove database privileges, concurrent quota claims, expired-session behavior, ambiguous recording failures, or real browser focus transitions.
- **Root cause:** The repository has Node source-contract tests but no disposable Supabase integration harness or browser interaction test runner.
- **User/business impact:** SQL/runtime defects or race conditions could pass CI despite apparently complete contracts.
- **Fix applied or recommendation:** Keep the source contracts as fast regression guards, add deterministic helper tests where possible, and require migration/RLS/RPC integration tests in a non-production Supabase project plus authenticated browser journeys before release.
- **Before/after impact:** Static coverage is stronger, but launch confidence remains bounded until the runtime suite exists.
- **Files changed:** New and updated contract tests listed in section 12.
- **Verification evidence:** Test implementation and dependency review; the production browser pass covered UI behavior but deliberately did not exercise destructive/database mutation paths.

#### DATA-002 — Call and recording deletion is not transactionally recoverable

- **Severity:** High
- **Area:** Recording deletion and privacy
- **Description:** The browser removes a Storage object and then deletes the call row, while authenticated policies also permit either resource to be deleted directly. A partial failure can therefore leave a call pointing at missing audio or delete the row while leaving an undiscoverable object.
- **Root cause:** Cross-system deletion has no durable server-owned tombstone/state machine, and browser clients retain independent delete authority.
- **User/business impact:** Customer audio can be lost unexpectedly or survive normal deletion/retention controls.
- **Fix applied or recommendation:** This needs a deliberate server-owned deletion workflow: atomically create a durable deletion tombstone before removing the call, revoke direct call/recording deletion after a compatibility rollout, and let bounded service-role cleanup remove the object idempotently before closing the tombstone. Do not silently switch to delayed deletion without confirming the product/privacy copy and SLA.
- **Before/after impact:** Unchanged; this remains a launch blocker. The new upload reconciliation ledger protects upload-time ambiguity but is not a permanent deletion ledger after its 48-hour window.
- **Files changed:** None for this issue.
- **Verification evidence:** Static review of `deleteCall`, call RLS, recording Storage DELETE policy, and reconciliation expiry.

### Medium

#### A11Y-001 — Workspace search, navigation, landmarks, headings, and progress semantics

- **Severity:** Medium (several items were high for keyboard-only users)
- **Area:** Accessibility
- **Description:** Desktop search removed results after input blur; sub-navigation/breadcrumbs used href-less anchors; the app nested two `main` landmarks; account/settings lacked usable H1s; progress dropped its semantic value.
- **Root cause:** Pointer-oriented focus handling and generic layout primitives.
- **User/business impact:** Keyboard and screen-reader users lost search results, destinations, page context, and progress values.
- **Fix applied or recommendation:** Added combobox/listbox semantics and Arrow/Escape handling, retained results across internal focus, changed action links to buttons, reduced to one main landmark, focused/labeled it after navigation, added H1s, and passed `value` to Radix Progress.
- **Before/after impact:** Core workspace navigation is now keyboard-operable and page changes provide clearer context.
- **Files changed:** `src/App.tsx`, `ui/sidebar.tsx`, `ui/breadcrumb.tsx`, `ui/progress.tsx`.
- **Verification evidence:** New accessibility contracts; production runtime originally confirmed the two-main and missing-H1 defects.

#### UX-002 — Archived contacts were recoverable only through immediate Undo

- **Severity:** Medium
- **Area:** Contact management
- **Description:** Archived contacts disappeared permanently from the UI when component-local Undo state was lost.
- **Root cause:** Every list filter excluded archived rows even though a restore API existed.
- **User/business impact:** Sellers could not recover a contact after leaving the tab.
- **Fix applied or recommendation:** Added an Archived contacts filter, searchable archived cards/rows, and persistent Restore actions; historical opportunity links remain available.
- **Before/after impact:** Archive is now a genuinely reversible action.
- **Files changed:** `src/components/contact-management.tsx`.
- **Verification evidence:** New contact contracts cover filter, restore action, and empty-state copy.

#### REL-003 — Microphone preview could stay on “Connecting” indefinitely

- **Severity:** Medium
- **Area:** Start Call audio check
- **Description:** `getUserMedia` had no deadline when the permission prompt remained unresolved.
- **Root cause:** Raw awaited browser permission promise.
- **User/business impact:** Start Call appeared frozen and gave no recovery instruction.
- **Fix applied or recommendation:** Added a 10-second permission deadline, explicit recovery copy, timer cleanup, and late-stream shutdown.
- **Before/after impact:** The meter exits indefinite pending state and tells the seller how to retry.
- **Files changed:** `src/App.tsx`.
- **Verification evidence:** Production smoke reproduced the pending state; new contract verifies the deadline and late cleanup path.

#### REL-004 — Deepgram reconnect could reopen after the seller stopped

- **Severity:** Medium
- **Area:** Real-time transcription lifecycle
- **Description:** An uncancellable reconnect promise could resolve after `close()` and resume a new socket.
- **Root cause:** Reconnect completion did not re-check `closedByClient`.
- **User/business impact:** Audio could continue to buffer/send after call teardown and resources could leak.
- **Fix applied or recommendation:** Re-check close state, close late sockets immediately, suppress late errors, and clear backlog on close.
- **Before/after impact:** Teardown now wins races with reconnect completion.
- **Files changed:** `src/lib/deepgram-live-transcription.ts`.
- **Verification evidence:** Reliability contract asserts the late-close branch and backlog cleanup.

#### REL-005 — Fast live-state requests overlapped

- **Severity:** Medium
- **Area:** AI request concurrency
- **Description:** Request IDs ignored stale responses but did not stop expensive superseded work.
- **Root cause:** No abort/single-flight handling on the fast state lane.
- **User/business impact:** Rapid final turns could waste AI/database capacity and increase latency.
- **Fix applied or recommendation:** Abort the prior fast-state request when a newer input starts and on effect cleanup. A server-side coalescing/single-flight guard is still recommended.
- **Before/after impact:** Superseded browser work now stops instead of only being ignored.
- **Files changed:** `src/App.tsx`.
- **Verification evidence:** Contract verifies abort controller and signal wiring.

#### REL-006 — Live guidance failure displayed pre-call instructions during an active call

- **Severity:** Medium
- **Area:** Live coaching recovery UX
- **Description:** When live guidance failed without a retained question, the empty state fell through to “Ready for your next call” and “Start a call” even while recording was active.
- **Root cause:** The question card did not receive active-call state and treated every empty guidance response as pre-call.
- **User/business impact:** A seller could be distracted by contradictory instructions at the point where calm recovery guidance matters most.
- **Fix applied or recommendation:** Pass active-call state into the card and show a truthful listening/recovery state that keeps the seller focused on the buyer while SalesFrame checks again.
- **Before/after impact:** Active calls no longer display pre-call copy when guidance is temporarily unavailable.
- **Files changed:** `src/App.tsx`.
- **Verification evidence:** A focused regression contract covers active-call empty and error states.

#### A11Y-002 — Contact editor validation/focus and mobile sidebar dismissal

- **Severity:** Medium
- **Area:** Accessibility and touch
- **Description:** Contact URL/error state was not fully associated, discard confirmation did not receive focus, desktop contact profile links were not actionable, table actions shrank below touch target size, and the mobile sidebar hid its close button.
- **Root cause:** Visual-only validation/recovery and desktop-biased control sizing.
- **User/business impact:** Assistive-technology and tablet users had incomplete feedback or difficult dismissal/actions.
- **Fix applied or recommendation:** Added `aria-invalid`/`aria-describedby`, focused the discard heading, made profile URLs actionable, kept 44px action targets, removed repeated live badge announcements, and exposed the Sheet close control.
- **Before/after impact:** Clearer error ownership, safer focus, and reachable controls.
- **Files changed:** contact management, `ui/sidebar.tsx`.
- **Verification evidence:** Contracts plus production mobile target measurements.

#### A11Y-003 — Call limit warning was visual-only

- **Severity:** Medium
- **Area:** Live-call accessibility
- **Description:** Ten-minute/final-minute warnings did not announce that the call would stop automatically.
- **Root cause:** Plain status text without live-region semantics or explicit consequence.
- **User/business impact:** Screen-reader users could miss an imminent forced stop.
- **Fix applied or recommendation:** Added stable polite/assertive status messages with explicit automatic-stop wording in main and popout surfaces.
- **Before/after impact:** The warning is perceivable without creating per-second announcement spam.
- **Files changed:** `src/App.tsx`, `live-coach-popout-window.tsx`.
- **Verification evidence:** Updated two-hour call contract.

#### PERF-005 — Call history query lacks a matching composite index

- **Severity:** Medium
- **Area:** Supabase query performance
- **Description:** Full history filters `workspace_id` and orders `started_at desc`; only separate indexes and an active-call partial index exist.
- **Root cause:** Indexes do not match the history access pattern.
- **User/business impact:** Larger call histories require avoidable sort/scan work.
- **Fix applied or recommendation:** Add `(workspace_id, started_at desc)` together with server pagination, after query-plan review.
- **Before/after impact:** Unchanged.
- **Files changed:** None.
- **Verification evidence:** Query and migration index review.

#### A11Y-004 — Opportunities/Calls desktop layout is only visually table-like

- **Severity:** Medium
- **Area:** Semantic structure
- **Description:** Header/row/cell roles are incomplete and `aria-sort` sits on buttons rather than column headers.
- **Root cause:** Custom responsive grid approximates a table without a complete table/grid pattern.
- **User/business impact:** Screen-reader users receive weak column and sort context.
- **Fix applied or recommendation:** Use a semantic Table on desktop and purposeful cards on mobile, or implement a complete ARIA grid.
- **Before/after impact:** Unchanged.
- **Files changed:** None.
- **Verification evidence:** Source review of `OpportunitiesView` and `CallsView`.

### Low

#### PERF-006 — Stable media filenames receive one-year immutable caching

- **Severity:** Low
- **Area:** CDN caching
- **Description:** `/media/*` uses immutable caching although hero/how-it-works filenames are not fingerprinted.
- **Root cause:** Asset-style caching applied to stable public names.
- **User/business impact:** Replacing media at the same path can leave old content cached for a year.
- **Fix applied or recommendation:** Fingerprint the media filenames or use revalidation/shorter caching for `/media/*`.
- **Before/after impact:** Unchanged.
- **Files changed:** None.
- **Verification evidence:** `netlify.toml` and `public/media` review.

#### UX-003 — Workspace menu advertises unimplemented command shortcuts

- **Severity:** Low
- **Area:** Navigation polish
- **Description:** Workspace items display command-number shortcuts while only the sidebar shortcut is implemented.
- **Root cause:** Decorative shortcut labels were added without handlers.
- **User/business impact:** Small trust/polish issue for keyboard users.
- **Fix applied or recommendation:** Remove labels or implement/document the shortcuts.
- **Before/after impact:** Unchanged.
- **Files changed:** None.
- **Verification evidence:** `workspace-switcher.tsx` and sidebar shortcut review.

## 11. Fixes applied

- Added a staged Supabase launch-security migration and read-only preflight, with an explicit six-hour recording-upload compatibility window.
- Bound recording paths to their call/workspace and hardened scheduled cleanup.
- Made AI enrichment jobs, import-run provenance, and session activity server-owned.
- Added enrichment provenance markers, retry bounds, and fail-closed worker checks.
- Made session status polling read-only and authorized real live-call heartbeats.
- Added a durable Deepgram token quota and strict source-kind validation.
- Added immutable recording object keys, pre-upload reconciliation registration, conditional pointer attachment, multi-scope abuse limits, and atomically claimed data-safe orphan cleanup.
- Stopped late Deepgram reconnects and aborted superseded live-state requests.
- Released completed recording chunks after stop.
- Added a microphone permission timeout and recovery message.
- Kept live-call guidance in a calm listening/recovery state when no question is temporarily available.
- Added persistent archived-contact search/restore.
- Rebuilt desktop workspace search keyboard behavior and ARIA relationships.
- Corrected main landmarks, page focus, account/settings H1s, breadcrumb/subnav semantics, Progress value, validation associations, close controls, touch targets, and call-limit announcements.
- Aligned local Supabase password minimum with the UI and enabled secure password change.
- Expanded the secret gate to scan untracked repository files as well as tracked files.
- Added focused security/accessibility/reliability regression contracts and updated stale contracts.

## 12. Files changed

### Application and UI

- `src/App.tsx`
- `src/components/contact-management.tsx`
- `src/components/live-coach-popout-window.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/sidebar.tsx`
- `src/hooks/use-call-capture.ts`
- `src/lib/deepgram-live-transcription.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/supabase/recording-upload-integrity.ts` (new)
- `src/lib/supabase/salesframe-data.ts`

### Netlify Functions

- `netlify/functions/_shared/import-enrichment.ts`
- `netlify/functions/_shared/workspace-session.ts`
- `netlify/functions/deepgram-token.ts`
- `netlify/functions/retention-cleanup.ts`
- `netlify/functions/session-activity.ts`
- `netlify/functions/session-status.ts`

### Supabase

- `supabase/config.toml`
- `supabase/migrations/202607100002_launch_security_hardening.sql` (new)
- `supabase/preflight/202607100002_launch_security_hardening.sql` (new)

### Tests and report

- `scripts/check-secrets.mjs`
- `tests/e2e/app-production-contract.test.mjs`
- `tests/e2e/contact-ui-contract.test.mjs`
- `tests/e2e/launch-a11y-reliability-contract.test.mjs` (new)
- `tests/functions/security-contract.test.mjs`
- `tests/functions/launch-security-hardening-contract.test.mjs` (new)
- `tests/functions/recording-upload-integrity.test.mjs` (new)
- `QA_REPORT.md` (updated)

## 13. Validation commands and results

### Baseline before edits

- Repository status: clean `main` tracking `origin/main`.
- Existing production gate: passed before the audit changes, including secret scan, TypeScript, 139 tests, production build, and 29 prerendered public pages.

### Runtime/browser

- Production smoke-tested at 1440×900 and 390×844 using the user-authorized account.
- Exercised login, dashboard, account record, Contacts empty/add form without saving, Start Call steps without starting, Opportunities, Calls, Playbooks, workspace search, Settings, mobile sidebar, and public navigation.
- No account, contact, opportunity, call, API-key, or capture preference was created, edited, archived, deleted, or started. Normal authentication/session activity was created by signing in. The session was logged out afterward.
- Browser console warnings/errors: none during the inspected flow.
- Mobile public interactive controls: no inspected control below 44px; fixed navigation did not overlap Get in touch.
- Mobile account tab list: horizontally scrollable with no viewport overflow.

### Source/tests

- `node scripts/check-secrets.mjs`: pass across tracked and untracked repository files.
- `./node_modules/.bin/tsc -b --pretty false`: pass using the bundled Node runtime on `PATH`.
- New launch hardening, recording-recovery, and accessibility contracts: 14/14 pass.
- Focused app/contact/accessibility suites: 105/105 pass.
- Focused security/recording suites: 21/21 pass.
- Initial full suite after the fixes: 142/147; five failures were stale source-contract expectations for deliberately changed copy/semantics, not runtime defects. Contracts were updated and targeted rerun passed.
- Final full suite: 153/153 pass.
- Production client build: pass. The expected chunk-size warning remains for `App` (508.86KB minified, 123.38KB gzip).
- Public SSR build: pass (101.91KB output, 24.61KB gzip).
- Public prerender: 29 pages generated.
- `git diff --check`: pass.

### Commands that could not run as written

- `pnpm exec tsc --noEmit` first failed because `pnpm` was not on the shell path.
- The bundled fallback `pnpm` then refused an automatic `node_modules` purge without a TTY. No dependency tree was modified. The repository's installed TypeScript/Vite binaries were used directly instead.
- Neither the Supabase CLI nor `psql` is installed on this shell path. The migration was source-reviewed and contract-tested, but it was not executed; disposable-project SQL/RLS/RPC concurrency testing remains a release gate.

## 14. Remaining risks and release gates

1. Rotate the disclosed password and revoke other sessions.
2. Review and run both read-only Supabase preflights. Manually decide how to handle any legacy unreferenced recording objects or unmarked enrichment jobs; do not auto-correct returned production rows.
3. Apply `202607100002_launch_security_hardening.sql` before deploying the dependent Functions/frontend, then complete that deploy before the service-owned `enforce_after` deadline.
4. Validate the contact relationship constraint after manually resolving any preflight findings.
5. Move import enrichment and post-call processing to bounded durable background jobs.
6. Add idempotency/uniqueness and atomic finalisation for post-call artefacts.
7. Paginate and lazy-load workspace/call history.
8. Replace memory-only call recording with incremental/resumable persistence.
9. Minimise AI database projections and add forbidden-field prompt contracts.
10. Verify production Auth password/leaked-password/secure-change settings; local config does not prove dashboard state.
11. Run real assistive-technology checks (VoiceOver/Safari and keyboard-only) after deployment.
12. Execute migration/RLS/RPC race and privilege tests against a disposable Supabase project; source-contract assertions alone are not a release gate.
13. Replace direct call/recording deletion with a durable server-owned tombstone workflow and verify the deletion SLA/copy.

## 15. Highest-impact future improvements

1. **Durable job architecture:** one shared job state model for enrichment and post-call AI, with leases, idempotency keys, attempts, heartbeat, cancellation, and visible retry.
2. **Summary-first workspace data:** server pagination, explicit projections, mutation-scoped invalidation, and call-detail lazy loading.
3. **Resumable recording pipeline:** incremental encrypted upload, crash recovery, explicit failed-upload retry, and orphan inventory tooling.
4. **Long-call performance architecture:** keyed transcript store, last-N AI buffer, virtualised transcript history, isolated timer/live state.
5. **Route-level performance budgets:** emitted-manifest assertions for public and authenticated entry gzip size.
6. **End-to-end launch suite:** authenticated Playwright journeys using a dedicated QA tenant, real focus order, permission denial, offline/reconnect, and screen-reader smoke checks.

## 16. Recommended next QA pass

### Recording migration rollout and rollback runbook

The migration creates exactly one `recording_upload_rollout_control` row with `enforce_after = now() + 6 hours`. During that window, legacy unregistered Storage insert/upsert and call-pointer attachment remain available for already-open clients. The new registered client works both before and after the deadline. Once the deadline passes, Storage insert requires an active registration, Storage UPDATE is denied, and authenticated null-to-path attachment must lock and mark that registration.

1. Run `supabase/preflight/202607100002_launch_security_hardening.sql` read-only and review active calls, unreferenced recording objects, existing Storage policies, path mismatches, grants, and queue provenance.
2. Apply the migration. Immediately verify the singleton deadline using the commented post-migration query in the preflight; record the result in a restricted operator log without object paths or credentials.
3. Deploy the dependent Functions/frontend and smoke-test a registered upload well before the deadline.
4. If deployment cannot finish in time, a privileged operator may extend the window **before it expires** with: `update public.recording_upload_rollout_control set enforce_after = now() + interval '6 hours', updated_at = now() where singleton_id = 1;`. Re-run the verification query. Do not expose this table to authenticated clients and do not reopen an already-enforced window as a routine rollback.
5. To finish early after verifying that old call clients have drained, a privileged operator may set `enforce_after = now(), updated_at = now()` for the singleton. Then confirm unregistered insert/upsert and null-to-path attachment are denied while a registered immutable upload succeeds.
6. For an application rollback during the still-open window, extend the deadline first, roll back the dependent bundle/functions, and investigate. Do not drop the ledger or cleanup claims: preserved uploads may still require reconciliation. After enforcement, prefer a reviewed forward fix; reopening legacy mutable upsert requires explicit security-incident approval.
7. Database rollback is not an automatic down migration. Restore policies/grants only through a separately reviewed forward migration after confirming no pending or cleanup-claimed ledger rows would be stranded.

After the migration and dependent deploy are separately authorized:

1. Run both preflights read-only and retain outputs in a secure operator record.
2. Apply the staged migration first; verify the rollout deadline, grants, triggers, constraints, quota/cleanup RPCs, and RLS with active and expired sessions.
3. Deploy Functions/frontend.
4. Re-run production desktop/mobile smoke tests with a dedicated QA user.
5. Exercise canonical recording registration/upload/reconciliation in a non-production project, including concurrent uploaders, ambiguous pointer updates, call deletion, and expired-ledger cleanup.
6. Verify forged enrichment rows are skipped before key access and legitimate imports complete.
7. Verify idle timeout with no activity, visible activity, hidden tab, workspace switch, and a real active call.
8. Load-test long transcript rendering, Deepgram token quota, workspace bootstrap, and post-call/enrichment execution budgets.
9. Complete VoiceOver and keyboard-only checks.
10. Only then make a launch decision.
