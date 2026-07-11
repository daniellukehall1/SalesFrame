# SalesFrame Product Build Spec

Last updated: 2026-06-28

## Product Intent

SalesFrame is a commercial SaaS product for individual sellers. It runs in a browser tab during video calls and gives real-time question guidance based on the selected account, opportunity, call type, transcript, previous calls, and sales playbooks.

The core product promise is: real-time seller question guidance by opportunity and framework.

SalesFrame has Supabase Auth connected on the frontend. Netlify deployment, Supabase as the system of record, and OpenAI-only AI services are the implementation path.

## Current UX Principles

- Keep the UI calm and shadcn/new-york inspired.
- Use shadcn-style semantic colour tokens: coverage/progress bars use red for 0-33%, orange for 34-66%, and green for 67-100%; the primary Start call action uses the destructive/red button treatment.
- Use a fixed sidebar and a rounded main panel that remains visible at viewport height; content inside the panel scrolls.
- Avoid busy live screens. Show one primary next best question, a small set of missing gaps, and deeper evidence behind tabs.
- Public-facing app copy should read as production-ready software for testers. Do not describe visible flows as prototype, preview, demo-only, local-only, backend-pending, planned, or not production-ready.
- Account and opportunity records are separate concepts:
  - Account page owns editable account fields.
  - Opportunity page owns editable opportunity fields and opportunity intelligence.
  - Opportunity page includes an Account record panel with an Open account button.
- Playbook question banks should not be shown as static top-level content. Live questions are generated dynamically from conversation context and framework gaps.

## Information Architecture

- Auth
  - Logged-out users see shadcn-style login and signup pages based on the official `login-01` and `signup-03` block structure.
  - Login, signup, forgot password, persisted session check, and logout are wired to Supabase Auth through the Supabase browser client.
  - Legal links show clear status copy until Terms and Privacy documents exist.
- Main-panel breadcrumbs
  - Breadcrumbs start at Home, not SalesFrame.
  - Account pages show Home > Account name.
  - Opportunity pages show Home > Account name > Opportunity name, with the section appended for methodology, call cockpit, post-call, and next-call brief views.
  - Call surfaces show Home > Account name > Opportunity name > Call page so the seller can see which account and opportunity the call context belongs to.
- Workspaces
  - The top sidebar selector is called Workspaces, not Teams.
  - The closed sidebar workspace trigger always shows SalesFrame as the title and the active workspace name as the subtitle.
  - Create workspace opens a modal with required workspace name, default currency, and optional description/role fields.
  - Workspace rows support right-click context actions: open, edit workspace details, duplicate, and delete.
  - Workspace actions should scope accounts, opportunities, calls, settings, and membership by workspace.
  - Changing the active workspace immediately replaces the main panel and sidebar navigation with shadcn Skeleton loading states only while the next workspace data is unresolved. Never impose an artificial minimum delay after the data is ready.
- Home
  - Dashboard charts and opportunity focus table.
  - Coverage by opportunity should span the dashboard width rather than competing with a separate focus queue.
  - Opportunity focus uses a colour-coded Attention metric instead of repeating the coverage progress bar.
  - Start call button opens the Start Call wizard.
- Accounts
  - Sidebar groups accounts as parent items, with opportunities as child items.
  - Account page includes Account record, Opportunities, Intelligence, and Account focus tabs.
- Opportunities
  - Opportunity record fields are editable.
  - Intel tab includes Next-call brief and opportunity intelligence.
  - Methodology tab shows framework completion.
  - History tab shows previous call recordings for the opportunity.
- Calls
  - Calls top-level item opens the call library.
  - No sidebar dropdown for calls; call details live inside active call or library views.
- Playbooks
  - MEDDICC
  - MEDDPICC
  - BANT
  - Force Management / Command of the Message
  - SPIN Selling
  - Sandler
  - The Challenger Sale
  - Gap Selling
  - Value Selling
  - Strategic Selling (Miller Heiman)
  - SPICED (Winning by Design)
  - Custom framework
- Settings
  - OpenAI API key area.
  - Capture, retention, and AI settings should remain in the Settings page rather than sidebar dropdowns.

## Start Call Workflow

The Start Call wizard has four steps:

1. Account
   - Select existing account or create a new account.
   - New account captures at least account name, industry, and account currency.
2. Opportunity
   - Select existing opportunity for the account or create a new opportunity.
   - New opportunity captures at least opportunity name.
3. Call
   - Select call type.
   - Multi-select playbooks.
   - Opportunity-level playbooks are inherited by default.
   - Call-level playbooks can override the inherited set.
4. Seller Research
   - Optional Seller Research toggle.
   - Captures seller company, company domain, customer contact, customer role, and what the seller sells.
   - Company domain should auto-populate seller company and what the seller sells where possible.
   - Seller company/domain/product context should persist across future calls and only change when the user changes it.

When Start Call is confirmed:

- Active account and opportunity are set.
- Call type and selected playbooks are applied to the live cockpit.
- Recording state starts.
- A new account or opportunity is created if selected.
- Seller Research and buyer-context settings are passed into live guidance.

## Live Call Capture And Guidance Pipeline

Live transcription must feel like a clean human conversation, not raw subtitle fragments.

- Start Call must run a mandatory audio preflight before the cockpit opens:
  - Seller mic is required for every call.
  - Meeting/tab audio is required for remote meeting mode.
  - Mixed room audio is required for in-person/iPhone mode.
  - If remote meeting mode cannot hear buyer audio, block start and explain that SalesFrame can hear the mic but not the buyer.
