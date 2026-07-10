# Live question engine

## Product objective

SalesFrame should help the seller make the best natural next move while selected sales methodologies remain strict background evidence systems. The visible card is not a rotating checklist. It should change only when the conversation creates a material reason to change it.

## Active pipeline

1. Deepgram Flux produces ordered final turns with source and confidence metadata.
2. The client retains meaningful short answers, removes filler and partial turns, and builds a chronological transcript window.
3. `live-state` uses `gpt-5.4-nano` with reasoning disabled to classify flow and decide whether the current card needs a full refresh.
4. Transcript turns and periodic audits go through `live-state`; explicit seller feedback, missing guidance and a queued superseded request can call `live-question` immediately. A four-turn watchdog calls the full lane only if the fast state request fails.
5. `live-question` uses `gpt-5.4-mini` with reasoning disabled and low verbosity to commit evidence, apply selected playbooks and choose one seller move.
6. A deterministic stability gate preserves the exact current card whenever the model returns `hold`.
7. Answered, weak, parked and blocked intent memory is validated against final server-side transcript rows and committed before the response. A request whose transcript watermark is already stale cannot overwrite newer call memory.

Both OpenAI request paths use strict structured output, prompt-injection defenses and `store: false` because call transcripts and opportunity context are sensitive.

## Model decision

Keep the two-lane `gpt-5.4-nano` and `gpt-5.4-mini` architecture for the production live path until a replay benchmark proves a better replacement. `gpt-5.4-nano` is explicitly designed for fast classification and ranking, which fits the flow-state gate. OpenAI's current catalog also lists the newer GPT-5.6 Sol, Terra and Luna variants. Benchmark `gpt-5.6-luna` at none/low reasoning as the latency candidate and `gpt-5.6-terra` at none/low as the quality-versus-cost candidate; use Sol only as an offline quality ceiling. Do not switch the live default from source-level claims alone: the winning model must improve question quality without missing the end-of-turn latency, hold-accuracy or stability gates.

Useful official references:

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/models/gpt-5.4-nano
- https://developers.openai.com/api/reference/resources/responses/methods/create

## Stability invariants

- Seller-only speech does not force a new question.
- Buyer turns also pass through the fast state gate, so backchannels and irrelevant detail cannot trigger a full regeneration on their own.
- Short answers such as “yes”, “not really”, “by Q4” and “Sarah does” remain in model context.
- A response anchored to an older transcript signature is never displayed.
- `hold` preserves the exact visible question, target and intent identity.
- Cosmetic paraphrasing is not a replacement reason.
- Partial answers become weak evidence; they do not automatically complete a methodology field.
- A deflected or badly timed intent is parked with a reason, re-entry cue, bridge and latest safe revisit moment.
- At most one high-value parked intent is recovered at a natural cue or before wrap-up.
- Confirmed evidence and completed intent states cannot be silently downgraded by a later model response.
- The playbooks assigned to the authorized call are the server-side source of truth.

## Evaluation gates

The repository now has executable deterministic tests for short-answer retention, seller-turn stability, known-buyer fast refresh and exact-card hold behavior. Model and acoustic quality still require consented or synthetic replay fixtures before their declared targets can be reported as measured results.

The release targets live in `tests/fixtures/live-call-evals.json` and cover latency, unnecessary replacement, stale display, evidence accuracy, question quality, short-answer recognition and parked-intent recovery.

Before changing the production model or prompt, replay the same conversations against both candidates and compare:

- buyer end-of-turn to visible decision, p50 and p95;
- hold accuracy and unnecessary replacement rate;
- same-intent repetition and stale-response display rate;
- methodology evidence precision and recall;
- partial-answer and deflection routing;
- parked-intent recovery success;
- naturalness, timing, information gain and answerability.
