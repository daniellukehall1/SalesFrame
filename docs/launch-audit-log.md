# SalesFrame Launch Audit Log

This log tracks launch-readiness issues found during the calm UX audit. Each entry records the practical impact, root cause, fix, and verification evidence.

## 2026-07-05

### Start Call audio source choices used implementation language

- Severity: Medium
- Description: The Start Call `Call` step exposed technical capture labels like microphone-only, in-person phone mic, and meeting audio plus microphone.
- Root cause: The UI mirrored internal browser capture modes instead of the seller's mental model: one audio stream, two separate audio streams, or a future meeting bot.
- Recommended improvement: Keep the capture engine stable, but translate the selector into a simple channel model with clear helper copy and a disabled future bot option.
- Fix applied: Replaced the visible audio source choices with `One channel`, `Two channels`, and disabled `Meeting bot - coming later`; mapped one-channel selections to the tuned mixed-microphone path with a legacy microphone fallback, and mapped two-channel selections to the existing meeting-audio plus seller-mic path.
- Before impact: Sellers had to infer which browser/device option matched their call setup, increasing hesitation before the call could start.
- After impact: The modal now asks sellers to choose the number of audio channels, which is calmer, more device-agnostic, and easier to reason about across desktop and mobile.
- Verification: Production-contract coverage now requires the new selector labels, rejects the old visible labels, and keeps the disabled meeting bot non-actionable until the integration exists.

### Start Call playbook menu stretched the Call step

- Severity: Low
- Description: Opening the Playbooks selector on the Start Call `Call` step could make the modal feel cramped and risk clipping the dropdown below the field.
- Root cause: The selector rendered its option list inside the modal layout with a downward-first absolute menu, so tight modal viewports depended on the dialog scroll area instead of a collision-aware floating surface.
- Recommended improvement: Use the shared popover behavior for the playbook selector, keep the dropdown out of modal layout flow, prefer opening upward inside modals, and let the options scroll internally.
- Fix applied: Rebuilt `PlaybookMultiSelect` with the shadcn/Radix `Popover`, capped the list height with viewport-aware bounds, set internal list scrolling, and made the selector open upward by default with collision padding.
- Before impact: The modal could gain visual clutter from unnecessary scroll behavior and the dropdown could feel cut off when the trigger sat low in the dialog.
- After impact: The menu floats calmly above the trigger, stays inside the viewport, and no longer changes the dialog height when opened.
- Verification: Production-contract test coverage now asserts the portal-backed popover, internal scrolling, compact selected summary, and removal of the old absolute menu; browser QA confirmed desktop and mobile dropdown geometry has no clipping and no modal-height change on open.

### Orphaned list records used database-style unknown labels

- Severity: Low
- Description: Search results, dashboard rows, Opportunities, and Calls could show `Unknown account` or `Unknown opportunity` when a related record was missing or still unavailable.
- Root cause: List metadata used developer-friendly fallback text rather than seller-facing language for missing relationships.
- Recommended improvement: Use calm relationship copy that explains the state without implying the app is confused or broken.
- Fix applied: Replaced visible `Unknown account` and `Unknown opportunity` fallbacks with `No account linked` and `No opportunity linked` across workspace search, dashboard focus, opportunities, and calls.
- Before impact: Missing relationship data could look like a raw database placeholder and reduce trust in the record list.
- After impact: Orphaned or incomplete records now communicate the relationship state in plain product language.
- Verification: Updated production-contract coverage to require the linked-record fallback copy and reject the old unknown-account/opportunity strings.

### Add Opportunity optional fields felt heavier than related modals

- Severity: Low
- Description: The Add Opportunity modal wrapped optional fields in a bordered panel and squeezed the formatted amount preview into the label row.
- Root cause: The dialog retained an older framed optional-section pattern while Create Account's opportunity step had already moved to a softer, space-efficient muted section with the amount preview below the input.
- Recommended improvement: Use the same calm optional-field structure across opportunity creation surfaces and keep formatting feedback close to the field without crowding labels.
- Fix applied: Replaced the bordered optional-fields wrapper with a muted unframed section and moved the amount preview below the amount input.
- Before impact: The Add Opportunity modal felt visually inconsistent and the amount preview could crowd the label area on narrower layouts.
- After impact: Optional opportunity details now align with the rest of the modal system and read more clearly on desktop and mobile.
- Verification: Updated production-contract coverage for the unframed optional-fields section, side-by-side amount/date layout, and below-input amount preview.

### Confirmation summaries were more framed than necessary

- Severity: Low
- Description: Delete dialogs, the OpenAI key removal dialog, and the saved OpenAI connection state used bordered summary panels inside already-focused modal or setup surfaces.
- Root cause: Confirmation and setup summaries reused generic bordered panel styles even though the dialog/card context already provided the required boundary and hierarchy.
- Recommended improvement: Keep destructive errors and missing-key blockers framed, but show selected-record summaries and saved-connection metadata on quieter muted surfaces.
- Fix applied: Removed decorative borders from delete summaries, remove-key metadata, and the saved OpenAI connection state while preserving the destructive missing-key frame and destructive confirmation actions.
- Before impact: Confirmation flows felt more boxed-in than needed, and ordinary saved-key context could look too similar to a warning.
- After impact: Confirmation dialogs and account setup read cleaner, while true destructive or blocking states still stand out.
- Verification: Added production-contract coverage for unframed confirmation summaries, unframed saved-key metadata, and framed missing-key blocker treatment.

### Replay passive states looked like boxed warnings

- Severity: Low
- Description: The call replay status line and empty notes message used bordered background panels even when nothing needed the seller's attention.
- Root cause: Replay helper text reused the same framed treatment as interactive timeline controls and playback error states.
- Recommended improvement: Preserve strong treatment for replay controls and real playback errors, but make routine replay status and empty notes feel like quiet supporting text.
- Fix applied: Changed replay status and empty-notes surfaces to unframed muted panels while leaving the timeline, note list, and destructive playback errors intact.
- Before impact: Fresh post-call replay could feel more visually busy than necessary and made passive text read as a separate alert.
- After impact: Replay now keeps the seller focused on Play/Open/Delete actions while routine status copy stays calm.
- Verification: Extended replay production-contract coverage to require unframed passive replay states and reject the old bordered helper panels.

### Playbook methodology surfaces used too many nested borders

- Severity: Low
- Description: Read-only playbook required-field descriptions and opportunity methodology summary metrics used bordered mini-panels inside cards.
- Root cause: Passive methodology context reused the same framed treatment as editable custom-framework fields, even though sellers are only reading these values.
- Recommended improvement: Reserve bordered rows for editable/custom framework controls and use muted unframed surfaces for static guidance and metrics.
- Fix applied: Removed decorative borders from system playbook required-field rows and opportunity methodology metric tiles while keeping custom-framework editable rows framed.
- Before impact: Playbook pages and methodology tabs felt denser and more mechanical than necessary, especially when several frameworks were selected.
- After impact: Framework guidance now scans more quietly while editable custom-framework sections still have clear boundaries.
- Verification: Added production-contract coverage for unframed read-only playbook/methodology surfaces and preserved framed custom-framework editor rows.

### Post-call planning surfaces were over-framed

- Severity: Low
- Description: The post-call next-call plan rows and next-call brief detail blocks used bordered mini-panels inside already-framed cards.
- Root cause: The post-call surfaces retained older card-within-card styling even though the information is passive guidance rather than an alert, control, or separate object.
- Recommended improvement: Keep the post-call content structured, but use quiet muted surfaces so the brief feels like one cohesive plan instead of a stack of separate boxes.
- Fix applied: Removed decorative borders from next-call brief text/list blocks and post-call plan rows while preserving replay controls, destructive errors, and primary actions.
- Before impact: Post-call pages felt busier than necessary at the exact moment a seller needs a calm summary and clear next action.
- After impact: Next-call guidance now reads as a softer, more unified brief with less visual noise and better alignment to the app’s calm surface language.
- Verification: Added production-contract coverage requiring unframed next-call brief blocks and post-call plan rows, and rejecting the old bordered classes.

### Opportunity intelligence summaries were over-framed

- Severity: Low
- Description: The Opportunity Intel tab used bordered panels for the read-only next-question preview and methodology count summaries.
- Root cause: The intelligence view retained an older framed-summary style even though the information is passive, read-only context inside an already framed card.
- Recommended improvement: Keep the hierarchy and counts, but use quiet muted surfaces so the tab feels like analysis rather than a stack of alerts.
- Fix applied: Removed decorative borders from the question preview panel and methodology summary tiles, and softened the starter-guidance inset to a lighter background.
- Before impact: Opportunity intelligence felt heavier than necessary and competed visually with the actual call brief and methodology evidence.
- After impact: The Intel tab is calmer and easier to scan while preserving the same question guidance and selected-playbook gap counts.
- Verification: Expanded production-contract coverage for the unframed Opportunity Intel surfaces and selected-playbook summary source.

### Start Call steps were framed like cards inside the modal

- Severity: Low
- Description: Each Start Call modal step wrapped its content in an additional bordered, padded panel inside the dialog.
- Root cause: The step content retained an earlier card-inside-modal pattern even though the dialog already provides the visual boundary, stepper, scroll region, and footer actions.
- Recommended improvement: Keep the Start Call flow visually light and space-efficient, especially on mobile, by using the modal surface itself as the frame and reserving borders for actual alerts or controls.
- Fix applied: Removed the nested bordered wrappers from the Account, Opportunity, Call setup, and Seller Research steps. The OpenAI-key-required alert remains framed because it is a blocking issue.
- Before impact: The modal felt more cramped and visually heavy, with stacked borders competing with the actual form fields.
- After impact: Start Call reads as one clean setup flow with more breathing room and less nested-box noise.
- Verification: Added production-contract coverage requiring unframed step content and rejecting the old bordered step wrapper.

### Live capture rail used alert-style boxes for ordinary states

- Severity: Low
- Description: The call cockpit right rail used bordered boxes for ordinary waiting states, successful preflight messages, notes, evidence, and empty transcript guidance.
- Root cause: Live capture UI kept older boxed utility styling after the app moved toward muted, unframed surfaces for normal information and reserved borders for errors or interactive controls.
- Recommended improvement: Keep the cockpit calm during calls by making routine capture information quiet, while preserving strong treatment for actual audio/capture errors.
- Fix applied: Removed decorative borders from non-error capture status, successful preflight status, note rows, evidence rows, and live-capture empty states. Destructive capture/preflight errors remain bordered and announced as alerts.
- Before impact: The highest-pressure product surface had too many repeated boxes, which made normal call activity feel like something needed attention.
- After impact: The live rail now reads calmer during normal recording while still making real capture failures obvious.
- Verification: Added production-contract coverage requiring unframed routine live-capture surfaces and preserving bordered destructive preflight errors.

### Record save feedback looked like warning panels

- Severity: Low
- Description: Routine save and enrichment messages on account, opportunity, and methodology record pages used the same bordered panel treatment as errors.
- Root cause: Record pages repeated an older inline status block where the base style always included a border, even when the message was a calm saved/saving status.
- Recommended improvement: Keep destructive/error feedback strongly framed, but make successful and in-progress record feedback feel like quiet status notes.
- Fix applied: Added a shared `RecordStatusMessage` helper and routed account save, account enrichment save/run, opportunity save, and methodology save feedback through it. Non-error statuses now use a muted unframed surface; errors keep a destructive border and assertive announcement.
- Before impact: Routine “saved” feedback could visually compete with the form and feel more like a warning than confirmation.
- After impact: Record pages keep feedback visible and accessible without adding unnecessary visual weight.
- Verification: Added production-contract coverage requiring the shared helper and rejecting bordered non-error record feedback.

### Record navigation could still inherit lower scroll positions