- Store preflight output on the call as `audio_preflight`, `audio_source_summary`, and `guidance_readiness` so poor transcript quality can be diagnosed later.
- Deepgram Flux is the live transcription and turn-taking provider. The browser requests a short-lived token from `/api/deepgram/token`, then opens `/v2/listen` using `flux-general-en`, `linear16`, `16000` Hz audio, and 80ms PCM chunks. Do not send `language_hint` with `flux-general-en`; Deepgram only supports `language_hint` on `flux-general-multi`, and rejects the English-only model when language hints are attached.
- Browser WebSocket auth uses a temporary JWT from `/auth/grant`; because browsers cannot set `Authorization: Bearer`, send it as `Sec-WebSocket-Protocol: bearer, <temporary credential>`. Do not use `token, <temporary JWT>`; Deepgram rejects that pattern for temporary JWTs.
- Do not attach `diarize_model` to live Flux `/v2/listen` URLs until Deepgram accepts it on that endpoint. As of the July 2026 production smoke tests, `flux-general-en&diarize_model=latest` rejects the WebSocket handshake, while the same Flux URL without diarization opens correctly. Use Flux turn boundaries live, source separation for two-channel calls, editable speaker labels, and post-call correction for diarization cleanup.
- Deepgram `StartOfTurn`, `Update`, `EagerEndOfTurn`, `TurnResumed`, and `EndOfTurn` events drive the transcript state machine. `Update` only refreshes the live row; `EndOfTurn` is the only event that persists a durable transcript turn.
- Never reintroduce a blind fixed-interval transcript commit loop. It chops speakers mid-thought and causes duplicate fragments.
- Two-channel capture opens separate Deepgram streams for seller mic and shared customer/system audio. Source separation is the primary truth: `seller_mic` defaults to Seller and `meeting_audio` defaults to Customer.
- One-channel capture uses a mixed mic stream with Deepgram streaming diarization metadata where available. Those labels remain editable because mixed-room diarization is lower confidence than source separation.
- Transcript events are reconciled by provider-neutral identity: `transcription_provider`, `provider_session_id`, `provider_turn_index`, and `provider_event_id`. Old OpenAI reconciliation columns remain for historical calls.
- Live transcript rows are durable conversation turns:
  - Deltas update a temporary live row and must be joined with word-boundary logic so transcript text never renders as squashed words.
  - Partial deltas are never inserted as durable transcript rows.
  - Completed/final events persist or update the durable turn.
  - Saved rows include provider-neutral Deepgram metadata: `transcription_provider`, `provider_session_id`, `provider_turn_index`, `provider_event_id`, `audio_source_kind`, `client_turn_id`, `turn_sequence`, `end_of_turn_confidence`, `word_confidence`, `language_detected`, `diarization_speaker`, and `quality_flags`. Historical OpenAI columns stay nullable for old calls only.
  - Duplicate final events within the same source/time window are suppressed.
  - Adjacent same-speaker turns are merged when they occur inside the turn-continuity window.
- Seller-facing audio setup uses `One channel`, `Two channels`, and a disabled `Meeting bot` option. Internally, V1 keeps `microphone`, `in_person_microphone`, and `meeting_audio` for compatibility; new one-channel selections prefer `in_person_microphone`, while `microphone` remains a legacy fallback.
- Start Call audio setup must show the selected microphone input and a live meter before the call starts. The selected microphone is reused for preflight, recording, and Deepgram transcription rather than falling back to the browser default.
- One-channel setup shows `Room/call audio` plus a speaker/output check where the browser supports it. Output selection is only a routing/test aid; one-channel transcription still depends on the selected microphone physically hearing the buyer.
- `Two channels` maps to `meeting_audio` plus `seller_mic` and is the preferred desktop capture path:
  - Seller mic is the likely seller stream.
  - Meeting/tab audio is the likely customer-side stream.
  - The seller chooses the microphone input in the modal, then selects shared meeting audio through the browser share picker. Shared audio is labelled as `Shared audio` until transcript turns prove customer speech is flowing.
  - Meeting/tab audio is captured with audio processing disabled where the browser supports it so the customer-side stream is not altered before transcription.
  - The separate seller microphone uses echo cancellation and noise suppression where supported because customer-side audio is already captured separately.
  - One-channel microphone capture stays editable and confidence-aware.
- `One channel` uses mono speech-oriented capture where supported, avoids aggressive echo/noise suppression that can remove far-side voices, and warns the seller that customer audio may be incomplete if the buyer is not audible to the device microphone.
- Rolling diarization is not part of the default live path. It can run as an opt-in/background or post-call correction layer, but live coaching must not depend on it or show repeated diarization error notes.
- If rolling diarization is re-enabled, it must reconcile into existing transcript turns rather than create extra transcript lines, and failures must stay quiet unless the seller explicitly opens diagnostics.
- Live guidance is AI-first only:
  - The frontend must not create deterministic fallback questions.
  - The OpenAI live-guidance function receives account context, opportunity context, selected playbooks, customer research, recent transcript, and recent guidance events.
  - Every visible seller-editable account and opportunity field must be available to live guidance either through `recordContext` or, for methodology/framework selection, through selected playbooks and playbook fields. Adding a new seller-editable field requires updating the live-guidance context contract and tests deliberately.
  - Guidance refreshes from meaningful final turns or explicit seller feedback, not partial transcript fragments. Seller turns can also make the currently displayed recommendation stale if the seller asks a different question or moves the conversation forward.
  - A fast flow-decision lane classifies conversation stage, buyer mood, topic shift, active intent status, and whether the displayed question should refresh before the full polished question is requested. It receives a compact `liveStateContext` with seller-visible account, opportunity, and call fields only; it must not send workspace IDs, owner IDs, raw database rows, storage paths, or other implementation internals to OpenAI.
  - The visible `Ask this next` card uses the low-latency `/api/openai/live-question` path. It returns only the card recommendation, short reason, lifecycle, confidence, target intent, compact also-covers, and context-used fields.
  - The heavier `/api/openai/live-guidance` path remains for first-question readiness, evidence-rich guidance events, methodology updates, parked intents, and background detail; it must not block live in-call question replacement.
  - Candidate ranking must consider conversation stage, buyer mood, what was just answered, methodology gap value, naturalness, information gain, and risk of sounding abrupt.
  - Candidate ranking must separate methodology value from ask-now fit. A high-value methodology gap can be parked when asking it would be awkward in the current flow.
  - Every AI guidance response includes a formal question lifecycle: active, asked, answered, stale, parked, revisit before close, or dropped.
  - SalesFrame maintains intent debt in `parkedIntents`: why the intent was parked, the natural re-entry cue, and the bridge question to recover it later.
  - The live card should show only one subtle flow note such as parked for later, best move right now, or before you wrap. Full parked intent detail belongs behind coach tabs.
  - If the conversation has moved on, the coach should follow the customer thread and park the original intent rather than forcing an awkward methodology question.
  - Near wrap-up, the coach can recover the top one or two high-value parked intents with soft bridge wording.
  - When a previous recommended question was asked and the buyer answered it, the next AI guidance event must advance the conversation rather than repeating the same question.
  - If one meaningful final turn has passed since the last question decision, the app must force a live-question refresh so the visible question cannot stay stale. The 30-second audit is a backup heartbeat, not the normal update path.
  - While a call is recording or paused, the browser runs a fast OpenAI state check roughly every 10 seconds and forces a live-question audit every 30 seconds since the last successful question decision. This is an AI refresh cadence, not a local fallback question.
  - The initial first-question request must not overwrite newer live guidance once transcript has started.
  - Post-call correction is the transcript source-of-truth cleanup layer and should regenerate evidence, notes, follow-up, and next-call brief from corrected turns.
