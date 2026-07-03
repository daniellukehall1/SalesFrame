# SalesFrame Launch Audit Log

This log tracks launch-readiness issues found during the calm UX audit. Each entry records the practical impact, root cause, fix, and verification evidence.

## 2026-07-03

### AI readiness errors lacked traceable diagnostics

- Severity: High
- Description: Start Call could show a generic first-question error without enough diagnostic context to tell whether the issue was OpenAI, schema validation, Supabase persistence, or browser-side state.
- Root cause: Function errors returned sanitized messages, but they did not include trace IDs or structured diagnostic logs, and client-side Start Call failures were not reported to a central function log.
- Recommended improvement: Add trace IDs to API error envelopes, log safe structured function errors in Netlify, and report important client-side failures without exposing secrets or transcript content.
- Fix applied: Added shared function error logging with redaction, trace IDs, `X-SalesFrame-Trace-Id` headers, live-guidance slow-call warnings, a rate-limited `/api/client-error` endpoint, and client-side reporting for Start Call failures, render crashes, browser errors, and unhandled promise rejections.
- Before impact: A seller could screenshot an error and we would still need to guess which backend or client step failed.
- After impact: Future failures include a reference ID that can be searched in Netlify logs, while logs contain safe metadata such as function name, status, code, call/opportunity IDs, and phase.
- Verification: Added production-contract coverage for trace IDs, redaction, live-guidance diagnostics, client error reporting, and Start Call failure reporting.

### Start Call could reveal the dashboard after successful setup

- Severity: High
- Description: After completing the Start Call modal, the modal could close back onto the seller dashboard instead of revealing the live call cockpit.
- Root cause: The active account, opportunity, call refs, and cockpit route were only finalized at the end of the capture startup path, after browser audio setup had already begun.
- Recommended improvement: Select the active call context and route the app to the live cockpit before waiting on capture startup, so the cockpit is the guaranteed background view when the modal closes.
- Fix applied: Set active account/opportunity/call refs immediately after the call record and first AI guidance are ready, then move the app to the `workspace` active-call view before `callCapture.startCall`.
- Before impact: A seller could finish the core setup flow, see the modal close, and land back on the dashboard even though they expected the live cockpit.
- After impact: Successful call setup reveals the call cockpit consistently, with the correct active call context already available to stop recording, show guidance, and capture transcript.
- Verification: Updated production-contract assertions so the active refs and cockpit route are set before capture startup begins.

### Start Call modal overflowed on mobile

- Severity: Medium
- Description: The Start Call modal could let setup content flow horizontally off small mobile viewports.
- Root cause: The modal used a four-column stepper at every size, several select triggers inherited the shared `w-fit` default, and the scroll body/cards did not consistently opt into `min-w-0`.
- Recommended improvement: Make the modal mobile-first with a two-column stepper, full-width form controls, and explicit overflow containment.
- Fix applied: Added mobile padding and min-width guards to the dialog, changed the stepper to two columns below `sm`, made Start Call selects full-width, and tightened the scroll body/card containment.
- Before impact: Phone users could see controls or modal content slip outside the frame, making the core call-start workflow feel broken.
- After impact: The Start Call setup flow stays contained, scrollable, and reachable on small screens without changing the desktop layout.
- Verification: Added production-contract assertions for the mobile stepper, full-width Start Call selects, and overflow-safe modal body.

### Stop-call errors sounded like system maintenance

- Severity: Low
- Description: Stop-call recovery messages used wording such as transcript finalisation, recording cleanup, and final save needing attention.
- Root cause: Error copy was written from the implementation path rather than the seller's outcome after ending a call.
- Recommended improvement: Explain what the user can trust and what SalesFrame is still preparing, without exposing internal processing terms.
- Fix applied: Reworded stop-call transcript, audio recording, and post-call save messages into plain product language.
- Before impact: A seller could stop a call and feel like the system had entered a fragile technical state.
- After impact: The app now says the call ended and clearly names the post-call items that may still be catching up.
- Verification: Added production-contract assertions rejecting the old finalisation/cleanup wording and requiring the calmer stop-call copy.

### Live capture rail exposed delete during active recording

- Severity: Low
- Description: The call cockpit's capture rail showed a destructive `Delete call` action while a call was actively requesting permission, connecting, recording, paused, or stopping.
- Root cause: The rail keyed the delete action only off `activeCallId`, so the action appeared in the live moment instead of staying in review/history surfaces.
- Recommended improvement: Keep the active-call rail focused on stop/status/audio health, and reserve destructive deletion for non-live contexts where the seller has more attention.
- Fix applied: Added a `canDeleteFromRail` guard so the call deletion action is hidden while capture is active.
- Before impact: A seller could see a destructive action beside the live recording control during the highest-pressure part of the workflow.
- After impact: The live rail stays calmer and safer while deletion remains available from call history, replay, and inactive call contexts.
- Verification: Added a production-contract assertion that the live rail gates the delete action behind `!isCaptureActive`.

### System health messages polluted live notes and workspace errors