- Severity: Medium
- Description: Clicking between accounts, opportunities, calls, playbooks, and other record-style destinations could still sometimes leave the seller lower down the destination page.
- Root cause: The scroll reset was tied to route changes and record IDs, but the visible page did not expose a single navigation identity and the browser could still apply scroll anchoring while skeletons and record content swapped.
- Recommended improvement: Make the visible workspace destination explicit, reset from that key, and prevent browser scroll anchoring from preserving stale vertical positions during record/page swaps.
- Fix applied: Added an `activeNavigationKey` covering workspace, view, account, opportunity, and focused call; attached it to the main app scroll surface; keyed the post-render scroll reset from that identity; and disabled scroll anchoring for top-level app content.
- Before impact: Navigation could feel random when moving from a scrolled detail page into a different record, especially after late-rendering content settled.
- After impact: Record and page navigation now consistently lands at the top of the main panel while preserving intentional scroll inside components during normal use.
- Verification: Added production-contract coverage for the navigation key, main scroll-root wiring, and scroll-anchoring guard.

### Settings panels used decorative nested borders

- Severity: Low
- Description: The OpenAI key and capture settings screens used redundant section brows plus bordered status, feature, and toggle panels inside cards.
- Root cause: Settings retained older framed helper-panel styling after the app moved toward quieter muted surfaces for informational content.
- Recommended improvement: Keep alerts and destructive confirmation states visually distinct, but remove decorative borders from normal setup/status surfaces.
- Fix applied: Removed the `AI provider` and `Product setup` brows, softened the OpenAI key status panel, unframed saved-key metadata, unframed AI feature tiles, and unframed capture preference rows.
- Before impact: Settings felt more visually busy than primary workspace pages and made routine setup look heavier than it needed to.
- After impact: Settings now reads as a calmer utility area with clear actions and less nested-box noise.
- Verification: Added production-contract coverage rejecting the old bordered settings panels and redundant brows.

### Workspace state guidance was double-framed

- Severity: Low
- Description: Empty, recovery, and permission workspace states showed a bordered context panel containing three bordered context tiles.
- Root cause: The workspace state screen retained an older nested-card treatment after the rest of the app moved toward unframed informational surfaces.
- Recommended improvement: Keep the helpful context labels, but remove decorative nested borders so the primary message and action are easier to scan.
- Fix applied: Removed the outer bordered context panel, softened the loading skeleton panel, and changed shared context tiles to quiet muted surfaces without decorative borders.
- Before impact: First-run or recovery screens looked busier than they needed to, especially for an empty workspace where the next action should feel obvious.
- After impact: Workspace state screens now keep the same guidance with less visual weight and a calmer path to create/import data or recover.
- Verification: Added production-contract coverage rejecting the old double-framed workspace state classes and requiring the unframed context layout.

### Live coach detail tabs had raw zero states

- Severity: Low
- Description: The live coach detail tabs could show a raw bordered message for empty intent clusters or parked intents, and the Coach read tab could appear blank when guidance did not include flow or candidate-score details yet.
- Root cause: The secondary AI detail cards were still using older inline status panels instead of the shared calm empty-state pattern used across primary list and record surfaces.
- Recommended improvement: Keep the live moment calm and make every detail tab explain what is happening, even when there is no detail to show yet.
- Fix applied: Replaced raw empty panels with `ListEmptyState` in Gaps, Parked, and Coach read, removed the decorative border from intent-cluster rows, and added a Coach read zero state.
- Before impact: Sellers could open a detail tab and see an empty or visually heavy panel, which made the live coach feel less deliberate.
- After impact: The live coach detail tabs now explain the current state with the same icon-led, human empty-state language used elsewhere in the app.
- Verification: Added production-contract coverage for the three live coach detail zero states and the unframed intent-cluster rows.

### Route navigation needed a post-transition scroll settle

- Severity: Medium
- Description: Clicking between pages, accounts, opportunities, calls, and other route-style records could still occasionally land below the top of the destination page.
- Root cause: The shared scroll reset handled the immediate click and early paint passes, but a destination could still finish replacing the page-transition skeleton after those early resets.
- Recommended improvement: Treat navigation as complete only after the transition window has settled, then reset the main pane and nested scroll containers again.
- Fix applied: Added post-transition scroll reset passes after the page-load skeleton timing, while keeping the existing immediate, animation-frame, and nested-scroll resets.
- Before impact: Sellers could feel like the app opened the next account or opportunity at a random lower position.
- After impact: Route-style navigation has a final settle pass so destination pages land at the top even when content mounts after the transition state.
- Verification: Added production-contract coverage requiring post-transition scroll reset passes.

### Account page opportunity empty states used raw panel copy

- Severity: Low
- Description: The account Opportunities tab and Intelligence recommended-focus panel used raw bordered messages for filtered-empty, no-opportunity, and no-focus states.
- Root cause: The account record view still had older inline empty copy while the broader app had moved to icon-led shared empty states and quieter unframed panels.
- Recommended improvement: Use the same calm empty-state system inside record pages so sellers understand whether a view is filtered, genuinely empty, or waiting for opportunity data.
- Fix applied: Replaced the account opportunities filtered-empty and no-opportunity messages with `ListEmptyState`, replaced the recommended-focus zero state with `ListEmptyState`, and removed decorative borders from populated recommended-focus rows.
- Before impact: Account pages could feel less polished than the main Opportunities and Calls pages, especially for early or filtered accounts.
- After impact: Account-level empty states now explain the situation and next step in the same visual language as the rest of SalesFrame.
- Verification: Added production-contract coverage for all three account empty states and the unframed recommended-focus rows.

### Dashboard coverage card could render blank with no opportunities

- Severity: Low
- Description: The Seller dashboard's `Coverage by opportunity` card rendered an empty content area when the selected workspace had accounts but no opportunities.
- Root cause: The card assumed `coverageOpportunities` would contain at least one item and did not provide a zero state for early-workspace usage.
- Recommended improvement: Every dashboard section should explain what is missing and the next useful action, especially in first-run or low-data workspaces.
- Fix applied: Added a shared `ListEmptyState` to the coverage card with a chart icon and guidance to create an opportunity or start a call when there is a deal to qualify.
- Before impact: A seller could see a titled dashboard card with no content and no clue whether it was loading, broken, or simply empty.
- After impact: The dashboard now remains informative and calm even before opportunity coverage exists.
- Verification: Added production-contract coverage requiring the dashboard coverage zero state and preserving the populated coverage bars.

### Dashboard opportunity focus rows were less interactive than other lists

- Severity: Low
- Description: The Seller dashboard's Opportunity focus table showed opportunity records, but opening an item relied on the small `Open` action instead of the whole row. A filtered-empty state also used a raw table message.
- Root cause: The dashboard retained an older table interaction pattern while the account, opportunity, and call lists had moved to full-row record navigation with shared empty states.
- Recommended improvement: Keep dashboard scanning dense, but make opportunity rows behave like the rest of the app: full-row click/tap, keyboard Enter/Space support, isolated action controls, and a calm empty state when filters miss.
- Fix applied: Made dashboard Opportunity focus rows openable, added keyboard support and propagation guards for the Open action, and replaced the raw filtered-empty table row with `ListEmptyState`.
- Before impact: Sellers could miss the intended interaction or feel the dashboard was less polished than the workspace lists.
- After impact: Dashboard opportunity references now behave consistently with the rest of SalesFrame, reducing click-target hunting and keeping filtered-empty recovery calm.
- Verification: Added production-contract coverage for dashboard row navigation, keyboard handling, action isolation, and the shared filtered-empty state.

### CSV import modal used too many nested boxes

- Severity: Low
- Description: The CSV import flow still framed upload, validation, issue, and summary status areas with borders inside the modal.
- Root cause: The importer was built as a dense utility flow before the app-wide calm design language settled on unframed status surfaces and borders only for real tables, inputs, and alerts.
- Recommended improvement: Keep structure where the user maps or reviews tabular data, but remove decorative borders from explanatory/status surfaces so the modal feels lighter and consistent with the rest of SalesFrame.
- Fix applied: Removed decorative borders from the upload intro panel, no-issue validation state, row issue previews, and summary tiles. Mapping and review tables remain structured because they are interactive data tools.
- Before impact: The import modal felt busier and more boxed-in than the app’s current modal language.
- After impact: CSV import keeps the same workflow but reads calmer, with the user’s attention going to file choice, column mapping, validation, and final import decisions.
- Verification: Added production-contract coverage to keep upload, validation, issue, and summary surfaces unframed while preserving the existing import flow controls.

### Opportunity and call list rows only opened from small targets

- Severity: Low
- Description: The global Opportunities and Calls list rows showed full-row data cards, but opening a record depended on the opportunity title or Actions menu instead of the whole row.
- Root cause: The list layouts had evolved into aligned app rows, but the interaction model still used isolated button targets from the earlier card-style design.
- Recommended improvement: Treat primary list rows as openable records with clear hover feedback, keyboard Enter/Space support, and isolated Actions menus for secondary commands.
- Fix applied: Made Opportunities and Calls rows fully openable, added accessible row labels and keyboard support, and stopped the Actions menu from triggering row navigation.
- Before impact: Sellers had to hunt for the exact clickable text or menu, which made the dense lists feel less polished than the account opportunity table.
- After impact: The primary list surfaces behave consistently: click/tap the row to open, use Actions for Open/Delete, and navigate by keyboard when needed.
- Verification: Added production-contract coverage requiring row-level open behavior, keyboard handling, and propagation guards on the Actions menus for both list surfaces.

### Page and record navigation could keep a stale scroll position

- Severity: Medium
- Description: Clicking into another page, account, opportunity, call, or breadcrumb could sometimes land the seller part-way down the destination view instead of at the top.
- Root cause: The shared navigation reset ran on view and record changes, but some content appears after the page-transition skeleton resolves and focused navigation controls can also pull the browser back toward the clicked element.
- Recommended improvement: Treat route-style navigation as a full context change: blur the clicked navigation control, reset the main pane and nested scroll containers immediately, and repeat once after delayed content has mounted.
- Fix applied: Hardened the shared scroll reset with a later deferred pass, blurred non-form navigation focus before page/item navigation, and reran the reset after page-transition loading clears. Direct Start Call and workspace-switch transitions now use the same behavior.
- Before impact: The app could feel like it had “remembered” the wrong position, which is disorienting when moving between dense account and opportunity pages.
- After impact: Record and page navigation now consistently starts from the top of the destination surface while preserving normal in-page form focus behavior.
- Verification: Extended production-contract coverage for the delayed reset, focus blur, page-transition reset, and direct Start Call/workspace navigation paths.

### Workspace search miss used blunt database copy

- Severity: Low
- Description: The global workspace search popover showed a plain `No matching accounts, opportunities, calls, or playbooks.` line when a query missed.
- Root cause: The search popover kept an older raw empty message instead of the newer human empty-state voice used elsewhere in the app.
- Recommended improvement: Keep search misses compact, but still use the same calm product language: say what happened and give the seller a useful next search.
- Fix applied: Replaced the raw empty line with a compact icon-led search miss state: `Nothing matches that search` plus guidance to try an account, opportunity, call, or playbook name.
- Before impact: A missed search felt more like a database lookup than a polished app interaction.
- After impact: The workspace search miss state is calmer, clearer, and visually consistent with the app’s empty-state language.
- Verification: Added production-contract coverage requiring the new workspace-search miss copy and rejecting the old raw `No matching...` line.

### Playbooks search empty state used a one-off box

- Severity: Low
- Description: The Playbooks page showed a raw bordered message when search or filters returned no results, while Opportunities and Calls used the shared calm empty-state component.
- Root cause: The Playbooks catalogue kept an older inline empty state instead of using the list-empty pattern introduced for other workspace lists.
- Recommended improvement: Use the same compact empty-state treatment for every primary list so empty and filtered states feel intentionally designed.
- Fix applied: Replaced the one-off Playbooks empty box with `ListEmptyState`, using the playbook icon, `Nothing matches that view`, and a clear recovery suggestion to broaden the search or reset the use-case filter.
- Before impact: The Playbooks page could feel visually less finished than the other list pages when a search missed.
- After impact: Playbooks, Opportunities, and Calls now share the same calm empty-state rhythm.
- Verification: Added production-contract coverage requiring the shared Playbooks empty state and rejecting the old raw `No playbooks match this search and filter.` copy.