- Desktop live calls can expose a Live Coach popout window:
  - The main SalesFrame tab remains the only call engine for capture, transcription, AI guidance, persistence, and stop-call lifecycle.
  - The popout is a same-origin companion surface that mirrors the current live question and sends back only small seller commands: asked, skip, and end call.
  - The supported popout command contract is intentionally narrow: ready, asked, skip, and end call. Do not add no-op command names.
  - The popout route is lazy-loaded so the ordinary SalesFrame app shell does not bundle the desktop companion surface for every session.
  - Use browser-local sync such as `BroadcastChannel` with a `localStorage` fallback; do not add a second backend session, OpenAI stream, or Supabase subscription for the popout in V1.
  - Popout commands must be deduped in the main cockpit because BroadcastChannel and localStorage can both deliver the same seller action.
  - Popout commands must be fresh and strictly scoped: call actions require the current `activeCallId`, and question actions require the current question ID.
  - Popout actions must give the seller calm acknowledgement: show that a command was sent, confirm when the main tab reflects the update, and explain if the main tab does not respond.
  - Stored and already-open popout snapshots must be freshness-gated so a reopened or disconnected window never presents an old next question as live guidance.
  - Hide the popout action on mobile viewports because a second browser window is not useful on phone-sized call workflows.

## Create Account Workflow

The sidebar Accounts plus button opens a modal called Create account.

The modal should stay calm and progressive, not a large CRM-style form.

The seller's saved selling context is managed from the personal Account page:

- Your company domain.
- Your company.
- What you sell.
- Changing the company domain clears "What you sell", waits for typing to stop, then uses OpenAI seller-domain research to refresh the company and product context.
- These saved fields prefill Seller Research steps in account creation, opportunity setup where research context is shown, and Start Call setup.

Steps:

1. Basics
   - Account name is the only required field.
   - Currency defaults from the workspace and can be changed per account.
   - Website/domain, industry, and location are optional.
   - If a website/domain is entered, the UI can infer a display name only when the account name is blank.
   - Duplicate detection should warn on matching account name or website/domain.
   - If a duplicate is detected, the user should be able to open the existing account instead of creating another record.
2. Context
   - Optional fields: employee size, current tools, strategic initiatives, competitors, and free-text account notes.
   - Account notes should remain free text for now.
3. Customer Research
   - Optional toggle.
   - Research defaults are saved at the account level and inherited by subsequent calls for that account.
   - Research should use the same trusted sources every time, with LinkedIn checked first where available.
   - Research should run through a server-side OpenAI-powered research workflow or controlled retrieval workflow, not client-side browsing.
   - The research must connect account findings to why the account may buy what the seller sells.
4. First Opportunity
   - The user is offered the option to create the first opportunity in the same flow.
   - Opportunity name is the only mandatory opportunity field.
   - Additional opportunity fields stay hidden until the user clicks Show optional fields.
   - Optional opportunity fields include stage, amount, close date, playbooks, next step, and known pain.

After account creation:

- The account belongs to the current seller.
- The user lands on the new Account page.
- If a first opportunity was created, it appears as a child item under the new account in the sidebar.
- If no first opportunity was created, the Account page should still work and show an empty opportunity state.

## Add Opportunity Workflow

The Account page and Opportunities page both expose a New opportunity action.

The modal should stay progressive and account-attached:

- Account is selectable and defaults to the current account context.
- Opportunity name is the only required field.
- Stage and playbooks are visible in the main form.
- Optional fields are hidden behind Show fields:
  - Amount
  - Close date
  - Next step
  - Known pain
  - Decision process
  - Manual notes

After opportunity creation:

- The opportunity is added under the selected account in the sidebar.
- The editable opportunity record is created.
- The user lands on the new Opportunity record.
- Selected playbooks become the opportunity-level methodology defaults for future calls.

## Sidebar Record Actions

Account and opportunity rows in the sidebar support right-click context menus.

Account actions:

- Open account.
- Edit account fields in a modal without navigating away from the current page.
- Add opportunity under that account.
- Delete account after confirmation.

Opportunity actions:

- Open opportunity.
- Edit opportunity fields in a modal without navigating away from the current page.
- View parent account.
- Delete opportunity after confirmation.

Delete behaviour:

- Delete actions update the local account tree, opportunity list, and editable draft state.
- The app keeps at least one usable account/opportunity context until empty states and recovery rules are connected to persistent data.
- Persistent delete flows should include permission checks, soft delete or archive rules, and recovery handling.

## Call Cockpit Behaviour

The call cockpit dynamically updates during a call.

The cockpit is a no-bot live sales coach, not a transcript dashboard. The core promise is: show one natural seller move at the right time, based on conversation flow, buyer mood, selected playbooks, methodology gaps, and opportunity history.

Inputs:

- Account record.
- Opportunity record.
- Opportunity intelligence.
- Selected call type.
- Selected playbooks.
- Seller Research and buyer context if enabled.
- Transcript segments with speaker labels.
- Previous opportunity calls and next-call brief.

Core behaviour:

- The app listens to transcript updates.
- The app detects whether the seller has asked a question that satisfies an intent.
- The app detects whether the customer answered an intent without being prompted.
- Once an intent is asked or answered, the next best question moves to the next highest-priority missing intent.
- Call type changes the priority order of what should be asked next.
- Playbook selection changes which gaps and questions matter.
- Multiple selected playbooks are merged into shared intent clusters before live guidance is ranked. The app should treat overlaps such as MEDDICC Identify Pain, SPIN Problem, Force Business Pain, Gap Selling Current State or Gap, SPICED Pain, Sandler Pain, and Value Selling Business Issue as one customer-learning goal.
- Strict methodology adherence happens in the background, natural human conversation happens in the foreground. The seller sees one best move, while evidence can update several selected playbook fields at once.
- Intent cluster mapping is methodology metadata only. It may group selected fields and provide OpenAI with candidate learning goals, but it must not generate deterministic local questions or local evidence judgments.
- Seller Research and buyer context change the angle of the recommended question.
- The call cockpit next-best question is AI-required. The front end must not show a deterministic local question when AI guidance is unavailable.
- Start Call performs an AI guidance readiness check before recording begins. If the AI guidance endpoint cannot return a valid first question, the call does not start and the seller sees the issue in the start flow.
- Conversation thread profiles include opening, context, pain, impact, decision, commercial, stakeholder, solution-fit, and next-step.
- The next best question should feel like a natural follow-up to the latest customer topic while still enforcing the selected methodology.
- OpenAI services produce the live next-best question, intent coverage, conversation read, gaps, and alternatives. The product contract remains: call type, selected playbooks, missing fields, current discussion flow, Seller Research, buyer context, and previous opportunity context all influence the recommendation.
- Live coaching runs in three AI lanes:
  - Fast lane: reads meaningful final transcript turns, detects buyer answers, and updates the live state.
  - Thinking lane: ranks three candidate seller moves and returns the best display recommendation plus a softer alternative.
  - Background lane: diarization correction, evidence mapping, notes, risks, follow-up, and next-call brief.
- Live guidance must return a state model with conversation stage, buyer mood, seller move, active intent, intent status, timing, risk, confidence, and UI mode.
- Candidate ranking must score methodology value, naturalness, timing fit, buyer mood fit, information gain, risk, and overall score.
- Candidate ranking must score shared intent clusters first, then let OpenAI choose a single natural question and field-level evidence updates.
- Seller feedback controls are AI signals, not decorative UI. Asked, Too soon, Softer, and Skip are visible controls; Use next is an internal signal when seller-selected or softer wording is promoted into the cockpit. These actions are stored and passed into future guidance calls.
- Opportunity evidence memory is persistent. Live and post-call AI should update opportunity field evidence by playbook field ID with status, confidence, source call, source transcript segment when available, and concise evidence summary. One answer can update multiple fields; partial answers should mark stricter fields as weak rather than confirmed.

Display:

- One primary next best question.
- Reason the question is recommended.
- Compact chips for selected call type, primary target, intent cluster, buyer mood, stage, timing, confidence, and covered intent count.
- A subtle "Also updates" line can show up to three other playbook fields the question may update, plus a compact overflow count.
- Controls: Asked, Too soon, Softer, Skip.
- Supporting cards may show ranked intent clusters and candidate reasoning, but the live moment should remain visually calm.
- The call cockpit rail should show the active recording status/control first. When capture is active, the recording control is a destructive/red button that stops the recording and finalises the call.
- Live capture should sit directly underneath the recording status/control.
- Live capture includes transcript, AI notes, and evidence tabs, with transcript first and selected by default.
  - Live transcript must consume Deepgram Flux `Update` events to update the active message immediately, then persist exactly one row on `EndOfTurn`. `EagerEndOfTurn` can trigger speculative AI state checks; `TurnResumed` cancels speculative finalization for that turn.
- Recording replay belongs on the post-call surface, not the live call cockpit.
- Recording replay should be represented as a scrub bar with timestamp markers, not a fake waveform, until actual audio amplitude data exists. Replay controls need play/pause, position scrubber, and volume controls everywhere replay appears.
- Replay markers should jump to transcript, AI-note, and methodology evidence moments. Marker badges use the first letter of the required field or evidence category being answered, not a generic "Note" label.

## Live-Call Manual Controls

The frontend has a local manual coaching interaction model alongside live AI guidance.

State model:

- One manual question can be selected as the active cockpit question.
- The active manual question overrides the live-generated next best question until the seller marks it asked or selects another question.
- Asked question IDs are tracked locally for the active opportunity session.
- Deferred question IDs are tracked locally so skipped or too-soon recommendations stay out of the live card until the conversation naturally returns to them.
- Manual state resets when the active opportunity changes.

Controls:

- Mark asked records the currently displayed cockpit question as asked and clears it if it was a manual override.
- Softer requests lower-pressure wording for the same intent and can promote the AI-returned softer wording into the cockpit.
- Too soon parks the current intent for a better conversational moment.
- Skip deprioritizes the current recommendation unless the buyer naturally returns to it.

Backend AI wiring should treat these controls as seller feedback signals:

- Mark asked should become evidence that the seller asked or covered the intent.
- Use next is an internal feedback signal when seller-selected or softer wording is promoted into the cockpit.
- Too soon and Skip should lower that recommendation's priority for the current call unless conversation context makes it urgent again.

## Supported Playbooks

### MEDDICC

Fields:

- Metrics
- Economic Buyer
- Decision Criteria
- Decision Process
- Identify Pain
- Champion
- Competition

### MEDDPICC

Fields:

- Metrics
- Economic Buyer
- Decision Criteria
- Decision Process
- Paper Process
- Identify Pain
- Champion
- Competition

### BANT

Fields:

- Budget
- Authority
- Need
- Timeline

### Force Management / Command of the Message

Fields:

- Business Pain
- Required Capabilities
- Positive Business Outcomes
- Metrics
- Differentiation

Used for value messaging, business pain, required capabilities, positive business outcomes, metrics, and differentiation.

### SPIN Selling

Fields:

- Situation
- Problem
- Implication
- Need-payoff

Used for live discovery coaching and for detecting when a seller is staying too shallow.

### Sandler

Fields:

- Upfront Contract
- Pain
- Budget
- Decision Process
- Fulfillment
- Post-sell

Used for mutual expectations, pain, budget, decision process, fulfillment, and next commitment.

### The Challenger Sale

Fields:

- Commercial Insight
- Reframe
- Rational Drowning
- Emotional Impact
- New Way
- Unique Strengths
- Constructive Tension

Used for insight-led selling, reframing the customer's current thinking, creating constructive urgency, and connecting differentiated strengths to a customer-owned business case.

### Gap Selling

Fields:

- Current State
- Future State
- Gap
- Root Cause
- Impact
- Urgency
- Decision Criteria

Used for problem-centric discovery, diagnosing the distance between current and future state, and validating whether the business gap is urgent enough to solve.

### Value Selling

Fields:

- Business Issue
- Reasons
- Impact
- Required Capabilities
- Value
- Proof
- Mutual Plan

Used for customer value-led discovery, connecting business issues to measurable impact, required capabilities, proof, and a buyer-owned mutual value plan.

### Strategic Selling (Miller Heiman)

Fields:

- Economic Buying Influence
- User Buying Influence
- Technical Buying Influence
- Coach
- Win-Results
- Red Flags
- Response Mode
- Next Best Action

Used for complex stakeholder mapping, political deal strategy, buying influence coverage, red flag management, and next best action planning.

### SPICED (Winning by Design)

Fields:

- Situation
- Pain
- Impact
- Critical Event
- Decision
- Success Criteria

Used for recurring revenue qualification, tying the buyer's current situation and pain to business impact, urgency, decision alignment, and success criteria.

### Custom Framework

The Custom framework playbook remains labelled as `Custom framework`, but each workspace can give it its own display name and define:

- Required fields.
- Evidence standard.
- Live guidance.
- Exit criteria.

Saving the Custom framework writes a workspace-owned `playbooks` row with `slug = custom` and replaces its `playbook_fields` rows. The app still treats that row as the canonical `Custom framework` for opportunity and call selection even when the user-facing framework name is changed.

## Current Frontend Data Concepts

### Account Record

Editable account fields:

- Account name
- Website
- Industry
- Employee count
- Location
- Currency
- Current tools
- Strategic initiatives
- Competitors
- Account notes

Account fields should auto-populate from call evidence over time, but remain manually editable. Account currency controls how opportunity amounts are formatted across the app.

### Account AI Enrichment

Account creation and the Account Intelligence tab support AI Enrichment when the active workspace has a saved OpenAI key and the account has a name plus website/domain.

Behaviour:

- High-confidence public-source enrichment can fill blank core account fields only.
- Existing seller-entered account fields are never silently overwritten.
- Populated or lower-confidence fields appear as review suggestions in the enrichment run audit trail.
- Enrichment uses OpenAI Responses API web search with public/trusted source categories: official website, careers page, newsroom/blog, investor/filings where relevant, business registry, public news, jobs/ATS pages, review/customer sentiment sites, public technographic references, and government procurement portals.
- Review/customer sentiment enrichment is source-aware and no-extra-API in V1: OpenAI web search should check first-party customer proof, Trustpilot/G2/Google Maps public profile presence where discoverable, Reddit/forums, Product Hunt, app stores, and software marketplaces when relevant. These are treated as high-level source signals, not scraped review databases.
- Review/customer sentiment outputs must summarize broad themes, source presence, confidence, and source URLs where available. They must not quote raw review text, imply API-level completeness, or rely on private, paywalled, scraped, or unsourced sentiment.
- Each enrichment run is recorded in `account_enrichment_runs`; the latest editable sales signals live in `account_enrichment_profiles`.
- Enriched sales signals are editable free-text fields: business summary, buying triggers, strategic priorities, tech stack, hiring/growth signals, recent news, procurement/government signals, review/customer sentiment, likely stakeholders, discovery angles, risk flags, source notes, confidence, and last enriched date.
- Live guidance receives `accountEnrichmentProfile` inside account record context. These signals shape wording, timing, specificity, and flow, but they do not complete methodology evidence by themselves.

### Opportunity Record

Editable opportunity fields:

- Opportunity name
- Stage
- Amount, formatted using the parent account currency
- Close date
- Source
- Frameworks
- Next step
- Pain
- Decision process
- Manual notes

### Opportunity Intelligence

Generated or derived fields:

- Next-call brief
- Next best question
- Question reason
- Methodology coverage
- Missing required fields
- Weak evidence fields
- Risks
- Stakeholders
- Transcript evidence
- AI notes