- Severity: Medium
- Description: Live-call notes and the global workspace error channel could receive technical status text such as background research failures, account enrichment failures, speaker attribution warnings, and capture issues.
- Root cause: Background workflows reused user-facing notes and workspace-level error state for local or non-blocking failures.
- Recommended improvement: Keep seller notes focused on conversation substance and reserve workspace-level errors for true workspace data/access failures.
- Fix applied: Removed the capture hook's `onNote` system-message path, stopped startup/research/enrichment/capture/speaker/coach failures from being inserted into notes, and moved inline action failures back to their local status surfaces.
- Before impact: The Notes tab could feel like an error log during the highest-pressure workflow, and stale background failures could make the workspace feel more broken than it was.
- After impact: Live notes stay calm and conversation-focused; technical issues remain visible through local capture, post-call, enrichment, or inline form status where relevant.
- Verification: Added production-contract assertions that system health messages are not injected into notes, the capture hook no longer exposes `onNote`, and record mutation handlers do not push inline failures into the workspace error channel.

### Status messages exposed implementation language

- Severity: Low
- Description: A few production-facing status messages still referenced internals such as AI methodology scoring, AI-processed calls, incomplete AI suggestions, and retrying on a call refresh.
- Root cause: Several status strings were written around system behavior rather than what the seller needed to know in the moment.
- Recommended improvement: Keep success and recovery messages short, calm, and workflow-oriented.
- Fix applied: Reworded opportunity save, speaker naming fallback, live coach error, and post-call notes empty copy into seller-facing language.
- Before impact: Small moments of the app could feel like a debug surface rather than a premium SaaS product.
- After impact: Status copy now says what happened and what the seller can expect, without exposing backend mechanics.
- Verification: Added production-contract assertions rejecting the old implementation-style phrases and requiring the calmer notes empty state.

### Start Call final step used a generic research label

- Severity: Low
- Description: The Start Call modal's final stepper item said `Research` while the panel itself said `Seller Research`.
- Root cause: The shared `recordingSteps` label was not updated when the modal copy was clarified from generic customer research to seller research.
- Recommended improvement: Keep the stepper, step heading, and panel title aligned so the setup flow feels intentional and calm.
- Fix applied: Renamed the Start Call stepper item to `Seller Research` and added a production-contract assertion to prevent regression.
- Before impact: Users saw two nearby names for the same step, creating a small but avoidable moment of hesitation.
- After impact: The final step now consistently reads `Seller Research` in the stepper, heading, and panel.
- Verification: Browser walkthrough on the local app showed `Step 4 of 4: Seller Research`; `pnpm check` passed with 94 tests, TypeScript, secret scan, and production build.

### Favicon used a full square instead of the rounded SalesFrame mark

- Severity: Low
- Description: The favicon rendered as a full black square, which could read as a black mark sitting on a white backing in browser chrome.
- Root cause: The SVG filled the entire 64px canvas instead of using a transparent canvas around the rounded SalesFrame waveform icon.
- Recommended improvement: Use the same rounded black waveform mark as the product identity, with transparent space outside the icon shape.
- Fix applied: Updated `public/favicon.svg` to use a rounded black rectangle on a transparent SVG canvas and kept the white waveform lines.
- Before impact: The favicon looked less polished than the in-app and homepage mark.
- After impact: The favicon now matches the rounded SalesFrame icon language and avoids a visible white backing.
- Verification: Added a production-contract assertion requiring the rounded favicon rect and no white fill; `pnpm check` passed with 94 tests, TypeScript, secret scan, and production build.

### Playbook detail copy sounded like an internal checklist

- Severity: Low
- Description: The playbook detail page described required fields as "Evidence the seller needs to capture before the deal can progress."
- Root cause: The copy described the internal methodology checklist instead of how SalesFrame helps during a call.
- Recommended improvement: Keep playbook pages focused on what SalesFrame will listen for and coach against, without making the user feel like they are managing a manual checklist.
- Fix applied: Reworded the required-fields description to "What SalesFrame will listen for as the deal moves forward" and added a production-contract assertion.
- Before impact: The page felt a little more like an implementation note than a premium sales-coaching product.
- After impact: The page keeps the same strict methodology meaning while sounding calmer and more product-native.
- Verification: Added a production-contract assertion requiring the calmer copy and rejecting the previous internal wording.

### Workspace loading state offered recovery actions too early

- Severity: Medium
- Description: The workspace loading state could show `Try again` and `Open settings` actions while the workspace was still loading.
- Root cause: `WorkspaceStateView` reused the same action row for loading, empty, error, and permission states.
- Recommended improvement: Loading should be reassuring and passive; recovery actions should appear only when something actually needs recovery.
- Fix applied: Replaced loading-state actions with a calm status line and kept action buttons for empty, error, and permission-denied states.
- Before impact: A user could wonder whether loading had already failed and click away from a healthy transition.
- After impact: Workspace loading now reads as intentional progress instead of a premature error path.
- Verification: Added a production-contract assertion for the new loading status copy; `pnpm check` passed with 94 tests, TypeScript, secret scan, and production build.

### Custom framework copy sounded too internal