### Playbook guidance exposed provider language

- Severity: Low
- Description: Playbook reference pages described realtime guidance with phrases such as `OpenAI prioritizes...` and `OpenAI uses...`.
- Root cause: The static playbook catalogue mixed implementation/provider language into customer-facing methodology copy.
- Recommended improvement: Keep provider details in Settings, AI configuration, and technical docs. Reference pages should describe what SalesFrame does for the seller.
- Fix applied: Reworded every playbook `liveGuidance` line to use SalesFrame as the actor while preserving the actual methodology behavior.
- Before impact: The playbook pages could feel like a technical wrapper rather than a polished product experience.
- After impact: Playbook reference content now reads as native SalesFrame product language and stays consistent with the homepage/app voice.
- Verification: Added production-contract coverage requiring SalesFrame-voiced playbook guidance and rejecting `liveGuidance: "OpenAI...` in the reference catalogue.

### Pre-call prep still used static guidance

- Severity: Medium
- Description: The call prep brief used a shared static checklist and a hard-coded recommended opening instead of the active opportunity's saved context.
- Root cause: The prep modal predated the AI-first live coach flow, so it kept generic discovery copy after the rest of the call cockpit moved to account, opportunity, playbook, and evidence-aware guidance.
- Recommended improvement: Keep pre-call prep compact, but make every line either come from seller-entered opportunity fields, methodology coverage, or the saved next-call brief. Do not show static question scripts before the AI readiness step.
- Fix applied: Replaced the static prep checklist with opportunity-aware prep items for known pain, decision path, next step, and selected playbook evidence debt. The opening section now uses the saved next-call brief opening when one exists, otherwise it explains that SalesFrame will generate the opener from account context, opportunity record, call type, selected playbooks, and previous evidence before recording begins.
- Before impact: Sellers could see a generic opening question that might not fit the account, opportunity stage, prior calls, or selected playbooks.
- After impact: The prep brief is calmer, more trustworthy, and no longer competes with the live AI question engine.
- Verification: Added production-contract coverage rejecting `prepChecklist`, the old hard-coded opening, and requiring opportunity draft plus next-call brief context in the prep dialog.

### Minimum-item controls looked like dead actions

- Severity: Low
- Description: The methodology playbook selector and custom framework editor used disabled controls to enforce minimum selections or minimum required fields.
- Root cause: The data rules were correct, but the UI expressed them as inactive controls instead of explaining the rule or removing unavailable actions.
- Recommended improvement: Keep minimum-item constraints visible in copy, avoid greyed-out controls that look clickable-but-broken, and only show destructive remove actions when they can act.
- Fix applied: Methodology playbook buttons now behave like accessible pressed toggles with explicit helper text explaining that at least one playbook is required. Custom framework field and criterion remove actions are hidden when only one item remains, with the one-item rule included in the section descriptions.
- Before impact: Sellers could see a selected playbook or remove action disabled with no clear reason, which made methodology setup feel slightly brittle.
- After impact: The setup screens explain the constraint directly and avoid presenting inert remove controls.
- Verification: Added production-contract coverage for the methodology helper text, toggle semantics, and conditional custom framework remove actions.

### List pages showed reset actions before filters were active

- Severity: Low
- Description: Dashboard focus, Opportunities, Calls, and Playbooks showed a `Reset` action even when the seller had not searched, filtered, or changed sorting.
- Root cause: The filter bars were laid out with a permanently visible recovery action instead of making the action conditional on changed filter state.
- Recommended improvement: Keep filter recovery actions contextual. The page should stay quiet until there is something meaningful to clear.
- Fix applied: Added active-filter checks to the dashboard focus list, global Opportunities list, Calls library, and Playbooks catalogue so `Reset` appears only after search/filter/sort state changes.
- Before impact: Sellers could click a visible reset control and see nothing happen, adding a small but real sense of dead UI.
- After impact: List surfaces are calmer by default, and the reset action appears exactly when it can help.
- Verification: Added production-contract coverage for contextual reset actions across dashboard focus, Opportunities, Calls, and Playbooks.

### Create Account stepper could squeeze on mobile

- Severity: Low
- Description: The Create Account modal used a four-column stepper at every viewport size, unlike the Start Call modal which already used a two-column mobile layout.
- Root cause: The account setup stepper was built before the mobile modal pattern was standardized across setup flows.
- Recommended improvement: Keep multi-step modals mobile-first: two columns for labeled steps on small screens, four columns once there is room, and min-width guards so labels truncate instead of pushing the modal sideways.
- Fix applied: Updated the Create Account stepper to `grid-cols-2 sm:grid-cols-4` with `min-w-0` guards and tightened step-item padding on mobile. Added the same overflow guard to the workspace setup progress strip.
- Before impact: On narrow screens, four labeled step items could feel cramped and risk the same modal-edge pressure previously seen in the Start Call flow.
- After impact: Create Account now follows the same calm mobile pattern as Start Call, with larger tap-friendly modal controls and stable step labels.
- Verification: Added production-contract coverage for the mobile-safe Create Account stepper and the overflow-safe workspace setup progress strip.

### Opportunity record card repeated breadcrumb context

- Severity: Low
- Description: The opportunity record card showed the account name as a small description above `Opportunity record`, even though the breadcrumb already shows the account and opportunity path.
- Root cause: The record card retained an older contextual brow pattern after the broader page-heading cleanup removed redundant brows elsewhere.
- Recommended improvement: Let breadcrumbs carry navigation context and let record cards lead with the actual task title.
- Fix applied: Removed the redundant account-name description from the opportunity record card and added production-contract coverage to keep the record card title-first.
- Before impact: The record tab had one extra line of repeated context, making the dense opportunity form feel busier than it needed to.
- After impact: The opportunity record starts directly with the editable record title, while account context remains visible in the breadcrumb and linked account record panel.
- Verification: Added contract coverage rejecting the account-name card description and guarding record field tiles against duplicated value rendering.

### Command bar showed a disabled Start call fallback

- Severity: Low
- Description: The active-call command bar could render a disabled red `Start call` control when no valid start-call action was available.
- Root cause: The command bar used a disabled destructive button as a fallback instead of simply omitting the unavailable action.
- Recommended improvement: Do not show controls that cannot do anything. In the live-call area, every visible control should either act immediately or clearly report status.
- Fix applied: Removed the disabled fallback and rendered nothing unless a real start-call action exists; added production-contract coverage rejecting the dead-action pattern.
- Before impact: Sellers could see a prominent red button that looked important but was intentionally inert, which undermines confidence in the cockpit.
- After impact: The command bar only shows `Stop call` while recording or a real `Start call` action when one is available.
- Verification: Added a contract assertion requiring the null branch and rejecting disabled destructive `Start call` fallbacks.

### Post-call brief action looked clickable before a brief existed

- Severity: Low
- Description: The post-call panel always rendered `View next-call brief` as a disabled button when the opportunity did not yet have a next-call brief.
- Root cause: The panel treated a missing brief as a disabled action instead of a simple absence of the action.
- Recommended improvement: Only show an action when it can do something. Let the existing next-call plan empty text explain what is still being prepared.
- Fix applied: Rendered the `View next-call brief` action only when `opportunity.nextCallBrief` exists and added a production-contract guard against the disabled dead-action pattern.
- Before impact: Sellers could see a real-looking button that could not be clicked, adding unnecessary friction in a post-call moment.
- After impact: The post-call panel stays calmer: it shows the plan state, and only shows the brief action when there is a brief to open.
- Verification: Added production-contract coverage requiring conditional rendering and rejecting `disabled={!opportunity.nextCallBrief}`.

### Runtime recovery copy still used backend-shaped failure language

- Severity: Low
- Description: Several visible fallback messages in record mutations, post-call replay, speaker editing, workspace setup, profile settings, OpenAI key settings, import functions, live AI functions, and low-level connection helpers still used `could not` phrasing.
- Root cause: These handlers and functions lived across different feature areas and were not all covered by the earlier copy passes.
- Recommended improvement: Keep the same recovery semantics, but make every seller-facing fallback state sound like a bounded next attempt instead of a backend failure.
- Fix applied: Reworded runtime and function fallbacks to `needs another ... attempt/pass/check/refresh` or `needs review` language, removed visible `could not` copy from app UI sources, and updated shared connection/transcription/recording helper messages.
- Before impact: A routine save, replay, profile, settings, or speaker-label interruption could sound like the app had broken.
- After impact: These states now tell the seller what needs another attempt while preserving local status surfaces and diagnostic logging.
- Verification: Expanded production-contract coverage to require the calmer messages and reject `could not` copy in app UI, browser Supabase client, replay URL helper, realtime transcription helper, import functions, and live AI function fallbacks.

### Auth recovery copy sounded like hard failure

- Severity: Low
- Description: Session restore, sign-in, sign-up, password reset, sign-out, and account creation fallbacks used blunt `could not` language.
- Root cause: Auth and account-creation handlers had older fallback copy that predated the calmer recovery language used elsewhere in the app.
- Recommended improvement: Keep validation messages direct, but phrase recoverable service/auth issues as contained retry moments.
- Fix applied: Reworded fallback messages to `SalesFrame needs a fresh sign-in to continue.`, `Sign-in needs another try.`, `Account setup needs another try.`, `Password reset needs another try.`, and `Sign-out needs another try.`.
- Before impact: Routine auth or setup interruptions could feel like hard product failures.
- After impact: The same states now keep the seller oriented and confident that the next action is simply to try again or refresh their sign-in.
- Verification: Expanded the auth production contract to require the calmer recovery copy and reject the old `could not` messages.

### Record navigation could preserve the previous scroll depth

- Severity: Medium
- Description: Moving between pages, accounts, opportunities, calls, nested record tabs, or scrollable page panels could occasionally leave the seller near the previous page's lower scroll position instead of starting at the top of the new view.
- Root cause: The reset targeted the main app scroll container and browser viewport, but nested scrollable regions such as transcript, import, review, and table panels could preserve their own stale scroll positions.
- Recommended improvement: Treat every page, record, workspace, call, and tab change as a fresh reading position and reset both the app pane and any nested page scroll containers before and after the new content mounts.
- Fix applied: Hardened the shared scroll reset to clear the main pane, nested scrollable descendants, window, document, and body scroll positions immediately, on the next animation frames, and after content settles; also called the reset on direct Start Call and workspace-change route changes.
- Before impact: Sellers could click into a new account or opportunity and feel like the page opened in the wrong place.
- After impact: Navigation starts at the top consistently without changing the calm layout or adding motion.
- Verification: Expanded the production contract to require viewport, pane, and nested scroll resets, layout-effect navigation handling, direct Start Call/workspace reset calls, and tab-level reset wiring.

### Hidden question queue route survived the calm cockpit model

- Severity: Medium
- Description: The app still carried a hidden `questions` route and standalone question queue page even though the current live-calling model is one calm recommendation card with inline feedback controls.
- Root cause: The question queue predated the current cockpit flow and was left behind in breadcrumb, call-surface, and manual-coach code after the product direction changed.
- Recommended improvement: Keep live question control in the cockpit, and use parked/recovery intent state behind detail tabs instead of exposing a separate queue page.
- Fix applied: Removed the `questions` route label, breadcrumb surface, `QuestionQueuePage`, stale `Move later` handler, obsolete `move_later` AI feedback action, and unused alternative-question helper, then updated the product spec and production contracts.
- Follow-up fix: Removed stale product-spec references to `Alternatives`, `Queue`, `Use This Next`, and `Move Later` as visible cockpit controls so the documented control model matches the compact live UI.
- Before impact: A stale active view or future route hook could expose an out-of-flow question queue and dilute the one-question live coaching experience.
- After impact: The cockpit remains the single live question control surface; feedback actions now park, skip, soften, or mark the current recommendation without leaving the page.
- Verification: Added production-contract assertions that reject the hidden queue route, page component, route label, `Move later` handler, obsolete `move_later` feedback action, and unused alternative-question helper.

