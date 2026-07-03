# SalesFrame Launch Audit Log

This log tracks launch-readiness issues found during the calm UX audit. Each entry records the practical impact, root cause, fix, and verification evidence.

## 2026-07-03

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
