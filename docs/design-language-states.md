# SalesFrame State And Onboarding Design Language

This guide defines how SalesFrame should sound and look in empty states, onboarding steps, loading moments, permission states, and recoverable errors.

The goal is simple: the app should feel like a calm sales coach, not a manual, not a system log, and not a fragile prototype.

## Voice Anchor

The public homepage sets the tone:

```text
Glad you stopped in.
SalesFrame is built to help you sell.
Now, where do you want to start?
```

Inside the app, use the same style:

- Plain spoken language.
- Short sentences.
- A little warmth.
- Clear next action.
- No panic.
- No internal implementation words.

SalesFrame should sound like someone sitting beside the seller saying, "I have you. Here is the next useful thing."

## Copy Principles

1. Name what is happening in human language.
   - Use: "Getting this workspace ready"
   - Avoid: "Loading workspace data"

2. Give the seller a next move.
   - Use: "Start with one account. SalesFrame will build the selling context around it as calls and opportunities come in."
   - Avoid: "No accounts exist."

3. Keep errors recoverable.
   - Use: "Something got stuck. Give it another try."
   - Avoid: "Error state" or raw backend messages.

4. Be specific without becoming technical.
   - Use: "We are checking your OpenAI connection so the first question is ready."
   - Avoid: "Validating API response schema."

5. Do not over-explain live moments.
   - In the call cockpit, one short sentence is enough.
   - Detail belongs behind tabs or help surfaces.

6. Never use placeholder or internal QA language in production UI.
   - Avoid: "Empty state", "Permission state", "The seller needs a clear retry path", "not configured yet", "coming soon", "being prepared".

7. Match the control to the real behavior.
   - Use a toggle only for a persistent setting or a mode that stays on when the user leaves and comes back.
   - Use a button for one-time work like "Run enrichment", "Refresh research", "Import accounts", or "Start call".
   - Never pair a toggle with a button when both appear to perform the same job.

## State Patterns

### Empty States

Empty states should feel like a starting line, not a dead end.

Structure:

```text
Title: Nothing here yet
Body: Start with one account. SalesFrame will build the selling context around it as calls and opportunities come in.
Primary action: Create account
Secondary action: Import accounts
```

Rules:

- Lead with the useful title. Avoid decorative eyebrow/brow labels above page and state titles.
- Explain what belongs here.
- Tell the user the first useful action.
- Keep it calm and concrete.
- Prefer one primary action and one secondary action.

Examples:

```text
No calls yet
Start your first call when you are ready. SalesFrame will save the transcript, notes, and follow-up once the conversation is done.
```

```text
No opportunities yet
Add the deal you are working on, then SalesFrame can track the playbook gaps as calls happen.
```

### Loading States

Loading states should explain what is happening now. Avoid generic spinners where the user is waiting on meaningful setup.

Structure:

```text
Title: Getting your live coach ready
Body: We are lining up the account context, first question, and audio capture before the cockpit opens.
Progress steps:
- Checking the AI coach
- Linking the right records
- Reading opportunity history
- Warming up AI coach
- Preparing audio
```

Rules:

- Use skeletons for normal page transitions.
- Use progress plus contextual copy for multi-step actions.
- Avoid vague "Loading..." unless space is extremely tight.
- If the wait could feel long, say what is happening now.

### Motion And Micro-Interactions

Motion should feel like calm confirmation, not decoration.

Rules:

- Use motion to confirm an action, preserve context, guide attention, or show live system activity.
- Keep everyday interactions fast: hover, press, focus, and form feedback should be near-instant.
- Keep menus and popovers crisp. They should appear quickly and never feel like they are delaying work.
- Dialogs and sheets can be slightly slower, but still under 300ms.
- Avoid bounce, elastic movement, oversized slides, flashing, or animations that run forever.
- Reserve expressive motion for rare setup or milestone moments.
- Always respect reduced-motion preferences.

Approved patterns:

```text
Button press: subtle compression
Menu open: quick fade/scale
Step change: short fade/translate
Live question changed: one brief highlight
Transcript line added: quiet fade-in
Audio health active: gentle pulse
```

Avoid:

```text
Permanent shimmer
Celebration effects in daily workflows
Animating entire page layouts
Motion that makes the user wait
Multiple competing animations at once
```

### Error States

Error states should protect confidence. They should not sound like blame.

Structure:

```text
Title: This workspace needs another moment
Body: Give it another try. If it keeps happening, settings can help confirm the connection is still in shape.
Primary action: Try again
Secondary action: Open settings
```

Rules:

- Say what did not work.
- Say what is still safe or saved when relevant.
- Offer the shortest recovery path.
- Hide raw technical detail unless the user opens a diagnostic detail view.