### Record-save documentation implied autosave

- Severity: Low
- Description: The product build spec said inline account and opportunity fields save with a short debounce, but the actual UI uses explicit Save changes actions so sellers can review edits before committing.
- Root cause: The spec retained an older autosave direction after the account and opportunity pages moved to deliberate save controls.
- Recommended improvement: Keep record-editing expectations explicit: fields can be edited freely, then committed with Save changes.
- Fix applied: Updated the build spec to describe explicit Save changes actions and added production-contract coverage rejecting the old debounce wording.
- Before impact: Future implementation could reintroduce autosave and surprise sellers who expect a deliberate commit step.
- After impact: Documentation, UI, and tests now agree on explicit record saves.
- Verification: Added a production-contract assertion for the explicit Save changes spec language.

### Shared data hook used hard load-failure copy

- Severity: Low
- Description: The shared Supabase query hook still fell back to `SalesFrame could not load this data`, which was harsher than the newer workspace recovery language.
- Root cause: The generic hook copy was separate from the workspace recovery copy pass, so it kept the older failure framing.
- Recommended improvement: Shared fallback copy should use the same calm recovery language as the primary workspace screens.
- Fix applied: Reworded the hook fallback to `SalesFrame needs another moment with this data. Try again in a moment.` and added production-contract coverage.
- Before impact: Any lower-level data surface using the hook could feel like a hard error instead of a recoverable loading issue.
- After impact: Shared data recovery copy now matches the product’s calmer state language.
- Verification: Added a production-contract assertion for the new shared hook message and a guard rejecting the old copy.

### Workspace menu actions used hard failure copy

- Severity: Low
- Description: Workspace edit, duplicate, and delete fallbacks still said the workspace `could not` be saved, duplicated, or deleted.
- Root cause: The workspace menu predated the newer recovery language pass and kept action-specific hard-failure fallbacks.
- Recommended improvement: Keep the action and recovery path clear, but phrase these as contained retry moments.
- Fix applied: Reworded workspace save, duplicate, and delete fallbacks to `Workspace needs another ... attempt.` and added production-contract guards rejecting the old copy.
- Before impact: Routine workspace-management errors could feel more severe than they were, especially inside a compact menu/dialog.
- After impact: The workspace switcher now uses the same calm retry language as the rest of the app.
- Verification: Added production-contract assertions for the new workspace-switcher messages.

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

### Live question refresh waited too long after meaningful turns

- Severity: High
- Description: The live coach had a 30-second AI audit and a fast flow-decision lane, but the full next-question refresh was only forced after two meaningful final transcript turns when the fast lane did not explicitly request a replacement.
- Root cause: The protected contract encoded `turnsSinceLastFullGuidance >= 2`, which could leave the seller looking at a stale question after a buyer answered once, especially if the fast flow reader conservatively returned hold.
- Recommended improvement: Treat every meaningful final turn as enough evidence to ask the full AI coach whether the current question should hold, replace, park, or recover, while still letting the model keep a good question stable.
- Fix applied: Added `LIVE_COACH_FORCE_REFRESH_TURNS = 1`, changed the full-guidance trigger to use that threshold, updated the live-call eval contracts, and clarified in the build spec that the 30-second audit is backup rather than the normal update path.
- Before impact: A seller could experience an awkward pause waiting for the second question because the first buyer answer did not always force the polished question lane.
- After impact: SalesFrame now asks OpenAI to reassess the visible question after every meaningful final turn, while the existing stability/lifecycle rules prevent unnecessary churn.
- Verification: Reran TypeScript and the live guidance/eval production contracts after the change.

## 2026-07-05

### Live cockpit timer routed to a hidden recordings view

- Severity: Low
- Description: The opportunity command bar showed the elapsed call timer as an outline button that navigated to the workspace `recordings` library view.
- Root cause: The timer reused an earlier action-button pattern from before the Calls library was simplified, so a status readout still behaved like page navigation.
- Recommended improvement: Keep the live command bar focused on live-call actions. Elapsed time should be visible as status, not as a route into a secondary library page.
- Fix applied: Replaced the timer button with a non-interactive status element carrying an accessible elapsed-time label, and added contract coverage rejecting the old `onViewChange("recordings")` path.
- Before impact: A seller could click the timer during a call and unexpectedly leave the cockpit context for a hidden recordings view.
- After impact: The timer now quietly reports elapsed time while Start/Stop, Prep brief, and call type remain the only interactive controls in that row.
- Verification: Added production-contract coverage for the non-interactive elapsed-time status and removed recordings navigation from the command bar.

### Calls library still carried hidden Recordings and Transcripts pages

- Severity: Medium
- Description: The simplified Calls section still had route, breadcrumb, mobile-action, label, and component branches for global `Recordings` and `Transcripts` views.
- Root cause: Earlier call-library subpages remained in routing/data code after the product direction moved replay and transcript review into selected call, post-call, and opportunity-history surfaces.
- Recommended improvement: Keep the global Calls page as the single library entry point. Let users open a call to review its recording, transcript, notes, and post-call outputs.
- Fix applied: Removed the hidden `recordings` and `transcripts` library branches from breadcrumbs, mobile Start Call surfaces, call view routing, navigation labels, section card content, and CallsView rendering.
- Before impact: A stale active view or future UI hook could surface alternate Calls pages with subtly different layout and filtering, making navigation feel less intentional.
- After impact: Calls now has one consistent workspace-level page, while recordings and transcripts remain available in the relevant selected-call context.
- Verification: Added production-contract coverage requiring `callViews` and `breadcrumbLibraryViews` to contain only `calls`, rejecting hidden Recordings/Transcripts labels and CallsView active-view branching.

### Opportunities still carried hidden Stakeholders and Risks pages

- Severity: Medium
- Description: The global Opportunities section still had hidden `Stakeholders` and `Risks` route branches, labels, and secondary panels even though the sidebar and product flow now treat those as opportunity-level context.
- Root cause: Earlier opportunity subpages remained in the route arrays and list component after stakeholder/risk information moved into opportunity record, methodology, intelligence, and live/post-call surfaces.
- Recommended improvement: Keep the global Opportunities page as one list for finding and opening deals. Show risk and stakeholder evidence inside the selected opportunity where the seller has account and deal context.
- Fix applied: Removed hidden `stakeholders` and `risks` opportunity routes, navigation labels, global risk signal data, and OpportunitiesView active-view branching. Updated the product spec to describe Opportunity History as previous call recordings.
- Before impact: A stale active view or future sidebar hook could expose duplicate opportunity pages with weaker context and a busier mental model.
- After impact: Opportunities now has one consistent global page, while stakeholder and risk context stays attached to the opportunity where it belongs.
- Verification: Added production-contract coverage requiring `opportunityViews` to contain only `opportunities`, rejecting hidden stakeholder/risk route labels and OpportunitiesView active-view branches.

### Live coach refresh errors sounded like AI failure

- Severity: Medium
- Description: During an active call, a temporary live-guidance refresh issue could show wording such as `could not shape the next question` or `could not refresh the next question`.
- Root cause: The error copy described the backend request outcome instead of the seller's safest next action while SalesFrame kept the last valid recommendation visible.
- Recommended improvement: Keep the live card calm under transient AI latency or provider errors: tell the seller to keep the current question for now and explain that SalesFrame is checking whether the flow moved.
- Fix applied: Reworded the no-guidance and existing-guidance error paths, and added production-contract assertions that reject the old failure-style copy.
- Before impact: A seller could lose confidence mid-call because the guidance card read like the AI had broken.
- After impact: Temporary refresh issues now preserve seller momentum and keep the last usable question in focus while the app catches up.
- Verification: Added runtime copy guards in the production contract and reran the targeted suite.

### Shared AI/service errors still used implementation-shaped wording

- Severity: Medium
- Description: Shared browser and Netlify error fallbacks still used phrases such as `finish the AI step`, `finish that request`, and provider-centric copy like `OpenAI could not use the selected model`.
- Root cause: The shared error layer was written to be technically safe and sanitized, but some fallback language still described the internal operation rather than the seller's next step.
- Recommended improvement: Keep technical sanitization and trace IDs, but make fallback messages calm, short, and action-oriented.
- Fix applied: Reworded shared service, AI, quota, invalid-key, timeout, selected-model, Start Call first-question, non-JSON function fallback, and missing context copy. Added contract guards for the calmer copy and old-phrase rejection.
- Before impact: A customer could see safe but cold messages during high-trust workflows like Start Call, enrichment, or replay recovery.
- After impact: The app now tells sellers what to do next without exposing backend language or making transient platform issues feel like product failure.
- Verification: Updated app and function contracts and reran the relevant suites.

### Start Call background research copy used the old feature name

- Severity: Low
- Description: Two suppressed Start Call/account setup research paths still threw `Customer research could not be prepared` even though the visible setup step is now `Seller Research`.
- Root cause: The feature label was updated in the modal, but background error strings were left behind in asynchronous research handling.
- Recommended improvement: Keep Start Call copy neutral or aligned to `Seller Research`; reserve `Customer Research` for account enrichment/customer intelligence surfaces.
- Fix applied: Reworded the background errors to `Research context could not be prepared`, updated the design-language guide, and added a production-contract guard rejecting the old Start Call copy.
- Before impact: Even if mostly hidden, stale strings made the codebase and any future surfaced message inconsistent with the product language.
- After impact: Start Call research copy now stays aligned with the Seller Research step and the customer-account enrichment distinction.
- Verification: Added the regression guard to the existing Seller Research contract.

### Live-guidance context contract was too easy to drift

- Severity: Medium
- Description: The product requires all visible seller-editable account and opportunity fields to shape live guidance, but the test only checked a fixed list of field names. A future field could be added to the UI without the live-question engine receiving it.
- Root cause: The contract asserted today's fields individually instead of deriving the editable field list from the shared `AccountDraft` and `OpportunityDraft` types.
- Recommended improvement: Make the test fail whenever a new seller-editable draft field appears without an explicit live-guidance context mapping.
- Fix applied: Added a dynamic production-contract guard that extracts the draft field keys, verifies the mapping to `recordContext` or selected playbooks, and fails with a direct message if a new field is not wired into live guidance. Removed `Owner` from editable-field docs because ownership is workspace/user context, not a visible seller-editable record field.
- Before impact: Question quality could quietly degrade after future UI additions because the AI would not know about a newly added field.
- After impact: Future editable account/opportunity field changes must deliberately update the live-guidance context contract, keeping the question engine aligned with the seller-visible record.
- Verification: Added the contract guard and reran the app production contract.

### Starter opportunities exposed placeholder AI guidance copy

- Severity: Medium
- Description: New opportunities without a generated live recommendation could show `AI guidance pending` and a technical OpenAI sentence in dashboard, account, and opportunity intelligence surfaces.
- Root cause: `createStarterOpportunity` used internal fallback text for `nextQuestion` and `questionReason`, and list/detail components rendered those fields directly even when they represented a starter state rather than real AI guidance.
- Recommended improvement: Treat missing guidance as a deliberate empty state: tell the seller to start a call, and only label content as `Next best question` when a real recommendation exists.
- Fix applied: Added shared starter-guidance constants and `hasStarterOpportunityGuidance`, replaced direct opportunity guidance rendering with `getOpportunityGuidancePreview`, changed the opportunity intelligence heading to `Live question` for starter records, removed starter notes, and kept starter guidance out of workspace fuzzy search.
- Before impact: A first-time seller could see internal placeholder language and wonder whether the AI question engine was broken.
- After impact: Fresh opportunities now stay calm and intentional until the first live question is generated, while real AI-generated questions still appear normally.
- Verification: Added a production-contract regression test for starter guidance rendering and search behavior.

### Dialog dismissal protection depended on every modal remembering the same handlers