- Severity: Low
- Description: Custom framework descriptions used implementation-heavy wording such as configurable internal fields and internal qualification standards.
- Root cause: The copy was accurate to the data model, but not to the calmer product language used across SalesFrame.
- Recommended improvement: Describe custom frameworks as workspace-specific coaching standards rather than internal configuration.
- Fix applied: Reworded custom framework copy in the core playbook catalog and navigation content, then added a production-contract assertion rejecting the old wording.
- Before impact: The feature felt slightly like an admin setup object instead of a flexible sales-coaching playbook.
- After impact: Custom frameworks now read as part of the seller workflow while preserving the same functionality.
- Verification: Added a production-contract assertion for the new wording and old-copy rejection.

### Transcript partial state added visual noise

- Severity: Low
- Description: Partial live transcript messages showed a tiny `Live` pill beside the speaker and timestamp.
- Root cause: The transcript kept a status badge from the earlier card-style transcript UI after moving to a cleaner message layout.
- Recommended improvement: Keep partial transcript lines visually distinct through the message treatment, not extra labels.
- Fix applied: Removed the `Live` pill from transcript message headers and kept partial lines differentiated by the existing outline bubble style.
- Before impact: The transcript felt a little more system-like during live calls, adding noise to an already time-sensitive surface.
- After impact: The transcript reads more like a calm conversation while still distinguishing in-progress speech.
- Verification: Added a production-contract assertion that the transcript tab does not render the `Live` pill label.

### Dashboard repeated the breadcrumb as a header eyebrow

- Severity: Low
- Description: The home dashboard showed a small `Home` label directly above `Seller dashboard`, even though the breadcrumb already establishes the page location.
- Root cause: The dashboard retained an older page-eyebrow pattern after broader pages were simplified.
- Recommended improvement: Let the primary heading carry the page identity and remove repeated navigation labels from the content area.
- Fix applied: Removed the dashboard `Home` eyebrow and added a production-contract assertion.
- Before impact: The dashboard had one extra line of low-value text at the top of the main workflow.
- After impact: The dashboard opens more directly on the seller's actual work.
- Verification: Added a production-contract assertion that the dashboard header starts with `Seller dashboard` and does not re-render the `Home` eyebrow.

### Speaker map appeared before transcript context existed

- Severity: Low
- Description: The call cockpit transcript tab showed a collapsed `Speaker map` even when no transcript lines were present.
- Root cause: The speaker map always seeded Seller and Customer rows, so the component rendered before there was anything useful to edit.
- Recommended improvement: Show speaker mapping only after there are real transcript turns, saved identities, or an explicitly added speaker.
- Fix applied: The speaker map now ignores blank transcript rows and stays hidden until speaker context exists.
- Before impact: The empty transcript state felt more configurable and technical than it needed to.
- After impact: The empty transcript state stays focused on what will happen next: transcript lines appearing as people speak.
- Verification: Added a production-contract assertion for the contextual speaker-map guard.

### Empty live coach card showed inactive feedback controls

- Severity: Low
- Description: The call cockpit showed `Asked`, `Too soon`, `Softer`, and `Skip` controls before any AI recommendation existed.
- Root cause: The live coach card rendered the feedback controls unconditionally and relied on disabled states when there was no displayed question.
- Recommended improvement: Empty states should explain what happens next, not show controls that cannot be used yet.
- Fix applied: Feedback controls now render only when a real question is displayed.
- Before impact: Sellers saw actions they could not take, which made the empty call cockpit feel less confident.
- After impact: The empty live coach state stays focused on readiness; feedback controls appear only when the seller has a recommendation to act on.
- Verification: Added a production-contract assertion that feedback controls are gated by `displayedQuestion` and are not disabled because no question exists.

### Empty coach detail tabs exposed internal readiness state

- Severity: Low
- Description: The call cockpit showed `Gaps`, `Parked`, and `Coach read` tabs even before a live-guidance response existed.
- Root cause: The detailed coach panels had their own empty states, duplicating the main guidance card and exposing internal AI-readiness language too early.
- Recommended improvement: Keep the live moment focused on one clear readiness message; show deeper analysis only after there is real guidance to inspect.
- Fix applied: `LiveCoachDetailTabs` now returns nothing until guidance exists, and the child cards no longer carry pre-guidance filler copy.
- Before impact: The cockpit could feel more like a debugging surface than a calm sales coach before a call began.
- After impact: Sellers see one focused empty state first; richer coach detail appears only when it has useful content.
- Verification: Added production-contract assertions that the detail tabs are gated by `guidance` and the old pre-guidance filler copy is absent.

### Live capture empty states drifted across tabs

- Severity: Low
- Description: The live capture `Evidence` empty state used a polished icon row, while `Notes` missed its icon and `Transcript` used a different block style.
- Root cause: Each tab owned its own empty-state markup, so small visual decisions drifted apart.
- Recommended improvement: Use one shared live-capture empty-state pattern for all three tabs.
- Fix applied: Added `LiveCaptureEmptyState` and wired Notes, Evidence, and Transcript to the same bordered icon row treatment.
- Before impact: The tabs felt slightly inconsistent despite belonging to the same live capture surface.
- After impact: Notes, Evidence, and Transcript now feel like one coherent, calm component family.
- Verification: Added production-contract assertions for the shared component, icon usage, and each tab's empty-state copy.

### Capture readiness showed static technical checks too early