### Permission States

Permission states should orient the user without sounding accusatory.

Example:

```text
Workspace access
This workspace is out of reach
You are signed in, but this workspace is not available to your account. Check settings or switch back to a workspace you can access.
```

Rules:

- Do not say "denied" as the main emotional headline unless it is a browser permission prompt.
- Explain what the user can do next.

### Onboarding Copy

Onboarding should sound like a setup conversation.

Use:

```text
Company context
This helps Seller Research and live questions connect the buyer's world to what you sell.
```

Avoid:

```text
Input company metadata for AI processing.
```

Rules:

- Say why the field matters.
- Keep helper text to one sentence.
- Do not repeat the field label in the description.
- When a field is required, explain the outcome, not the database rule.

### Live Call Zero States

The cockpit must stay calm. Empty live areas should feel ready, not broken.

Use:

```text
Notes will land here as the call gets going.
Evidence will appear as the conversation answers playbook fields.
The transcript will appear here as people speak.
```

Avoid:

```text
Waiting for AI notes.
Waiting for call evidence.
No transcript lines available.
```

## Illustration And Visual Rules

Use brand-consistent, restrained visuals:

- SalesFrame waveform mark for global app, auth, onboarding, and system recovery.
- Lucide icons for small state cards and action context.
- Account logo avatars for account-related states when a domain exists.
- Simple geometric empty-state illustrations using app UI primitives, not decorative cartoons.
- Rounded squares for logos and system marks.
- No unnecessary pill labels.
- No big decorative gradients, orbs, mascots, or marketing-style illustrations inside the app.

Zero-state illustration recipe:

```text
Container: unframed or one simple shadcn card
Icon: 40px rounded square, muted background
Title: direct and human
Body: one or two short sentences
Actions: primary + secondary
Detail: optional compact context tiles below, only if useful
```

## Current QA Findings

Checked surfaces:

- Seller dashboard loading skeleton.
- Workspace switch skeleton.
- Workspace loading, empty, error, and permission state copy.
- First-run workspace onboarding modal.
- Start Call preparation progress.
- Live capture notes, evidence, and transcript zero states.
- App crash recovery boundary.
- CSV import modal copy.
- Login and signup copy.

Green:

- The homepage voice is clear and distinctive.
- Skeleton loading is visually aligned with shadcn and avoids spinners.
- Start Call already uses a contextual progress bar rather than a generic loading state.
- App recovery has a useful action and does not expose stack traces.
- Live capture areas are visually restrained.

Improved in this pass:

- Auth loading copy now avoids raw provider wording.
- Workspace loading, empty, error, and permission copy now uses human language.
- Start Call preparation copy now explains what is happening in seller terms.
- Live notes, evidence, and transcript zero states now feel ready rather than stuck.

Needs future polish:

- Login and signup are still close to stock shadcn copy. They should move closer to the homepage voice.
- CSV import errors are clear, but still a little utility-like. They should stay precise, but use friendlier phrasing where possible.
- Backend errors should be mapped before display so users never see schema, table, function, or provider jargon.
- Some diagnostic copy in coach detail tabs is intentionally technical today; keep it hidden from the primary live moment.

## Approved Copy Swaps

Use this table when replacing generic state language.

| Situation | Avoid | Use |
| --- | --- | --- |
| Workspace loading | Loading workspace data | Getting this workspace ready |
| New workspace | Empty state / Fresh workspace | Nothing here yet |
| No accounts | No accounts yet | Nothing here yet |
| Data failure | Error state | Something got stuck |
| Permission | Permission denied | This workspace is out of reach |
| Live notes | Waiting for AI notes | Notes will land here as the call gets going |
| Live transcript | Transcript will appear as the call runs | The transcript will appear here as people speak |
| Long setup | Loading... | Getting your live coach ready |

## Build Checklist

Before adding a new empty, loading, error, permission, onboarding, or zero-state screen:

- Does the title sound like a person would say it?
- Does the body explain what happens next?
- Is there one obvious primary action?
- Does it avoid raw provider names unless the provider is the thing the user must configure?
- Does it avoid "state", "failed", "not configured", "schema", "table", "endpoint", "payload", and "later" in user-facing copy?
- Does the visual use the waveform mark, a relevant Lucide icon, or an account logo avatar?
- Does it avoid decorative pills and extra labels?
- Does it stay calm on mobile?
- Can the same component work in light and dark mode?

## Product Principle

Strict selling methodology in the background. Natural human conversation in the foreground.

The same applies to the interface: rigorous system behavior underneath, calm and useful language on the surface.