- Severity: Medium
- Description: Existing modals mostly prevented accidental Escape/outside-click dismissal, but the safety depended on each modal manually adding the same three Radix handlers.
- Root cause: The shared `DialogContent` primitive allowed Radix's default dismiss-on-outside behavior unless every new modal remembered to override it.
- Recommended improvement: Make deliberate dismissal the design-system default, with an explicit opt-in only for future lightweight dialogs that should be dismissible.
- Fix applied: Added a `dismissible` prop to `DialogContent`, defaulting to `false`, and composed Escape, interact-outside, and pointer-down-outside handlers so accidental close is prevented at the primitive level while caller handlers still run.
- Before impact: A future modal could regress into the clunky accidental-close behavior the app has already been trying to avoid.
- After impact: New modals inherit the same calm close model by default: use the footer Cancel/Back/Done actions rather than disappearing when a seller taps the wrong area.
- Verification: Added production-contract assertions for the shared dialog primitive.

### Fast live-state AI context used implementation-shaped inputs

- Severity: Medium
- Description: The fast live-state function authorized the account, opportunity, and call correctly, but then sent minimal raw authorization rows to OpenAI instead of a focused business context. That left the fast lane with database-shaped IDs rather than the seller-visible fields that help decide whether the question should hold, refresh, park, or recover.
- Root cause: The full live-guidance function had a normalized record-context contract, but the newer fast flow-decision function did not get the same context-shaping treatment.
- Recommended improvement: Build a compact `liveStateContext` server-side after authorization, using seller-visible account, opportunity, and call fields only. Exclude workspace IDs, owner IDs, storage paths, raw database rows, and other implementation internals from the model input.
- Fix applied: Added a sanitized live-state context builder, loaded the required visible fields after authorization, sent `liveStateContext` to OpenAI, updated the prompt to use it only for flow/timing relevance, and added production/security contract guards.
- Before impact: The fast lane had less useful context for live flow decisions and sent implementation-shaped data into a prompt that should stay product-shaped and private by default.
- After impact: The fast lane now receives the account/opportunity/call facts it needs to read conversation flow while keeping model input cleaner, calmer, and less coupled to the database schema.
- Verification: Added contract tests for the sanitized live-state context and raw-row exclusion.

### CSV import modal still used a bespoke action footer

- Severity: Low
- Description: The CSV import modal had been visually improved, but its footer layout was still hand-built instead of using the shared modal action component. That kept one of the app's most complex modals on a separate path from workspace setup and made future button-spacing drift more likely.
- Root cause: `DialogActions` was introduced during onboarding polish, but the import modal continued to carry its own Cancel, Back, Next, Import, and Done footer structure.
- Recommended improvement: Route import actions through the shared modal footer helper while preserving the right-side primary action and the summary-step Done placement.
- Fix applied: Extended `DialogActions` with an optional `cancelAction`, migrated `CsvImportDialog` to the shared action footer, and updated contracts so mobile button width and footer spacing are protected by the design system rather than one-off modal code.
- Before impact: Future changes to modal button spacing or mobile touch targets could fix onboarding while leaving CSV import subtly different again.
- After impact: CSV import inherits the same footer rhythm as the rest of the app, reducing one-off modal UX and making future polish cheaper and safer.
- Verification: Updated the import, onboarding, and mobile viewport contracts, then reran the app production contract and TypeScript.

### Record mutation modals used one-off footer actions

- Severity: Low
- Description: Create Account, Edit Account, Create Opportunity, and Edit Opportunity all used visually similar but hand-built modal footers. The modals looked mostly correct, but the implementation kept the app vulnerable to small future differences in button order, spacing, mobile width, and disabled states.
- Root cause: The shared `DialogActions` helper was only applied to onboarding and CSV import, leaving the everyday record-editing workflows on a separate footer pattern.
- Recommended improvement: Move common record mutation dialogs onto the same modal action component while preserving each modal's labels, icons, disabled states, and back/cancel behavior.
- Fix applied: Migrated the four record mutation dialogs to `DialogActions`, using a custom cancel action for Create Account's Back/Cancel button and standard shared cancel/primary actions for the other record dialogs. Added a production-contract guard to keep these dialogs on the shared action footer.
- Before impact: Future modal polish could still reach one workflow but miss another, creating the small UI differences that make the product feel less designed.
- After impact: Core account and opportunity creation/editing now share the same footer system as onboarding and CSV import, making mobile touch targets and action placement more consistent.
- Verification: Added the `record mutation dialogs use the shared modal action footer` contract and reran the app production contract plus TypeScript.

### Secondary modals still had bespoke footer layouts

- Severity: Low
- Description: Call prep, Start Call loading, destructive record deletion, OpenAI key removal, workspace edit, and workspace deletion still used raw modal footers even after the primary creation/edit flows moved to the shared action pattern.
- Root cause: The modal footer standard was being adopted workflow by workflow instead of being enforced as a broader design-system contract.
- Recommended improvement: Route all standard Cancel/primary and Cancel/Back/primary modal actions through the same `DialogActions` helper, and add a contract guard so raw footers stay inside the UI primitive only.
- Fix applied: Extended `DialogActions` with a `leftActions` slot, migrated the remaining standard modals in the app shell and workspace switcher, and updated the production contract to reject direct modal-footer usage in those areas.
- Before impact: Less-traveled modals could still have subtly different spacing, mobile button width, or action placement than the core flows.
- After impact: Standard modal actions now share one rhythm across call prep, start call, deletion, key management, record editing, CSV import, onboarding, and workspace management.
- Verification: Updated the modal dismissal/action contract and prepared the full app verification run.

### High-trust recovery copy still sounded like system failure

- Severity: Low
- Description: A few fallback messages in live capture, account enrichment, seller research, and workspace setup still used cold phrases like `failed`, `could not start`, or `could not be completed`.
- Root cause: Earlier error handling work sanitized technical details, but not every fallback had been rewritten into the calmer SalesFrame voice.
- Recommended improvement: Keep errors honest and actionable, but phrase them around what remains safe, what SalesFrame is doing next, and what the seller can do now.
- Fix applied: Reworded transcript-save, capture-start, call-stop, recording-upload, speaker-review, account-enrichment, seller-domain-research, account-intelligence, and workspace-setup cancellation fallbacks. Added production-contract checks for the calmer strings and old-phrase rejection.
- Before impact: Some high-pressure moments could still read like a backend failure even when the safest action was simply to keep going or retry a contained step.
- After impact: Recovery copy now better protects confidence: transcript keeps listening, accounts remain saved, and draft/workspace cleanup is framed as a retryable follow-up rather than a product break.
- Verification: Added regression coverage in the customer-facing error contract.

### Clickable account opportunity rows were mouse-first

- Severity: Low
- Description: The account Opportunities tab made the full opportunity row clickable for mouse users, but keyboard users only had the smaller opportunity-name button as the equivalent path.
- Root cause: The row-level click target was added for ease of scanning and opening, but the accessibility contract still assumed the inner name button was enough.
- Recommended improvement: If a whole row visually behaves like an open target, it should also be reachable from the keyboard without breaking the table's semantics or interfering with the row action menu.
- Fix applied: Added row focus, a row action label, and Enter/Space handling that only fires when the row itself has focus. Inner controls still stop propagation and keep their own behavior.
- Before impact: Mouse users had a large forgiving target, while keyboard users had a smaller and less discoverable target.
- After impact: Account opportunity rows now offer the same open affordance to keyboard users while preserving the explicit name button and actions dropdown.
- Verification: Updated the account opportunities contract to require keyboard handling and preserve table semantics.

### Keyboard row focus lacked a visible landing point

- Severity: Low
- Description: After adding keyboard access to account opportunity rows, the focused row did not yet have a strong visual focus state.
- Root cause: The row inherited hover styling but did not receive the focus-visible ring treatment used by the rest of the app's interactive controls.
- Recommended improvement: Every keyboard-reachable row-level action should make the current focus target obvious without changing the table layout.
- Fix applied: Added a muted focus background, visible ring, inset ring placement, and outline reset to the account opportunity row.
- Before impact: A keyboard user could open the row, but might lose confidence about which row was currently active.
- After impact: The row now gives a clear, calm focus indication consistent with the rest of SalesFrame's controls.
- Verification: Extended the account opportunities contract to require the row focus-visible classes.

### Dense list pagination ranges were not defensive

- Severity: Low
- Description: Opportunities and Calls currently hide pagination when a filtered result set is empty, but the displayed range calculation assumed at least one result. If a future layout change exposed the footer in an empty state, it could show an impossible range such as `1-0 of 0`.
- Root cause: Pagination copy was calculated inline in the JSX instead of using safe start/end values derived from the visible list length.
- Recommended improvement: Compute defensive range labels for dense lists so empty filtered states stay calm and accurate even if footer visibility changes later.
- Fix applied: Added safe range start/end values to Opportunities and Calls, updated the visible footer copy to use those values, and added contract assertions for both lists.
- Before impact: The app was correct today, but the list footer was brittle and easy to regress during future density/layout polish.
- After impact: Dense list range copy is now safe by construction while preserving the current hidden-footer behavior for small and empty result sets.
- Verification: Added production-contract coverage for the safe range calculations.

### Call-capture recovery copy still carried failure language

- Severity: Low
- Description: A few call-capture paths still used hard failure wording such as transcription `could not connect`, audio recording upload `failed`, or audio preflight `could not verify`.
- Root cause: Earlier copy polish covered the common capture states, but a few edge recovery paths and documentation strings were still written from an implementation perspective.
- Recommended improvement: Keep the state honest, but phrase recoverable capture problems as the next attempt SalesFrame needs rather than a finished failure verdict.
- Fix applied: Reworded audio preflight, partial transcription connection, recording preparation, and upload recovery messages. Updated the production smoke checklist and added contract guards rejecting the older failure phrases.
- Before impact: A seller hitting a rough audio edge could read the message as a broken product rather than a contained recovery step.
- After impact: Capture recovery copy now stays consistent with the calmer app voice: SalesFrame keeps listening where it can, and clearly names the next attempt needed.
- Verification: Added production-contract checks for the new capture copy and old-phrase rejection.

### Start Call docs still described Seller Research as Customer Research

- Severity: Low
- Description: The runtime Start Call wizard consistently uses `Seller Research`, but the product spec and smoke checklist still described the final Start Call step as `Customer Research`.
- Root cause: The UI naming changed after the seller/customer research split, but the source-of-truth docs and launch checklist were not updated in the same pass.
- Recommended improvement: Keep `Seller Research` for the seller's company/product and buyer-contact context inside Start Call. Reserve `Customer Research` for account enrichment and customer intelligence.
- Fix applied: Updated the Start Call workflow spec, live-guidance input description, smoke checklist, and production contract guards to preserve the naming boundary.
- Before impact: Future build work could follow stale docs and accidentally reintroduce `Customer Research` into the Start Call modal.
- After impact: Documentation and UI now agree: Start Call uses Seller Research, while Customer Research belongs to account enrichment.
- Verification: Added production-contract checks for the spec and smoke checklist wording.

### Page title brows added redundant context

- Severity: Low
- Description: Several primary page headers used small brow labels above the real title, such as `Methodologies` above Playbooks, `Playbook` above individual playbook names, and `Account workspace` above an account name.
- Root cause: Earlier page headers copied an editorial eyebrow pattern even though SalesFrame already has breadcrumbs, sidebar navigation, and clear page titles.
- Recommended improvement: Lead with the useful title and reserve small labels for true form grouping or diagnostic detail, not decorative context above main page headings.
- Fix applied: Removed redundant brows from Account, personal Account, Playbooks, individual playbook, custom framework, and workspace state headers. Updated the design-language guide to make title-first empty/page states the default.
- Before impact: Sellers had to scan extra text that repeated what they already knew from navigation or the page title.
- After impact: These surfaces now read calmer and more direct, with the account/playbook name as the first visual signal.
- Verification: Added production-contract coverage rejecting the removed brow labels.

### Motion lacked one calm product standard