- Severity: Low
- Description: The capture card always showed `Seller mic`, `Customer audio`, and `AI guidance` rows, even before a call was starting.
- Root cause: Audio health indicators were rendered as static setup rows rather than a live signal panel tied to capture activity.
- Recommended improvement: Keep the pre-call state focused on the start action; show signal health only when capture is active or needs attention.
- Fix applied: Added a live-only `CaptureSignalStack` with calm status dots and dynamic labels like `Listening`, `Connected`, `Building`, and `Not detected`.
- Before impact: The capture area felt busier and more technical than necessary before a seller had started a call.
- After impact: The card stays quiet before the call, then becomes a compact living health panel while SalesFrame is listening.
- Verification: Added production-contract assertions for the live-only signal gate and dynamic signal states.

### Start Call could fail on invalid also-updates metadata

- Severity: High
- Description: A real-browser Start Call run reached the AI readiness step, then production logs showed `openai_mismatched_live_guidance_also_cover_field`.
- Root cause: The live-guidance function treated display-only `alsoCovers` metadata as fatal when OpenAI attached a selected playbook field to the wrong intent cluster. The actual question could be usable, but the call was blocked before capture.
- Recommended improvement: Keep actual evidence writes strict, but sanitize optional display metadata before fatal reference checks.
- Fix applied: Added `sanitizeDisplayAlsoCovers` before `assertGuidanceReferencesSelectedFields`, with a warning log when invalid supporting entries are removed.
- Before impact: A seller could be stopped from starting a call by an invisible metadata mismatch, creating the generic `SalesFrame could not finish the AI step` experience.
- After impact: The first question remains AI-generated and evidence updates remain validated, while bad secondary `also updates` entries are dropped instead of blocking the call.
- Verification: Reproduced the failure path in Safari, inspected Netlify `live-guidance` logs, added a production-contract assertion for the sanitizer, and ran build plus function/security contract checks.

### Start Call audio-source label clipped in desktop modal

- Severity: Low
- Description: On the Start Call `Call` step, the selected `Meeting app/tab audio + microphone` value truncated inside the select trigger.
- Root cause: The right-hand modal column is intentionally compact, and the select label was doing too much work for the available width.
- Recommended improvement: Use a short selected label and keep detailed source guidance in the helper copy below the field.
- Fix applied: Changed the visible option to `Meeting audio + microphone`; the helper still explains meeting tab, Entire Screen, Share audio, and System audio.
- Before impact: The most important capture setup option looked cramped at the exact moment a seller needs confidence.
- After impact: The field reads cleanly while the explanatory text still gives the right capture instruction.
- Verification: Updated the production-contract assertion and ran build plus the app production contract suite.

### Header Start Call control looked real but did nothing

- Severity: High
- Description: In Safari, the black `Start call` button in the opportunity header did not open the Start Call modal, while the red Start Call controls lower on the page did.
- Root cause: The header command bar used a recording-toggle handler that only knows how to stop an active call. When no call was running, clicking `Start call` returned immediately with no feedback.
- Recommended improvement: Render the real Start Call dialog trigger when idle, and render a true Stop Call button only while capture is active.
- Fix applied: `CommandBar` now accepts a `startCallAction`; idle state renders the shared `StartRecordingDialog`, active state renders the stop action, and the old no-op `onRecordingChange(!isRecording)` path is gone.
- Before impact: Sellers could click the most prominent Start Call button and lose trust because nothing happened.
- After impact: Every visible Start Call entry point opens the same guarded setup flow, while Stop Call remains available only when relevant.
- Verification: Reproduced the issue in Safari, updated production-contract assertions, and reran build plus app/function contract suites.

### OpenAI key removal was one click

- Severity: High
- Description: Settings let a seller remove the workspace OpenAI key directly from the `Remove` button without a confirmation step.
- Root cause: The Settings view called `deleteOpenAiKey` immediately from the visible button, unlike account, opportunity, and call deletion flows that use a deliberate confirmation dialog.
- Recommended improvement: Treat OpenAI key removal as a destructive workspace capability change, with confirmation copy explaining that live questions, transcription, notes, enrichment, and post-call outputs will stop until a key is saved again.
- Fix applied: Added a shadcn-style `Remove OpenAI key?` confirmation dialog with masked key/fingerprint context, Cancel, destructive `Remove key`, inline error handling, and outside-click dismissal prevention while the action is pending.
- Before impact: A seller could accidentally break AI services for the active workspace with one click.
- After impact: Key removal now has a clear decision point and matches the app's destructive-action pattern.
- Verification: Inspected Settings in Safari, updated production-contract assertions for the confirmation path, and reran build plus contract checks.

### Remote meeting capture could ask for mic before proving customer audio

- Severity: High
- Description: In Safari, selecting `Meeting audio + microphone` reached the microphone permission prompt without first proving that browser, window, or system audio was available.
- Root cause: The audio preflight attempted display capture, but if the browser could not provide a customer-side audio track it continued into microphone capture and only failed after the mic step.
- Recommended improvement: Remote meeting mode should be strict: customer-side audio must be detected before requesting the seller microphone. If the browser cannot provide that audio, block with clear guidance to use browser-based Zoom/Teams/Meet, in-person mic mode, or the future Audio Connector.
- Fix applied: `requestAudioSources` now throws immediately when `meeting_audio` cannot produce a display/system audio track, stops any partial streams, and only requests the seller mic after customer audio exists.
- Before impact: Sellers could believe SalesFrame was capturing a Teams/Zoom window while it was really headed toward mic-only failure, which explains missing buyer transcript in Safari/native-app setups.
- After impact: SalesFrame fails earlier and more honestly, before the user grants microphone access for a capture mode that cannot hear the buyer.
- Verification: Reproduced the Safari prompt sequence and added production-contract assertions that meeting capture no longer silently falls through to mic-only setup.

