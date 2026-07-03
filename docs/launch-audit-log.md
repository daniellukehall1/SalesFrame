# SalesFrame Launch Audit Log

This log tracks launch-readiness issues found during the calm UX audit. Each entry records the practical impact, root cause, fix, and verification evidence.

## 2026-07-03

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