- Severity: Low
- Description: SalesFrame had good individual motion pieces, but timing and animation intent were spread across local classes such as generic `duration-100`, `duration-200`, broad `transition-all`, and permanent shimmer-style motion.
- Root cause: Motion was added organically while building workflows, rather than through a shared enterprise SaaS motion language.
- Recommended improvement: Centralize motion tokens and apply them to shared primitives first. Keep frequent interactions under 150ms, dialogs under 300ms, and reserve expressive motion for rare moments.
- Fix applied: Added SalesFrame motion tokens/utilities, tightened buttons, fields, menus, dialogs, sheets, tabs, progress, badges, sidebar reveal, logo loading, transcript messages, workspace loading, and live question refresh.
- Before impact: Interactions worked, but the product could feel slightly uneven when moving between modals, menus, loading states, and the live cockpit.
- After impact: Motion now feels more like a calm production SaaS system: fast controls, crisp overlays, brief live-state feedback, and no permanent next-question shimmer.
- Verification: Added production-contract coverage for motion tokens, reduced-motion support, approved primitive timings, and finite live-question animation.

### Seller Research status copy sounded like a provider log

- Severity: Low
- Description: Seller Research fields in Start Call, Create Account, and Personal Account used status messages such as `Fetching information from OpenAI web research` and `What you sell was updated from OpenAI web research`.
- Root cause: The messages described the underlying provider workflow rather than the seller outcome.
- Recommended improvement: Keep OpenAI visible when a key must be configured, but describe everyday research progress in SalesFrame language.
- Fix applied: Reworded Seller Research progress and success copy to `Looking up...`, `Reading public information...`, and `What you sell is ready...`. Updated loading placeholders and helper text to say what SalesFrame is doing rather than what provider is being used.
- Before impact: A seller changing their company domain could feel like they were watching an API task instead of a product feature.
- After impact: Seller Research now feels calmer and more product-native while preserving the same workflow and OpenAI-key guardrails.
- Verification: Added production-contract checks for the calmer copy and old provider-log phrasing rejection.

### CSV import summary used harsh failure language

- Severity: Low
- Description: The CSV import summary labeled unsuccessful rows as `Failed`, described them as failed rows, and offered `Download error CSV`.
- Root cause: The UI copied backend accounting terms directly into the seller-facing summary.
- Recommended improvement: Keep row-level outcomes honest, but frame recoverable import rows as review work rather than a product failure.
- Fix applied: Reworded the summary tile to `Needs review`, changed the recovery alert to `Some rows need a quick review`, and renamed the export action to `Download review CSV`.
- Before impact: A seller could finish a mostly successful import and still see a red failure-oriented summary.
- After impact: The same outcome now feels recoverable and task-oriented: created, updated, skipped, and needs review.
- Verification: Updated production-contract checks to require the calmer CSV import recovery language and reject the older failure labels.

### CSV import used a raw spinner during import

- Severity: Low
- Description: The CSV import review action used a generic spinning loader icon while rows were being imported.
- Root cause: The import button predated the newer SalesFrame motion standard and still used a one-off loading animation.
- Recommended improvement: Use the shared gentle activity pulse for in-progress work and let the button label communicate the state.
- Fix applied: Replaced the spinner icon with the existing upload icon using `sf-state-pulse` while importing. Added a contract guard rejecting `Loader2Icon` and `animate-spin` in the import dialog.
- Before impact: The import flow had one small loading treatment that felt more like a default web app spinner than SalesFrame's calm product language.
- After impact: Import progress now feels consistent with the live cockpit, setup steps, and other stateful app controls.
- Verification: Updated the CSV import production contract and prepared the focused verification run.

### CSV parse warnings sounded like parser errors

- Severity: Low
- Description: A few CSV import warnings still used cold parsing language such as `could not read`, `could not be parsed`, and close-date parsing verdicts.
- Root cause: The import flow had been softened at the summary level, but lower-level parser and row-warning strings still surfaced implementation phrasing.
- Recommended improvement: Describe what SalesFrame needs next and what will happen to the data, rather than naming parser failure.
- Fix applied: Reworded unreadable CSV and generic CSV parse messages into standard-file guidance. Reworded invalid close-date warnings to say SalesFrame will keep the value as a note and let the seller choose a calendar date after import.
- Before impact: A seller fixing a CSV could feel like the app had rejected the file with a technical parser failure.
- After impact: The import flow now gives clear, calm recovery guidance at both file and row level.
- Verification: Updated e2e and function contract checks to require the calmer CSV parse messages and reject the older parser wording.

### CSV row review still exposed validation language

- Severity: Low
- Description: The review CSV export still used an `Error` column header, and row-level warnings for stage and currency still sounded like backend validation output.
- Root cause: The visible import summary had moved to a review-oriented tone, but the exported recovery file and a few per-row messages retained the older validation vocabulary.
- Recommended improvement: Keep the same calm review language across the modal, row messages, and downloaded review CSV.
- Fix applied: Renamed the export column to `Review note`, reworded unknown-stage handling to explain SalesFrame will keep the value, and reworded unsupported-currency handling to say which workspace currency will be used.
- Before impact: Sellers downloading a review CSV could see harsher terminology than the modal itself, making the import feel less polished and less trustworthy.
- After impact: CSV import now treats imperfect data as a guided review flow rather than a failure flow.
- Verification: Added e2e and function contract checks for the review CSV header and the calmer row-level warning copy.

### CSV review step still framed rows as errors

- Severity: Low
- Description: The CSV review tabs, count tiles, issue prefixes, and downloaded filename still used `Errors`, `Warnings`, and `import-errors.csv`.
- Root cause: The import review step used validation taxonomy directly in the interface even after the summary copy had been made calmer.
- Recommended improvement: Keep validation semantics in code, but present the workflow as `Fix first`, `Review notes`, and a review CSV so sellers understand the next action without feeling the import failed.
- Fix applied: Renamed the review tabs and count tiles, changed row issue prefixes to `Fix first` and `Review`, renamed the empty review message, and changed the downloaded filename to `accounts-import-review.csv` or `opportunities-import-review.csv`.
- Before impact: The review step could feel more severe than necessary, especially for a mostly successful import with a few rows to tidy.
- After impact: The importer now feels like a calm guided data-review workflow from upload through export.
- Verification: Added e2e contract checks requiring the new labels, rejecting the old labels, and verifying the review CSV filename.

### Shared AI error copy sounded like provider plumbing

- Severity: Low
- Description: Global AI error messages still said things like `OpenAI is receiving too many requests at once` and `The selected OpenAI model is not available`.
- Root cause: The shared browser and Netlify error mappers exposed provider-level language instead of translating failures into calm SalesFrame guidance.
- Recommended improvement: Keep the message actionable while making the wording feel like product copy, not an infrastructure log.
- Fix applied: Reworded shared browser and function-layer AI errors to `The AI is busy right now`, `The connected OpenAI key...`, and `SalesFrame's live AI model...`, while keeping the same failure classification and status handling.
- Before impact: Sellers could see provider-centric copy during the highest-friction moments, especially live-call AI startup or refresh issues.
- After impact: AI failures now read as composed product guidance while still pointing the seller to Settings or support when that is the correct next step.
- Verification: Updated e2e and function security contracts to require the calmer shared copy and reject the older provider-log phrases.

### Workspace recovery copy sounded like a hard failure

- Severity: Low
- Description: Workspace loading fallbacks and the recovery screen used phrases such as `Workspaces could not be loaded`, `Workspace data could not be loaded`, and `We could not load this workspace`.
- Root cause: The data-loading layer and workspace state screen were written around failure detection rather than the seller's next action.
- Recommended improvement: Keep retry available, but phrase the state as a temporary recovery moment instead of a broken workspace.
- Fix applied: Reworded the workspace list and workspace data fallbacks to `SalesFrame needs another moment...`, changed the recovery title to `This workspace needs another moment`, and updated the context tile to `SalesFrame is ready to try again`.
- Follow-up fix: Updated the design-language guide so its error-state example uses `This workspace needs another moment` instead of reintroducing the older `We could not load this workspace` phrasing.
- Before impact: A transient workspace fetch issue could sound like a serious data failure.
- After impact: Workspace recovery now feels calmer and more recoverable while preserving the same retry/settings path.
- Verification: Added production-contract checks for the new recovery language and rejection of the older failure phrasing.

### Workspace loading still carried hidden recovery actions

- Severity: Low
- Description: The workspace loading state no longer rendered retry/settings buttons, but its config still defined `Try again` and `Open settings` actions.
- Root cause: `WorkspaceStateView` used one config shape for loading, empty, error, and permission states even though loading is informational and the others are actionable.
- Recommended improvement: Model loading as a passive state and reserve action labels/actions for states where the seller can actually do something.
- Fix applied: Split the workspace state config into base and actionable shapes. Loading now contains only title, body, and icon, while empty/error/permission states keep their explicit actions.
- Before impact: A future UI edit could accidentally surface retry/settings controls during ordinary loading and make it feel like something was wrong.
- After impact: The state model now matches the visible calm UX: loading asks the seller to wait, recovery states offer action.
- Verification: Added production-contract coverage proving the loading config does not contain hidden action labels or handlers.

### Workspace state actions relied on non-null assertions

- Severity: Low
- Description: After splitting loading from actionable workspace states, the render path still accessed action config through non-null assertions.
- Root cause: The UI branch was visually correct, but TypeScript was not given a clear enough model of which states have actions.
- Recommended improvement: Render actionable workspace states through an explicit action-config branch and let loading fall through to the passive status branch.
- Fix applied: Replaced non-null assertions with an `actionConfig ? ... : ...` render path and removed the unused loading flag.
- Before impact: The component was correct today, but future edits could weaken the loading/action separation without TypeScript helping enough.
- After impact: The workspace state renderer is now easier to reason about and harder to misuse during future UI changes.
- Verification: Added production-contract coverage rejecting `actionConfig!` in the workspace state view.

### Workspace permission errors could be misclassified

- Severity: Medium
- Description: Workspace refresh decided whether to show `permission-denied` by checking the user-facing error message after technical details had already been sanitized.
- Root cause: The app correctly removed RLS/permission implementation details from customer copy, but then reused that sanitized copy for state classification.
- Recommended improvement: Classify permission errors from the raw error first, then translate the message for the seller.
- Fix applied: Added `isPermissionDeniedError` to the shared error helper and used it before calling `getUserFacingErrorMessage` in workspace refresh.
- Before impact: A true workspace permission/RLS issue could appear as a generic workspace load recovery state, reducing clarity and making access issues harder to understand.
- After impact: Permission issues now route to the dedicated workspace access state while still keeping backend details out of visible copy.
- Verification: Added production-contract coverage for raw permission classification and rejected the old sanitized-message state check.

### Custom controls had uneven motion feedback

- Severity: Low
- Description: Visual browser QA showed the shared shadcn controls had the right fast 100ms interaction feedback, but smaller custom controls such as sidebar expand/create buttons, account action buttons, global search rows, playbook selector rows, auth text links, breadcrumbs, table rows, date clear buttons, and replay marker buttons either snapped instantly or only transitioned transform/dimensions.
- Root cause: Motion had been standardized in shared primitives first, while a handful of bespoke controls still used local hover classes from earlier UI passes.
- Recommended improvement: Keep enterprise motion restrained, but make hover/focus feedback consistent across custom controls using the same fast token and standard easing.
- Fix applied: Added explicit `background-color`, `color`, `box-shadow`, `opacity`, and where needed `transform` transitions with `--sf-motion-fast` and `--sf-ease-standard` to the custom controls. Also aligned auth links, breadcrumb links, nested message actions, and compact chevrons. Added production-contract coverage so these controls stay aligned with the shared motion language.
- Before impact: The app was calm overall, but some dense controls felt slightly less premium because hover feedback jumped while adjacent controls eased.
- After impact: Buttons, sidebar rows, search results, playbook options, and compact utility controls now feel like one design system.
- Verification: Re-tested desktop and mobile in the in-app browser, including Start Call modal steps, playbook dropdown, opportunity tabs, and call cockpit. Added contract checks for custom-control motion consistency.

### Navigation could inherit the previous page scroll