### Live speaker creation used check-then-insert

- Severity: Medium
- Description: Live transcript speaker creation still had a race where two realtime audio streams could try to create the same `Seller` or `Customer` speaker at nearly the same time.
- Root cause: `ensureCallSpeaker` checked for an existing speaker and then inserted, instead of using the same unique-key upsert pattern as manual speaker edits.
- Recommended improvement: Use an idempotent upsert for live speaker creation so duplicate speaker label races cannot interrupt capture.
- Fix applied: `ensureCallSpeaker` now upserts on `call_id,label`.
- Before impact: A live call with multiple streams could hit a rare speaker-label duplicate and destabilise transcription.
- After impact: Concurrent speaker creation resolves to one call speaker row without surfacing an error.
- Verification: Added a production-contract assertion that live speaker creation uses `onConflict: "call_id,label"`.

### Start Call entered the cockpit before capture was live

- Severity: High
- Description: Safari showed the microphone permission prompt after the app had already navigated into the call cockpit, which made failures feel like the seller had been dropped into an unfinished live call.
- Root cause: The Start Call handler set the active account, opportunity, call, route, and call library state before `callCapture.startCall` had completed audio preflight, permission, realtime transcription setup, and recording start.
- Recommended improvement: Keep the Start Call modal in charge until the first AI question is ready and browser capture has actually started. Only then navigate to the cockpit and add the call to visible workspace state.
- Fix applied: Moved cockpit navigation, active-call state, live-guidance state, and call-library insertion to after `callCapture.startCall` succeeds.
- Before impact: A permission denial or capture failure could leave the user looking at the call cockpit with a failed or not-yet-live call.
- After impact: Permission and capture errors stay inside the Start Call flow, while successful starts open directly into a genuinely live cockpit.
- Verification: Reproduced the Safari prompt placement, updated production-contract assertions for the safer ordering, and reran build plus app/function contract checks.

### Pre-live Start Call failures could leave phantom calls

- Severity: Medium
- Description: If Start Call created the database call record and then failed during AI readiness or audio capture, the call could remain marked `needs_attention` even though no recording actually started.
- Root cause: The generic Start Call error handler did not distinguish between failures before capture started and failures after a live recording existed. New account/opportunity UI state and customer research could also update before capture was live.
- Recommended improvement: Archive pre-live failed calls quietly, but keep genuinely started calls recoverable as `needs_attention`.
- Fix applied: Added a `captureStarted` guard so failures before `callCapture.startCall` succeeds archive the call; only failures after capture starts use `needs_attention`. New records created by a failed pre-live Start Call attempt are rolled back, and UI/customer-research state only updates after capture starts.
- Before impact: The call library could accumulate broken records for calls that never started, and retrying a failed new-account/new-opportunity call could create duplicates.
- After impact: Sellers only see calls that genuinely started, failed pre-live attempts stay inside the modal, and retrying the same modal state does not duplicate new records.
- Verification: Added production-contract assertions for the `captureStarted` guard, failure status split, post-capture UI updates, post-capture customer research, and pre-live rollback.

### Local QA app could not authenticate until frontend Supabase env was present

- Severity: Medium
- Description: The local browser showed `SalesFrame cannot reach sign-in right now. Try again in a moment.` even with valid QA credentials.
- Root cause: `.env.local` had the Logo.dev publishable key but was missing the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values required for the browser auth client.
- Recommended improvement: Keep `.env.local` aligned with `.env.example` before browser QA, and continue keeping secret keys out of Git.
- Fix applied: Added the existing public Supabase frontend values to ignored `.env.local` for local QA.
- Before impact: Local browser QA could not reach authenticated flows, which made Start Call testing look like an app auth issue.
- After impact: The local app authenticates and loads the heavy QA workspace for browser verification.
- Verification: Confirmed the missing env presence, restarted a local server on port 5174, and verified the authenticated seller dashboard loaded.

### Start Call missing-key state exposed a dead primary action

- Severity: Medium
- Description: On Step 4 of Start Call, a workspace without a saved OpenAI key showed an alert with `Open settings` and also a disabled red `Start call` footer button.
- Root cause: The final footer always rendered the destructive Start Call action, even when the app already knew the required AI key was missing.
- Recommended improvement: Missing-key state should route the seller to the one action that can fix the issue, without a disabled red button competing for attention.
- Fix applied: The alert now explains the missing key, and the footer primary action becomes `Open settings` until a key is connected. The red Start Call action only appears when the workspace has an OpenAI key.
- Before impact: Sellers could read the alert correctly but still feel like the main call action was broken.
- After impact: The modal gives a single clear recovery path and avoids pretending the call can start.
- Verification: Reproduced the missing-key state in the browser, captured Step 4 before/after screenshots, updated the production-contract assertion, and reran build plus app/function contract suites.

