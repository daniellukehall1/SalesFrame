# SalesFrame.ai

Hey there, nice to meet you.

SalesFrame helps sellers ask the better next question while the conversation is still happening.

Sales calls move quickly. Sellers are listening, thinking, taking notes, trying to follow the methodology, and still needing to sound like a real person. SalesFrame sits quietly beside them, reads the account and opportunity context, follows the live conversation, and gives them one calm next move.

No giant checklist. No robotic script. Just the next useful question.

## The Promise

SalesFrame is a real-time sales coach for B2B sellers.

It helps turn every call into a sharper conversation by bringing together:

- The account and opportunity the seller is working on.
- The playbooks the team already uses.
- The live conversation as it unfolds.
- What has already been answered, missed, or only weakly covered.
- The context that makes a question feel specific, natural, and timely.

The seller does not need fifty prompts. They need the one question that fits now.

## Why It Exists

Great sellers do not sound like they are working through a form.

They know when to listen, when to go deeper, when to soften, when to move on, and when to circle back before the call ends. SalesFrame is built to make that kind of coaching available in the moment, not only after the call is over.

It keeps the methodology discipline in the background, so the seller can stay present in the foreground.

## What SalesFrame Does

- Prepares the call with account, opportunity, and seller context.
- Helps teams create or import accounts and opportunities.
- Enriches account intelligence so discovery starts warmer.
- Supports the sales playbooks teams already trust, including MEDDICC, BANT, Sandler, Challenger, SPICED, SPIN, Gap Selling, Value Selling, Strategic Selling, Force Management, and custom frameworks.
- Captures the conversation live and turns it into a usable transcript.
- Shows one `Ask this next` recommendation in the call cockpit.
- Adapts when the buyer answers, pushes back, moves topic, or changes pace.
- Tracks playbook coverage without making the seller stare at a checklist.
- Creates post-call notes, evidence, follow-up, and next-call prep.

## The Seller Experience

1. Set up a workspace.
2. Add accounts and opportunities manually or by CSV.
3. Enrich the account so SalesFrame understands the company.
4. Choose the playbooks that match the team’s selling motion.
5. Start the call.
6. Let SalesFrame listen, reason, and guide.
7. Ask one better question at a time.
8. Leave the call with the work already shaped.

## What Makes It Different

Most sales tools become another screen to manage.

SalesFrame is designed to feel quieter than that. The cockpit is intentionally simple: one question, one short reason, and a few controls to move the coach along. The deeper methodology work still happens, but it does not take over the conversation.

That matters because sellers need confidence, not clutter.

## Built For

SalesFrame is built for:

- Account executives who want sharper live discovery.
- Founders selling complex deals.
- Sales leaders who want methodology adoption without script-reading.
- Revenue teams that care about coaching, consistency, and call quality.
- Teams that want better notes and evidence without turning calls into admin.

## Product Principles

SalesFrame should feel calm, premium, and useful.

- Clear next action.
- Human copy.
- Low visual noise.
- Methodology in the background.
- Natural conversation in the foreground.
- Honest loading and error states.
- Seller confidence over maximum visible data.

## For Developers

SalesFrame is a proprietary SaaS application deployed with Netlify and Supabase. Deepgram powers live transcription, and OpenAI powers research, enrichment, live coaching, and post-call intelligence.

For release confidence, the app includes Deepgram Flux live transcription and turn-taking, protected workspace data, AI coaching checks, and a production gate that keeps the essentials honest.

It also keeps OpenAI live guidance, account enrichment, research, and post-call outputs behind server-side controls.

Keep secrets out of GitHub. Store production credentials in Netlify and Supabase.

### Run Locally

Use Node 22.

```bash
corepack enable
pnpm install
pnpm dev
```

The local app usually runs at:

```text
http://127.0.0.1:5173
```

Create `.env.local` from `.env.example` and fill only the values needed for local development.

### Validation

Before treating a change as release-ready:

```bash
pnpm check
```

For smaller local checks:

```bash
pnpm lint
pnpm test
pnpm build
```

## Deployment

GitHub stores the code. Netlify deploys the app. Supabase stores auth, database, and recordings.

GitHub Actions runs `pnpm check` before a release should be treated as ready.

Production release notes and operational steps live in:

- `docs/deployment-runbook.md`
- `docs/production-smoke-checklist.md`

## Contact

Reach us:

```text
hello@salesframe.ai
```

## License

Proprietary software.

All rights reserved by ALLYCHAT PTY LTD.