- Severity: Medium
- Description: Clicking between pages, accounts, opportunities, calls, or tabs could sometimes land the seller partway down the next screen instead of at the top.
- Root cause: The app already reset scroll from the derived navigation key, but some same-view clicks, tab switches, and modal-driven transitions could happen before the next page finished mounting.
- Recommended improvement: Treat navigation reset as an explicit app-shell signal as well as a derived route/record effect, then run the reset after render and after loading skeletons settle.
- Fix applied: Added a navigation scroll reset nonce, routed `handleNavigate`, start-call transitions, workspace switching, and record tab switches through a shared reset request, and exposed the nonce on the main scroll root for regression coverage.
- Before impact: The seller could click into a different record and feel disoriented because the page opened near the bottom or a nested scroll area kept its old position.
- After impact: Page, record, call, workspace, and tab navigation now consistently returns the main content pane and nested scroll areas to the top.
- Verification: Added production-contract coverage for the explicit reset signal, reset nonce, post-render layout effect, and the key navigation paths that previously bypassed the central reset.

### Delete dialogs did not close themselves after success

- Severity: Medium
- Description: Successful record and workspace deletes could leave the destructive confirmation dialog responsible for staying mounted until parent state caught up.
- Root cause: The dialogs handled failed deletes inline, but after a successful delete they only stopped the submitting state and relied on parent navigation or record refresh to remove the dialog.
- Recommended improvement: Keep destructive dialogs deliberate, but close them immediately after confirmed success while preserving inline errors when the delete fails.
- Fix applied: Updated record and workspace delete dialogs to call their cancel/close path after successful confirmation, while error paths still keep the dialog open with the message visible.
- Before impact: A seller could complete a delete and still momentarily see the confirmation surface, which makes the action feel uncertain or sticky.
- After impact: Successful destructive actions now resolve cleanly and return the seller to the appropriate list or workspace state.
- Verification: Added production-contract coverage proving successful delete flows close the dialog and failed flows return before closing.

### Opportunity and call lists repeated row labels on desktop

- Severity: Low
- Description: The Opportunities and Calls pages showed account names in row content, but desktop layouts repeated small labels like `Account`, `Coverage`, `Status`, and `Date` inside every row instead of presenting a calm column header.
- Root cause: The list rows used a responsive card pattern for both mobile and desktop, so the account value was present but did not read like a true table column in larger workspaces.
- Recommended improvement: Keep mobile rows self-labelled, but use a single desktop header row so account name is a real scanable column and dense lists carry less repeated text.
- Fix applied: Added desktop-only column headers to Opportunities and Calls, including `Account`, and changed repeated row labels to mobile-only helpers.
- Before impact: Heavy workspaces could feel more verbose and less table-like, making it harder to scan account/opportunity relationships quickly.
- After impact: Desktop Opportunities and Calls now read like calm SaaS tables, while mobile still keeps each row understandable without relying on hidden headers.
- Verification: Added production-contract coverage for the desktop column headers and mobile-only row labels on both list pages.

### Page-transition skeletons used heavier framed panels

- Severity: Low
- Description: The route-loading skeleton still used bordered card-like placeholder panels even after the destination pages had been softened.
- Root cause: The skeleton component kept an older placeholder layout that did not inherit the app's newer calm, unframed surface treatment.
- Recommended improvement: Loading states should visually match the surfaces they are preparing, using quiet muted blocks rather than extra borders.
- Fix applied: Replaced the bordered placeholder panels in the page-transition skeleton with muted unframed panels.
- Before impact: Page navigation could briefly look more boxed and visually busy than the page that followed.
- After impact: Loading transitions now feel more continuous with the calmer destination pages.
- Verification: Added production-contract coverage requiring unframed muted skeleton panels and rejecting the old bordered placeholder classes.

### Create Account modal used card-like step wrappers

- Severity: Low
- Description: The Create Account wizard wrapped each step in a bordered panel inside the dialog, while the Start Call wizard had already moved to a lighter modal surface.
- Root cause: The account-creation flow retained an older card-inside-modal pattern after the shared modal system was made calmer.
- Recommended improvement: Use the dialog itself as the surface for multi-step content, and reserve bordered treatment for true warnings or destructive/errors.
- Fix applied: Removed decorative bordered wrappers from the Create Account Basics, Context, Research, and Opportunity steps while preserving the duplicate-account warning and blocking OpenAI-key alert styling.
- Before impact: Creating an account felt more cramped and visually heavier than similar setup flows.
- After impact: The Create Account wizard now matches the calmer modal design language and gives fields more breathing room.
- Verification: Added production-contract coverage requiring unframed Create Account step containers and rejecting the old bordered wrappers.

### Record edit modals still used nested bordered sections

- Severity: Low
- Description: Edit Account, Add Opportunity, and Edit Opportunity still wrapped their main field groups in bordered panels inside the dialog, while newer setup flows were already using the dialog surface directly.
- Root cause: Earlier modal cleanup focused on multi-step creation flows, leaving the single-record mutation dialogs on the older card-inside-modal pattern.
- Recommended improvement: Keep modal content unframed by default, and reserve borders for warnings, destructive confirmation, or inline error states.
- Fix applied: Removed decorative `rounded-lg border p-4` wrappers from account and opportunity edit/create sections while keeping error alert borders intact.
- Before impact: The most common record-edit flows felt slightly heavier and less consistent than the rest of the app.
- After impact: Record mutation modals now share the same calm visual rhythm as Start Call and Create Account.
- Verification: Added production-contract coverage rejecting the old nested bordered section class in record mutation dialogs and requiring unframed account/opportunity sections.

### Playbooks landing cards felt heavier than the rest of the app

- Severity: Low
- Description: The Playbooks landing page still rendered each playbook as a bordered card with an internal divider, even though the rest of the primary list surfaces had moved to softer unframed rows.
- Root cause: Playbook cards kept an older repeated-card style after account, opportunity, loading, and modal surfaces were calmed down.
- Recommended improvement: Keep repeated playbook items scannable, but use a muted unframed surface and remove internal decorative dividers.
- Fix applied: Changed playbook list items to quiet `bg-muted/30` surfaces, softened the icon well, and removed the footer divider while keeping the explicit Open action.
- Before impact: The page was functional, but the extra outlines made the Playbooks section feel more boxed-in than comparable SaaS list pages.
- After impact: Playbooks now sit visually closer to the calmer account and opportunity list language without losing discoverability.
- Verification: Added production-contract coverage requiring the unframed playbook item treatment and rejecting the old bordered card and divider classes.

### Personal account action rows wrapped unevenly on mobile

- Severity: Low
- Description: The personal Account page used `flex-wrap` for profile photo, profile save, data import, account deletion, and selling-context actions. On narrow screens this could produce uneven half-width rows instead of clear touch targets.
- Root cause: Desktop-friendly inline action rows were reused on mobile without switching to a stacked action layout.
- Recommended improvement: Stack action buttons full-width on mobile, then return to compact inline buttons from the small breakpoint upward.
- Fix applied: Updated personal Account action groups and Seller Research action buttons to use full-width stacked mobile actions with inline desktop layout.
- Before impact: Mobile users could see actions wrap unpredictably, making the page feel less deliberate and slightly harder to tap.
- After impact: Personal Account actions now read as clean mobile rows while preserving the efficient desktop layout.
- Verification: Added production-contract coverage for mobile-stacked import, deletion, profile photo, profile save, and selling-context actions.

### Post-call replay timeline used a heavier bordered panel

- Severity: Low
- Description: The post-call recording replay timeline still used a bordered muted panel and bordered event chips, while adjacent replay status and empty-note states had already moved to quieter unframed surfaces.
- Root cause: Replay UI cleanup previously focused on preventing false playback errors and simplifying notes, leaving the timeline visual treatment on the older framed style.
- Recommended improvement: Keep the timeline scrubber and event markers obvious, but remove decorative borders so the replay area reads as one calm post-call tool.
- Fix applied: Changed the replay timeline wrapper to an unframed muted surface and softened timeline event and empty-state chips to background-tinted controls without borders.
- Before impact: The post-call replay panel looked slightly busier than the surrounding post-call content.
- After impact: The recording timeline now feels visually consistent with the rest of the replay and post-call surfaces.
- Verification: Added production-contract coverage requiring the unframed replay timeline and rejecting the old bordered timeline/event styles.

### Record navigation could preserve an old scroll position

- Severity: Medium
- Description: Clicking into accounts, opportunities, or calls could sometimes land part-way down the destination page instead of at the top.
- Root cause: Page-level navigation already reset the main scroll container, but record selection changed active account/opportunity/call state before the route fully settled, and browser scroll restoration could still preserve the previous viewport position.
- Recommended improvement: Treat every record selection as a top-of-page navigation event, and disable browser-assisted scroll restoration for the single-page app shell.
- Fix applied: Added an immediate scroll reset to account, opportunity, and call selection handlers, kept the existing post-mount reset, and set `history.scrollRestoration` to `manual` while the app is mounted.
- Before impact: Sellers moving from long lists or lower-page sections could arrive at the bottom or middle of a new record and lose orientation.
- After impact: Opening any account, opportunity, call, breadcrumb destination, or same-page route intentionally returns the main workspace pane to the top.
- Verification: Added production-contract coverage for manual scroll restoration and explicit record-selection scroll resets.

### Post-call replay controls wrapped awkwardly on mobile

- Severity: Low
- Description: The recording replay controls used one wrapping horizontal row for Play, Open recording, volume, and retention copy.
- Root cause: A desktop-friendly `flex-wrap` layout was reused on narrow screens, so controls could land in uneven partial rows and the volume slider could feel squeezed.
- Recommended improvement: Use full-width stacked action targets on mobile, then switch back to compact inline controls on larger screens.
- Fix applied: Changed the replay control row to a mobile-first grid, made Play and Open recording full-width touch targets on mobile, and gave the volume slider a calm full-width mobile row.
- Before impact: Post-call replay on mobile could feel visually clumsy immediately after a seller ended a call.
- After impact: Replay controls now read as deliberate touch-friendly rows on mobile while staying compact on desktop.
- Verification: Added production-contract coverage for the mobile-stacked replay controls and rejection of the old wrapping control row.

### Record card header actions used small mobile buttons

- Severity: Low
- Description: Common card-header actions like Save account, New opportunity, Save methodologies, Download transcript, Delete call, and Save custom framework could appear as content-width buttons after wrapping below the title on mobile.
- Root cause: The shared card header moved action areas below titles on small screens, but several individual action groups kept desktop-style wrapping button classes.
- Recommended improvement: Make header actions mobile-first with full-width stacked touch targets, then restore compact inline layout at the small breakpoint.
- Fix applied: Updated high-use account, opportunity, methodology, post-call replay, dashboard, and custom framework header actions to use full-width mobile buttons with compact desktop layout.
- Before impact: Mobile record pages could feel slightly improvised, with small action buttons floating under full-width headers.
- After impact: Primary record actions now feel deliberate and easier to tap on mobile without making desktop pages heavier.
- Verification: Added production-contract coverage requiring mobile-stacked card-header actions across the affected record and replay surfaces.

### Workspace search was unavailable on mobile

- Severity: Medium
- Description: The global workspace search input was hidden below the large-screen breakpoint, leaving mobile sellers without a direct way to find accounts, opportunities, calls, or playbooks from the header.
- Root cause: Search was implemented as a desktop header input only, with no compact trigger or mobile search surface.
- Recommended improvement: Keep the desktop search input, but add a mobile icon trigger that opens the same fuzzy search experience in a touch-friendly dialog.
- Fix applied: Added a mobile Search workspace button, reused the same search result renderer for desktop and mobile, and added a scrollable mobile search dialog with the shared Cancel action.
- Before impact: Mobile users had to navigate manually through sidebar/list pages even when they knew the account, opportunity, or call they wanted.
- After impact: Workspace search is now available from the mobile header while keeping the desktop header unchanged.
- Verification: Added production-contract coverage for the mobile search trigger, dialog copy, shared result renderer, scrollable results area, and Cancel action.

### Account opportunity rows were table-first on mobile