### Next-call Brief

If the opportunity has previous call history, the Intel page should show a Next-call brief.
Post-call output actions should link to this existing brief with a "View next-call brief" action rather than implying a new brief needs to be prepared.

Fields:

- Previous call
- Objective
- Suggested opening
- Focus questions
- Missing evidence
- Risk notes
- Recommended next step

Every seeded opportunity has a sample next-call brief so the visual layout can be evaluated.

## Recommended Supabase Schema

This should be treated as the database design starting point, not a final migration.

### Core

- users
  - id
  - email
  - name
  - created_at
- workspaces
  - id
  - name
  - default_currency
  - owner_user_id
  - created_at
- workspace_members
  - id
  - workspace_id
  - user_id
  - role
  - created_at

### CRM-Like Records

- accounts
  - id
  - workspace_id
  - name
  - website
  - industry
  - employee_count
  - region (displayed as Location in the app)
  - currency
  - owner_user_id
  - current_tools
  - strategic_initiatives
  - competitors
  - notes
  - created_at
  - updated_at
- opportunities
  - id
  - workspace_id
  - account_id
  - name
  - stage
  - amount
  - close_date
  - owner_user_id
  - source
  - pain
  - decision_process
  - next_step
  - manual_notes
  - coverage_score
  - missing_count
  - weak_count
  - created_at
  - updated_at

### Playbooks And Fields

- playbooks
  - id
  - workspace_id nullable for system playbooks
  - name
  - description
  - is_system
  - created_at
- playbook_fields
  - id
  - playbook_id
  - label
  - description
  - evidence_standard
  - sort_order
- opportunity_playbooks
  - id
  - opportunity_id
  - playbook_id
  - created_at
- opportunity_field_evidence
  - id
  - opportunity_id
  - playbook_field_id
  - status: missing, asked, weak, confirmed
  - value
  - evidence_summary
  - source_call_id
  - source_transcript_segment_id
  - updated_at

### Calls

- calls
  - id
  - workspace_id
  - account_id
  - opportunity_id
  - title
  - call_type
  - status
  - started_at
  - ended_at
  - duration_seconds
  - recording_url
  - audio_preflight jsonb
  - audio_source_summary jsonb
  - guidance_readiness jsonb
  - retention_expires_at
  - created_by_user_id
- call_playbooks
  - id
  - call_id
  - playbook_id
- call_speakers
  - id
  - call_id
  - label
  - display_name nullable
  - role: seller, customer, customer_2, unknown
- transcript_segments
  - id
  - call_id
  - speaker_id
  - start_ms
  - end_ms
  - text
  - openai_item_id nullable
  - openai_segment_id nullable
  - audio_source_kind
  - client_turn_id
  - turn_sequence
  - transcription_delay
  - quality_flags jsonb
  - created_at
- call_notes
  - id
  - call_id
  - note_type
  - text
  - source_transcript_segment_id nullable
  - created_at

### AI Outputs

- live_guidance_events
  - id
  - call_id
  - opportunity_id
  - recommended_question
  - target_playbook_field_id nullable
  - reason
  - selected_call_type
  - selected_playbooks jsonb
  - covered_intents jsonb
  - missing_gaps jsonb
  - ui_mode
  - conversation_state jsonb
  - candidate_scores jsonb
  - source_turn_ids jsonb
  - guidance_latency_ms
  - created_at
- next_call_briefs
  - id
  - opportunity_id
  - previous_call_id nullable
  - objective
  - suggested_opening
  - focus_questions jsonb
  - missing_evidence jsonb
  - risk_notes jsonb
  - recommended_next_step
  - created_at
- post_call_outputs
  - id
  - call_id
  - follow_up_email
  - next_call_plan
  - account_updates jsonb
  - opportunity_updates jsonb
  - missing_info jsonb
  - created_at

### Research And Settings

- seller_research_profiles
  - id
  - workspace_id
  - user_id
  - seller_company
  - seller_domain
  - product_context
  - updated_at
- customer_research_runs
  - id
  - call_id
  - account_id
  - opportunity_id
  - enabled
  - customer_contact
  - customer_role
  - seller_company
  - seller_domain
  - product_context
  - trusted_sources jsonb
  - research_summary
  - question_angle
  - created_at
- user_ai_settings
  - id
  - user_id
  - openai_api_key_encrypted
  - key_last_four
  - created_at
  - updated_at

## OpenAI Services

Model choices should be revalidated against current official OpenAI API docs before model selection is finalized.

Expected AI services:

- Deepgram Flux live transcription, turn detection, EOT confidence, word confidence, and streaming diarization metadata.
- Speaker diarization or speaker role assignment. Browser V1 captures meeting/tab audio and seller microphone separately where possible, uses source streams for instant labels, uses Deepgram speaker metadata where available, runs `/api/openai/speaker-attribution` only as a text-based Seller/Customer/Customer 2/Customer 3 role classifier with confidence, keeps low-confidence rows editable, and reprocesses the saved transcript during `/api/openai/post-call-outputs` for post-call speaker correction. iPhone Safari and in-person meetings use one-channel room capture; the seller must keep Safari open and the device awake, and speaker labels should be treated as lower-confidence because seller and customer audio arrive in one stream.
- Sellers do not need to record an onboarding voice sample to begin. Live calls use call-scoped provisional labels (`Speaker 1`, `Speaker 2`, `Seller`, `Customer`) and a cockpit speaker map where the seller can rename a speaker to a person or mark that speaker as `Me`. These aliases update the visible transcript and future live lines for the active call, persist to the call speaker row, and are not treated as cross-call biometric voice references.
- Live intent detection against selected playbook fields.
- Next best question generation.
- AI notes.
- Account field extraction.
- Opportunity field extraction.
- Methodology field evidence updates.
- Follow-up email generation.
- Next-call brief generation.
- Optional customer research synthesis from fixed trusted sources.