### Start Call stepper cramped the Seller Research label

- Severity: Low
- Description: The desktop Start Call modal truncated the final step label as `Seller Resea...`.
- Root cause: The modal was sized for a compact two-column layout, but four step cards with icon and label did not have enough horizontal room.
- Recommended improvement: Preserve the full `Seller Research` label because it was intentionally renamed and should read confidently.
- Fix applied: Increased the Start Call modal desktop width from `sm:max-w-2xl` to `sm:max-w-3xl`.
- Before impact: The modal felt slightly unfinished on the final setup step.
- After impact: Step labels render cleanly with more breathing room, while mobile constraints remain unchanged.
- Verification: Captured the Step 4 modal after the patch and added a production-contract check for the wider modal.

### Safari window could not be attached through Computer Use

- Severity: Informational
- Description: Computer Use could list Safari as running, but `get_app_state` returned `cgWindowNotFound`, so I could not inspect or click the existing Safari window directly.
- Root cause: The OS automation bridge could not see Safari's active window in this session.
- Recommended improvement: Use in-app browser verification for local flows, and only continue Safari permission testing when the browser window is attachable or the user manually confirms microphone/browser permission prompts.
- Fix applied: No product code change required; the QA pass continued in the in-app browser and stopped at the browser permission/key boundary.
- Before impact: The QA pass could have incorrectly claimed Safari permission behavior was fully verified.
- After impact: The limitation is documented honestly, with browser-code and local-app verification used for the parts we can prove.
- Verification: `mcp__computer_use.get_app_state` failed for Safari and Chrome; in-app browser QA verified the authenticated Start Call modal path instead.

### Account header logos could look blank while loading

- Severity: Low
- Description: In Safari, the account header avatar briefly appeared as an empty grey square before the remote Logo.dev image finished loading.
- Root cause: `AccountLogoAvatar` rendered the remote image immediately when a URL existed, leaving no visible initials fallback while the image was still loading.
- Recommended improvement: Company logos should feel graceful even on slow or blocked image loads: show initials until the image has actually loaded, then fade the logo in.
- Fix applied: Added a loaded-logo state to `AccountLogoAvatar`; initials stay visible until the resolved logo URL fires `onLoad`, and image opacity transitions in only after load.
- Before impact: A first-time seller could interpret the empty tile as broken logo enrichment.
- After impact: Account avatars always show either initials or a resolved logo, with no empty loading state.
- Verification: Observed the blank header state on the Apple account in Safari, patched the avatar component, added a production-contract assertion, and reran build plus app production contract checks.

### Opportunities and Calls page layouts are now aligned in Safari

- Severity: Informational
- Description: Safari QA compared the workspace-level Opportunities and Calls pages after earlier layout requests.
- Finding: Both pages now use the same calm page title, top-right primary action, compact filter grid, row/list density, and action dropdown pattern.
- Note: The global Opportunities subtitle displays account plus formatted opportunity amount. In the tested data, `Unqualified` is the opportunity value, not the stage leak previously suspected.
- Follow-up: A broader design-system pass should still migrate remaining hand-rolled dialog footers to the shared `DialogActions` component where it materially improves consistency.
- Verification: Inspected the production Safari accessibility tree and rendered pages for Opportunities, Calls, Account record, Account opportunities, and Account intelligence.

### Personal profile email looked editable but was not auth-backed

- Severity: Medium
- Description: The personal Account page displayed `Email` as a normal editable profile input.
- Root cause: The profile save flow updates the app profile row, not the Supabase authentication email. That made the field look like it could change login and recovery email when it could not.
- Recommended improvement: Treat the auth email as a read-only sign-in identity unless a real auth email-change flow exists.
- Fix applied: Replaced the editable email control with a read-only `Sign-in email` field and helper copy, and ensured profile save keeps the authenticated email value.
- Before impact: A seller could edit the field, save, and reasonably expect their login email to have changed.
- After impact: The page now tells the truth: email is used for login and account recovery, while other profile details remain editable.
- Verification: Added a production-contract assertion and reran the app production and function security suites.

### Production Safari still fails before first live guidance is ready

- Severity: High
- Description: A real Safari Start Call test on `salesframe.ai` reached `Writing your first live question`, stayed there for longer than felt acceptable, then returned `SalesFrame could not get the first live question ready`.
- Root cause: The production build currently does not expose the new trace reference in this specific error, so the exact backend cause cannot be confirmed from the UI alone.
- Recommended improvement: Deploy the latest trace-ID and client-error reporting build, then reproduce once to inspect the Netlify function log for the reference ID.
- Fix applied: No new product code was required in this pass because local code already appends API trace references and reports Start Call failures to `/api/client-error`; the production deployment simply appears behind the local fix.
- Before impact: The seller sees a safer modal failure, but support still cannot tie the screenshot to a specific function log without guessing.
- After impact: Once deployed, the same failure should include a reference ID and safe metadata in Netlify logs.
- Verification: Stepped through the production Safari Start Call modal to Step 4, triggered Start Call, observed the first-guidance failure, and confirmed local build plus app/function contract suites pass.