- Severity: Low
- Description: The Account page Opportunities tab rendered the same fixed table on mobile and desktop.
- Root cause: The aligned desktop table was reused below the medium breakpoint, so opportunity names, coverage, and the action menu had to share narrow table columns.
- Recommended improvement: Use a dedicated mobile card/list pattern for account opportunities, while keeping the aligned table for desktop scanning.
- Fix applied: Added a mobile-only opportunity list with clear name, stage/value, coverage, guidance preview, and actions menu, then limited the table to medium screens and up.
- Before impact: Mobile account pages could feel cramped when an account had several opportunities, especially around the action column.
- After impact: Mobile sellers get easier-to-scan opportunity cards, while desktop sellers retain the clean aligned table.
- Verification: Added production-contract coverage for the mobile list, mobile coverage bar, desktop-only table, and shared Open/Delete actions.

### Workspace search missed record notes and transcripts

- Severity: Medium
- Description: The global workspace search could find core opportunity text, but account results and call results did not include the seller's account record fields, profile notes, opportunity draft fields, or saved call transcript lines.
- Root cause: Opportunity search used the shared rich fuzzy-search helper, while account and call entries still built their search text inline from only lightweight labels.
- Recommended improvement: Centralise search text generation for accounts, opportunities, and calls, then feed current record drafts and call transcripts into the header search.
- Fix applied: Added shared account and call search-text helpers, passed account drafts, opportunity drafts, and transcripts into the global search component, and wired account/call results through the richer context.
- Before impact: A seller could search for information they had entered or captured in a call and get no global result, which made navigation feel incomplete.
- After impact: Header search now covers account fields, opportunity fields, notes, transcript lines, and call context without adding extra visible UI.
- Verification: Added production-contract coverage requiring the new search helpers and the header wiring for drafts and transcripts.

### List page search used thinner context than global search

- Severity: Low
- Description: The Opportunities and Calls list pages had visible Account columns, but their local search paths still used lighter context than the global workspace search.
- Root cause: The list pages kept inline search builders after richer shared fuzzy-search helpers were added for record and transcript search.
- Recommended improvement: Use the shared search context consistently so sellers can find records from either the header or the page they are already on.
- Fix applied: Routed Opportunities page search through the opportunity helper with draft fields, and routed Calls page search through the call helper with related account, opportunity, draft, and transcript context.
- Before impact: A seller could search a call transcript or edited opportunity field from the header and find it, then fail to find the same item from the Calls or Opportunities page.
- After impact: Global search, Opportunities search, and Calls search now share the same richer context model while keeping the UI calm.
- Verification: Added production-contract coverage for local page search using opportunity drafts and call transcripts.

### Dense workspace lists rebuilt lookup context too often

- Severity: Low
- Description: Global search, the seller dashboard, Opportunities, and Calls rebuilt account/opportunity lookup maps and methodology summaries on every render.
- Root cause: Lookup maps were created inline in render, and some filtered result calculations depended on those fresh map references.
- Recommended improvement: Memoize stable lookup maps and expensive display opportunity summaries so dense list interactions stay responsive as a workspace grows.
- Fix applied: Memoized account and opportunity lookup maps in global search, the dashboard, Opportunities, and Calls; memoized dashboard/opportunity methodology summaries; and memoized Calls filters and visible results.
- Before impact: Search and filter interactions in a heavily populated workspace could do unnecessary recalculation work even when the underlying accounts, opportunities, or calls had not changed.
- After impact: Heavy-workspace list pages do less repeated work while preserving the same calm UI and search behaviour.
- Verification: Added production-contract coverage requiring memoized lookup/result preparation on the affected surfaces.

### Create Account research step carried a long source-list footnote

- Severity: Low
- Description: The Create Account modal's Research step printed the full trusted public-source list under Seller Research.
- Root cause: Source transparency copy was added directly to the modal body, even though the surrounding card already explained the research behaviour.
- Recommended improvement: Keep setup modals compact and action-focused; put detailed source provenance in account intelligence/results, not in the step that is trying to get the seller through setup.
- Fix applied: Removed the long source-list footnote from the Create Account modal and added a clear `Use customer research` label beside the Customer Research toggle for consistency with Seller Research.
- Before impact: The research step used extra vertical space and made the modal feel more like documentation than a setup workflow.
- After impact: The step stays calmer and easier to scan while preserving the same Customer Research and Seller Research controls.
- Verification: Added production-contract coverage rejecting the source-list footnote and requiring the explicit Customer Research toggle label.

### Opportunity amount modals used separate preview text

- Severity: Low
- Description: Create Account, Add Opportunity, and Edit Opportunity showed a separate amount preview line underneath the amount input.
- Root cause: The opportunity record page already formatted the amount field on blur, but modal forms kept an older helper-preview pattern.
- Recommended improvement: Keep currency formatting inside the input itself so amount entry behaves consistently and avoids extra helper text.
- Fix applied: Added on-blur currency formatting to create, add, and edit opportunity amount inputs, and removed the preview helper lines.
- Before impact: Opportunity modals had extra visual noise and did not match the calmer opportunity record amount field behaviour.
- After impact: Sellers can type shorthand amounts like `250k` and see the formatted currency in the field, with less text competing for attention.
- Verification: Added production-contract coverage requiring modal amount blur formatting and rejecting the old preview copy.

### Account intelligence save action invited duplicate saves

- Severity: Low
- Description: The Account Intelligence `Save intelligence` action stayed enabled even when the seller had not changed any AI-enriched sales signal fields.
- Root cause: The editor tracked the current draft but did not compare it with the saved enrichment profile before rendering the action state.
- Recommended improvement: Make save actions truthful and stateful: invite a save only when there are unsaved edits, and avoid showing a stale saved message after the seller starts editing again.
- Fix applied: Added an enrichment-draft equality check, disabled `Save intelligence` until fields change, and hid the previous saved message once the draft diverges from the saved profile.
- Before impact: Sellers could click a real-looking save action that had nothing new to commit, adding subtle uncertainty about whether anything changed.
- After impact: Account Intelligence now behaves like a calmer editor: unchanged data is clearly settled, edits enable the save action, and status copy stays truthful.
- Verification: Added production-contract coverage for draft comparison, dirty-state handling, stale saved-message suppression, and disabled unchanged saves.

### Account and opportunity record saves invited no-op clicks

- Severity: Low
- Description: Account record, Opportunity record, and Opportunity methodology save buttons stayed enabled whenever required fields existed, even if the seller had not changed anything.
- Root cause: The record pages used editable draft state but did not keep a saved baseline for the visible record editor, so the UI could not tell unchanged data from unsaved edits.
- Recommended improvement: Treat each record editor like a settled form: disabled when unchanged, enabled when edited, and avoid stale saved feedback once the seller starts changing fields again.
- Fix applied: Added saved-baseline comparisons for account drafts, opportunity drafts, and playbook selections; disabled save actions until the visible editor changes; and hid saved status messages after subsequent edits.
- Before impact: Sellers could click real save buttons that had nothing new to commit, adding subtle uncertainty about whether their record state was current.
- After impact: Record editors now feel calmer and more truthful: unchanged records sit quietly, edits clearly enable the save action, and save feedback stays aligned with the current draft.
- Verification: Added production-contract coverage for draft equality helpers, disabled unchanged saves, and stale saved-message suppression across account, opportunity, and methodology editors.

### Edit modals invited unchanged record saves

- Severity: Low
- Description: Right-click/Edit Account and Edit Opportunity modals opened with a real-looking Save action even when the seller had not changed any field.
- Root cause: The edit dialogs mirrored field values into local component state but did not keep an opening-state baseline to compare against.
- Recommended improvement: Match the inline record editors: disabled save until a field changes, including linked-account changes on opportunities.
- Fix applied: Added saved draft baselines to both edit dialogs, compared current modal state against those baselines, and disabled Save until a meaningful change exists.
- Before impact: Sellers could open an edit modal, click Save without changing anything, and wait on a backend write that did not improve the record.
- After impact: Edit modals now feel quieter and more intentional: unchanged records can simply be cancelled, while actual edits clearly enable Save.
- Verification: Added production-contract coverage requiring saved-baseline state and change detection in both edit dialogs.

### Workspace edit modal invited unchanged saves

- Severity: Low
- Description: The workspace edit dialog showed `Save workspace` as available as soon as the workspace name was present, even if no workspace fields had changed.
- Root cause: The dialog only validated the required name field and did not compare the current form state with the workspace values loaded when the modal opened.
- Recommended improvement: Match record editors by keeping Save disabled until the seller changes the workspace name, description, or default currency.
- Fix applied: Added a saved workspace draft baseline, normalized the current draft, and disabled Save until the form differs from the baseline.
- Before impact: Sellers could save an unchanged workspace and wait on a backend action that did not change anything.
- After impact: Workspace editing is calmer and more truthful: unchanged workspaces can be cancelled, and the save action appears only after a real edit.
- Verification: Added production-contract coverage for workspace edit dirty-state tracking and disabled unchanged saves.

### Navigation sometimes preserved a deep scroll position

- Severity: Medium
- Description: Opening a different page, account, opportunity, call, breadcrumb, search result, or tab could feel inconsistent if the main content pane had previously been scrolled deep down the app.
- Root cause: The app shell needed a single navigation scroll reset that covers both route-like view changes and record/tab switches inside the fixed shadcn-style viewport.
- Recommended improvement: Treat every page and record selection as a fresh reading context: reset the main scroll container, nested non-preserved scroll containers, and browser scroll position immediately and after page skeleton transitions.
- Fix applied: Centralised navigation top-reset behaviour around the main app scroll root, wired sidebar/header/search/account/opportunity/call/tab paths through it, disabled browser scroll restoration, and kept saved record baselines at app level so navigation does not make unsaved edits look settled.
- Before impact: Sellers could click into a new account, opportunity, call, or tab and arrive halfway down the destination, making the app feel jumpy and less calm.
- After impact: Opening a page or record now returns the seller to the top of that surface while preserving intentional nested scroll areas only when marked.
- Verification: Added production-contract coverage for page and record navigation scroll resets, direct route-change bypasses, and app-level saved draft baselines.

### Navigation could preserve old scroll after slow page loads

- Severity: Medium
- Description: Some page, account, opportunity, call, and tab navigation paths could land partway down the next screen when the previous page had been scrolled deeply.
- Root cause: Scroll reset was requested on click, but long workspace/page transitions could finish after the immediate reset had already run.
- Recommended improvement: Treat scroll reset as a pending navigation action and consume it only once the target page is no longer loading.
- Fix applied: Added pending scroll-reset state, kept browser scroll restoration manual, and reset the app scroll root after workspace/page loading completes.
- Before impact: Sellers could click into a record and feel disoriented because the page opened at the previous scroll depth.
- After impact: Navigation now consistently lands at the top of the target page while avoiding surprise resets during ordinary data refreshes.
- Verification: Extended production-contract coverage for pending navigation scroll resets and load-aware scroll consumption.

### Motion audit found custom animation drift

- Severity: Medium
- Description: The app had accumulated SalesFrame-specific motion tokens, pulsing decorative icons, and nested sidebar fade/slide choreography even though the desired app feel is calm shadcn-style motion.
- Root cause: Motion was improved surface-by-surface instead of audited as a full component inventory, so some custom animation choices were missed.
- Recommended improvement: Treat shadcn/Radix/tw-animate as the default, use Animate UI only for justified component-level interactions, and keep all other surfaces static.
- Fix applied: Removed `--sf-motion-*` and `--sf-ease-*` tokens from the source app, removed decorative pulsing icons and replay marker lift, restored direct sidebar account/playbook reveal, and added `docs/animation-component-audit.md` as the component-level motion inventory.
- Before impact: Sidebar and setup/live surfaces could feel slightly over-animated or locally tuned instead of default and calm.
- After impact: Motion now comes from default shadcn/Radix/tw-animate patterns, with shadcn Skeleton as the only approved pulse.
- Verification: Updated production-contract coverage to reject custom motion variables, local keyframes, decorative pulse in app code, sidebar nested choreography, shimmer, gradient text masking, and large hover scale.