Rules:

- Use the user's own OpenAI API key for all AI services.
- Store OpenAI API keys per workspace. Creating a new workspace must not inherit, show, or silently reuse the key from another workspace; the seller must connect a key for that workspace before AI workflows can run.
- Require a saved OpenAI API key during first-run workspace setup, new account setup, and Start Call setup before any AI-dependent workflow can begin.
- Keep OpenAI key handling server-side.
- Do not expose OpenAI keys to the browser except during the seller's setup/settings entry flows.
- Store encrypted key metadata only.
- Keep user-visible model/provider copy generic unless the selected model is confirmed in current OpenAI docs.

## Recording And Retention

- Store call recording.
- Default retention: 90 days.
- Recording metadata should live on the call record.
- Actual recording file storage could be Supabase Storage or another storage layer chosen during storage implementation.
- The call cockpit replay UI should use a scrub bar with evidence markers. Only render a true waveform if the recording service stores or computes real audio amplitude data.

## Integrations Roadmap

Not included in the first tester release:

- CRM writeback.
- Manager/admin views.
- Native Zoom, Google Meet, or Microsoft Teams bot.

Roadmap:

- CRM sync for accounts, opportunities, fields, and activities.
- Meeting platform integrations for improved speaker identification and capture.
- Bot-based participant identity mapping.

## Search And Filtering Behaviour

The front end uses a shared fuzzy search helper for workspace search and page-level filtering.

Current searchable surfaces:

- Header workspace search for accounts, opportunities, calls, and playbooks.
- Home Opportunity focus table.
- Account page opportunity tab.
- Opportunities page, including stakeholder view.
- Calls library.
- Playbooks landing page.
- Live cockpit rail for notes, evidence, and transcript.

Search should match forgiving partial text, typo-like subsequences, stakeholder names, methodology fields, statuses, account context, opportunity context, and call metadata where available.

Filtering conventions:

- Opportunity coverage filters use the same app-wide thresholds: low 0-33%, medium 34-66%, high 67-100%.
- Needs attention means coverage below 65% or five or more missing fields.
- Opportunities can be sorted by gaps, coverage, value, or close date.
- Calls can be filtered by call type and status.
- Playbooks can be filtered by use case.

Database-backed search should preserve the same behaviour while moving larger datasets to server-side ranking and indexed fields.

## Implementation Notes

- Main app composition and page-level UI still live in `src/App.tsx`.
- Shared product/domain types and constants live in `src/lib/salesframe-core.ts`.
- Static framework reference metadata for the playbook pages lives in `src/data/playbook-reference-data.tsx`; live sales guidance is generated by OpenAI-backed functions.
- Static navigation/page copy lives in `src/data/navigation-content.ts`.
- Live call guidance, methodology scoring, conversation-flow judgement, sentiment/mood handling, and alternative questions are generated by OpenAI-backed Netlify Functions and persisted to Supabase. The browser must not generate deterministic next-best questions.
- Playbook parsing, fuzzy search, record factories, manual coaching helpers, research-profile helpers, and OpenAI key metadata helpers live in focused `src/lib/*` modules.
- Sidebar navigation lives in `src/components/app-sidebar.tsx`.
- Account sidebar hierarchy lives in `src/components/nav-projects.tsx`.
- Front-end account, opportunity, call, workspace, playbook assignment, customer research, and seller research profile state is loaded from Supabase.
- Create/edit/delete flows for workspaces, accounts, and opportunities write to Supabase and refresh the active workspace.
- Inline account and opportunity editable fields save back to Supabase through explicit Save changes actions so sellers can review edits before committing them.
- Custom framework playbook edits save to the active workspace's Supabase playbook record and field rows, with browser cache used only to preserve in-progress edits.
- The Start Call flow creates missing account/opportunity rows, attaches selected playbooks, creates an active call row, optionally persists customer research settings, and opens the call cockpit.
- Workspaces show a first-run setup modal until `workspaces.onboarding_completed_at` is set. The modal is a compact multi-step flow for workspace details, seller company context, and a mandatory OpenAI API key that is scoped to the active workspace, with a direct link to `https://platform.openai.com/api-keys`.
- Settings OpenAI key save calls a Netlify Function. The raw key is encrypted server-side and stored in `user_ai_settings` for the active workspace; the browser only receives masked status metadata.
- Auth uses Supabase Auth in the browser via `src/lib/supabase/client.ts`. Supabase manages persisted browser sessions; the app maps the Supabase user into the seller profile shape.
- Supabase email signups require email confirmation and use the branded confirmation template at `supabase/templates/confirmation.html`. Password reset emails use `supabase/templates/recovery.html`. Both templates follow the public homepage identity, not the in-app dashboard: minimal black/white styling, SalesFrame wordmark, waveform mark, homepage-style welcome copy, and Supabase `{{ .ConfirmationURL }}` links.
- Supabase frontend env values live in `.env.local` for local development. The direct Postgres connection string must stay server-side only and should not be committed or shipped to the browser.
- Supabase local project config lives in `supabase/config.toml`.
- Database foundation migrations live in `supabase/migrations/*` and cover user profiles, workspaces, workspace members, accounts, opportunities, playbooks, calls, transcript segments, notes, methodology evidence, AI outputs, research profiles, encrypted-key metadata, RLS policies, and private storage buckets.
- Type-safe Supabase access lives in `src/lib/supabase/database.types.ts`, `src/lib/supabase/salesframe-data.ts`, and `src/hooks/use-salesframe-data.ts`.
- Supabase-to-UI mapping lives in `src/lib/supabase/salesframe-adapters.tsx`.
- Browser-to-function calls live in `src/lib/server-functions.ts`.
- Netlify Functions live in `netlify/functions/*`:
  - `/api/openai/key` manages encrypted OpenAI key save/status/delete.
  - `/api/deepgram/token` authorizes the signed-in seller against the call and mints a short-lived Deepgram Flux token for live transcription. The raw Deepgram key stays server-side.
  - `/api/openai/speaker-attribution` labels final transcript segments as Seller, Customer, Customer 2, or Customer 3 using source stream hints, turn-taking, and recent transcript context.
  - `/api/openai/customer-research` generates and stores customer research using fixed trusted source guidance.
  - `/api/openai/post-call-outputs` first performs a post-call speaker correction pass, then generates and stores follow-up email, next-call plan, missing info, opportunity/account updates, and next-call brief.