### First live question used the full live-call schema before the call started

- Severity: High
- Description: The Start Call modal had to wait for the full live-guidance schema before opening the cockpit, even though no transcript existed yet.
- Root cause: Pre-call readiness reused the same large response contract as in-call coaching: full evidence arrays, parked intent debt, flow details, alternatives, candidate scores, context usage, and persistence metadata.
- Recommended improvement: Keep live calls AI-first, but ask OpenAI for a smaller pre-call opener contract until actual transcript turns exist.
- Fix applied: Added `preCallLiveGuidanceSchema` and `hydratePreCallGuidanceResult`. Empty-transcript calls now request one AI-generated opening recommendation, three ranked AI candidates, lifecycle, feedback controls, and context usage through the compact schema. Once transcript exists, the function still uses the full rich live-guidance schema.
- Before impact: The most important action in the product could feel slow or fail before the browser even reached audio capture.
- After impact: Start Call has a narrower, faster, less brittle first-question path while preserving the existing frontend response shape and AI-first behaviour.
- Verification: Confirmed OpenAI's current model docs list `gpt-5.4-mini` and `gpt-5.4-nano` as valid lower-latency models, then reran app contracts, function security contracts, and production build.

### Safari Start Call AI readiness had no client timeout

- Severity: High
- Description: A real Safari Start Call retest on `salesframe.ai` reached `Writing your first live question`, stayed on the AI step for too long, then returned to the final modal step with the generic first-question error.
- Root cause: The browser waited on `/api/openai/live-guidance` without a client-side timeout or a specific timeout error path. The UI also pointed users at Settings even when the OpenAI key check had already passed.
- Recommended improvement: Treat the pre-call AI request as a bounded readiness check: abort it from the browser after a reasonable window, report the failure with client telemetry, and show different copy for timeout, incomplete AI response, and real key/billing issues.
- Fix applied: Added abort/timeout support to the shared function client, gave Start Call first-guidance a 22-second timeout tied to the modal cancel signal, and split Start Call error copy into timeout, incomplete AI response, and key/billing cases.
- Before impact: A seller could wait through a frozen-feeling AI step and receive a vague error that implied the wrong fix.
- After impact: The next deployed build should stop waiting indefinitely, keep the call from starting without AI readiness, and produce a clearer user-facing failure plus safer diagnostics.
- Verification: Reproduced the failure in Safari with Computer Use, then added contract coverage for the timeout path and distinct Start Call AI error messages.

### Account enrichment storage error used customer research language

- Severity: Low
- Description: The storage-not-ready error for Account Enrichment still said `Customer research`.
- Root cause: The account enrichment function, client function mapper, and Supabase helper copied an older customer-research message.
- Recommended improvement: Keep feature names exact in error states, especially where the user recently split Seller Research from Customer Research.
- Fix applied: Renamed the message to `Account enrichment is still getting ready...` across the Netlify function and client helpers.
- Before impact: A seller could think a different Start Call research feature was broken.
- After impact: The message now points to the correct account-enrichment action and avoids internal setup wording.
- Verification: Added e2e and function contract assertions that require the new Account Enrichment copy and reject the stale Customer Research wording.

### Failed Start Call modal cancel did not reset the failed state

- Severity: Medium
- Description: During Safari QA, the Start Call modal remained on the final failed Seller Research step after trying the visible Cancel control through the automation bridge.
- Root cause: The non-submitting footer Cancel only set the dialog open state false, while the in-flight Cancel path reset the abort controller, progress, submission state, error, and step index.
- Recommended improvement: Every modal cancel path should run the same explicit reset logic after an error state.
- Fix applied: Reused `handleCancelStart` for the non-submitting Start Call Cancel button.
- Before impact: A seller could feel trapped in a failed Start Call state or reopen the modal with stale state.
- After impact: Cancel clears the Start Call error and returns the modal to a clean first step.
- Verification: Added during the Safari Start Call QA pass; covered by production build and existing modal dismissal contracts.

### Seller Research copy still referenced customer research

- Severity: Low
- Description: Some seller-company/product-context fields were already labelled `Seller Research`, but helper text still said the AI would connect the product to `customer research`.
- Root cause: The label rename was completed faster than the surrounding helper copy and product spec cleanup.
- Recommended improvement: Reserve `Customer Research` for account enrichment and public-source account research. Use `Seller Research` or `buyer research and live questions` for the seller's own company/product context.
- Fix applied: Updated Start Call, workspace onboarding, personal selling-context copy, and the product build spec to use the correct terminology.
- Before impact: Sellers could reasonably wonder whether the final Start Call step was about researching themselves or the customer.
- After impact: The distinction is clearer: Customer Research enriches the account; Seller Research tells SalesFrame what the seller sells.
- Verification: Grep checked the old visible phrasing and reran app contracts plus production build.

### Start Call Seller Research mixed seller and buyer fields without hierarchy