- Function environment variables are documented in `.env.example` and `docs/netlify-env-setup.md`. Netlify must set `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_KEY_ENCRYPTION_SECRET`; `/api/system/env?workspaceId=<workspace-id>` reports missing configuration without exposing secret values and is restricted to authenticated workspace owners.
- The hosted Supabase migrations were applied and verified via the IPv4 transaction pooler connection on 2026-06-27.
- Workspace onboarding migration `202606270004_workspace_onboarding.sql` adds `workspaces.onboarding_completed_at` so first-run setup can be tracked per workspace.
- The app currently uses shadcn-style components and lucide-react icons.
- Button behaviour rule: visible actions should either perform a front-end state change or be hidden until they are usable.
- Current front-end action state:
  - New Opportunity opens the Add Opportunity modal.
  - Filter reset buttons clear active search/filter/sort state.
  - Replay and Review select a call and update the call-library detail panel.
  - Call replay markers, skip controls, and play/pause update replay state.
  - Custom framework configuration lets users rename the custom framework, add/remove required fields, add/remove exit criteria, and save the active workspace configuration.
  - Asked, Too soon, Softer, and Skip update local manual-coaching state with visible feedback and pass seller feedback into the next live-guidance request.
  - Save Key stores/removes encrypted OpenAI key material through Netlify Functions; no raw key is persisted in the browser.
  - Login, signup, forgot password, and logout call Supabase Auth. Legal links route to the production Terms and Privacy pages.
  - Sidebar top workspace selector supports Supabase-backed workspace switching, create workspace modal, edit workspace modal, duplicate workspace, and guarded delete workspace.
  - Sidebar footer account menu routes Account to a separate personal profile page for seller identity, workspace access, and guarded account deletion; Settings remains for OpenAI key, capture, retention, and product configuration.
  - Personal Account CSV import is an interaction-gated lazy workflow: keep CSV parsing and the import dialog out of the everyday app shell until the seller opens Import accounts or Import opportunities.
  - Billing, notifications, and upgrade stay hidden until billing and notification systems exist.
  - Settings capture switches show `One-channel microphone capture` and `Two-channel mic + system audio` as active browser modes, with the Start Call modal also showing a disabled `Meeting bot` option for hosted bot integrations.
  - Two-channel capture requests app/window/tab/system audio where the browser supports it. SalesFrame treats the shared audio track as the customer side and the microphone stream as the seller side; it does not send or record display video.
  - Two-channel preflight shows a plain status: `Customer audio detected: start call.` when the shared source returns customer audio, or `Native app audio is not available through this browser. Use browser-based Zoom/Teams/Meet, one-channel mode, or install SalesFrame Audio Connector.` when the selected native app/window does not expose audio.
  - Non-settings pages render loading, empty, error, and permission-denied states so async data boundaries can reuse the same UI.
  - Loading, empty, error, permission, onboarding, and zero-state surfaces must follow `docs/design-language-states.md` so the app keeps the same human voice as the public homepage.
- Sidebar context menu rule:
  - Open Account navigates to the account record.
  - Edit Account Fields opens a modal over the current page and saves seller-owned account fields without navigating.
  - Open Opportunity navigates to the opportunity record.
  - Edit Opportunity Fields opens a modal over the current page and saves seller-owned opportunity fields without navigating.
  - Account and opportunity intelligence remain separate from editable record fields.

## Frontend Readiness Checklist After Supabase Wiring

The current front end has the first Supabase/Netlify wiring pass in place, with a short readiness list before broader production rollout.

Close or intentionally scope these gaps before broader production rollout:

1. Continue auditing action buttons as new UI is added.
   - Current known dead-looking actions have been converted to front-end behaviour or hidden states.
2. Continue expanding selected-call and post-call detail views as real call records, recordings, transcript timestamps, and generated outputs become available.
3. Expand frontend states once real endpoint boundaries exist.
   - App-level loading, empty, error, and permission-denied states are implemented for async data boundaries.
   - Data wiring should add narrower inline states for individual async panels such as transcript streaming, customer research, and post-call generation.
4. Add unsaved-change and destructive-close handling for multi-step modal flows.
   - Start Call and Create Account already prevent accidental backdrop dismissal, but they do not warn when cancelling after entering data.
5. Continue testing the first-run empty-workspace path as account and opportunity creation flows are exercised against the real project.
6. Add responsive QA pass for mobile/tablet.
   - The layout is responsive, but the full workflow still needs explicit small-screen testing.
7. Continue splitting page/view components out of `src/App.tsx`.
   - Backend-facing data, types, storage helpers, search, record factories, and live guidance logic have been moved into `src/data/*` and `src/lib/*`.
   - Remaining work is mostly UI-section extraction: account pages, opportunity pages, call cockpit, settings, and modal flows.

## Remaining Backend Priorities

1. Add Netlify deploy environment variables and verify the functions in a Netlify preview deploy.
2. Continue hardening live guidance events against persisted transcript/evidence updates.
3. Add function-level tests once endpoint payloads stabilise.
4. Add CRM sync only after account/opportunity field behaviour is proven.