- Severity: Low
- Description: The final Start Call step was labelled `Seller Research`, but the section placed seller-company fields and customer-contact fields in one undifferentiated block.
- Root cause: The step had grown to carry both seller context and buyer-meeting context, but the visual hierarchy still treated every field as the same kind of research input.
- Recommended improvement: Keep the one-step flow, but split the content into quiet `Seller context` and `Buyer context` groups so the seller understands why customer contact fields appear there.
- Fix applied: Added short group labels and calmer helper copy, changed the switch label from generic `Enable` to `Use research`, and aligned the create-account Seller Research card copy.
- Before impact: The user could pause and wonder why customer fields were inside Seller Research.
- After impact: The step explains itself: seller context shapes the opener, buyer context helps the question fit the person in the meeting.
- Verification: Added production-contract assertions for the Seller context, Buyer context, Use research, and buyer-research wording.

### Local Start Call QA could not log client errors in development

- Severity: Medium
- Description: While testing the Start Call flow locally in Safari, client-side error reporting was wired to `/api/client-error`, but the local Vite Netlify-function router did not expose that endpoint.
- Root cause: The `client-error` function was added after the local function route map and was not included in `vite.config.ts`.
- Recommended improvement: Keep local function routing in lockstep with production function paths so QA reproductions generate the same diagnostics as deployed errors.
- Fix applied: Added `/api/client-error` to the local function route map and added a production-contract assertion so it cannot drift again.
- Before impact: Local QA could see a Start Call failure but lose the client-side diagnostic event.
- After impact: Local and deployed builds now share the same client-error endpoint path, making Start Call failures easier to trace.
- Verification: Reran the app production contract suite, function security contract suite, TypeScript, Vite build, and `git diff --check`.

### First-question request failures now include a client reference even on timeout

- Severity: High
- Description: A Start Call first-question timeout can happen before the browser receives a Netlify trace ID, leaving support with no searchable reference.
- Root cause: Function responses carried server trace IDs, but browser-side request timeouts created local errors without any request reference.
- Recommended improvement: Add a generated client request ID to every function call, echo it in function error envelopes, log it server-side, and attach it to client timeout errors.
- Fix applied: Added `X-SalesFrame-Client-Request-Id` to function calls, included the value in shared function error logging/responses, and used it as the error reference for client-side request timeouts.
- Before impact: The seller could report `OpenAI took too long...` with no reference number if the request timed out locally.
- After impact: Timeout and server-error paths both produce a reference that can be searched in logs.
- Verification: Added production-contract assertions for client request IDs and reran app/function tests plus build.

### Pre-call prep routed sellers into the question queue too early

- Severity: Low
- Description: The call prep brief offered `View question queue`, even though the queue only makes sense after live AI guidance exists.
- Root cause: The question queue is a valid live-coaching detail view, but it was exposed from a static pre-call prep dialog.
- Recommended improvement: Keep pre-call prep focused: cancel or open methodology. Live alternatives should stay behind the active call cockpit.
- Fix applied: Removed the pre-call `View question queue` action from `CallPrepDialog` and kept `Open methodology` as the single primary action.
- Before impact: A seller could be sent into an empty or out-of-flow queue before starting the call.
- After impact: The prep dialog stays calm and aligned to the one-question live coaching model.
- Verification: Added a contract assertion that the prep dialog no longer contains `View question queue`.

### OpenAI model defaults were not consistently documented

- Severity: Medium
- Description: Live guidance used current low-latency model defaults, but `.env.example`, Netlify setup docs, and a few nested speaker-attribution fallbacks still referenced the older text model default.
- Root cause: Live-call model defaults were upgraded incrementally, leaving documentation and secondary fallback paths behind.
- Recommended improvement: Keep Netlify setup, local env examples, and all OpenAI helper fallbacks on the same model family unless there is an explicit reason to diverge.
- Fix applied: Updated `.env.example`, `docs/netlify-env-setup.md`, the shared OpenAI default, and speaker-attribution fallbacks to `gpt-5.4-mini`, while keeping live-state on `gpt-5.4-nano`.
- Before impact: A deployment could copy stale model settings and behave differently from the intended live-coach architecture.
- After impact: New deployments have a consistent, current model setup for live guidance, enrichment, post-call outputs, and speaker attribution.
- Verification: Checked current official OpenAI model docs, then added/updated production-contract assertions and reran tests/build.

### Safari local Computer Use QA remains unstable for React form input

- Severity: Medium
- Description: In Safari on local `127.0.0.1:5173`, the login page rendered, but after direct Computer Use field interaction the page intermittently lost both visible content and page accessibility nodes until reload.
- Root cause: No app exception appeared in the dev server, TypeScript passed, and reloading restored the page. This appears tied to the Safari + Computer Use + local dev interaction path rather than a deterministic React crash, but it blocked a clean local Safari login.
- Recommended improvement: Keep using production Safari for deployed smoke checks, use browser/e2e automation for repeatable local flows, and preserve client-error logging so real customer browser failures can be traced from the app itself.
- Fix applied: No UI code was changed specifically for this automation instability; the pass instead fixed the missing local client-error endpoint and added stronger request references so the next real failure is diagnosable.
- Before impact: Local Safari QA could get stuck before reaching Start Call even when the app itself reloaded cleanly.
- After impact: The limitation is documented, and the diagnostic path is stronger for actual Start Call failures.
- Verification: Reproduced in Safari via Computer Use, confirmed the dev server emitted no error, and verified code through contract tests and build.
