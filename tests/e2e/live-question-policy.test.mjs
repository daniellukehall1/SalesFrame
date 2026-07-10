import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { Buffer } from "node:buffer"
import { test } from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function importLiveQuestionPolicy() {
  const source = await readFile(new URL("src/lib/live-question-policy.ts", root), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("live question context keeps short human answers without keeping filler", async () => {
  const { shouldIncludeLiveTranscriptLine } = await importLiveQuestionPolicy()

  for (const text of ["Yes", "Not really", "By Q4", "Sarah does", "No budget yet", "Why now?"]) {
    assert.equal(shouldIncludeLiveTranscriptLine({ isPartial: false, text }), true, text)
  }

  assert.equal(shouldIncludeLiveTranscriptLine({ isPartial: false, text: "um" }), false)
  assert.equal(shouldIncludeLiveTranscriptLine({ isPartial: true, text: "Yes" }), false)
  assert.equal(
    shouldIncludeLiveTranscriptLine({ isPartial: false, text: "Legal owns", wordConfidence: 0.82 }),
    true
  )
})

test("only explicit recovery conditions bypass the fast state gate", async () => {
  const {
    liveCoachForcedRefreshTurnThreshold,
    shouldForceLiveQuestionRefresh,
  } = await importLiveQuestionPolicy()
  const base = {
    feedbackChanged: false,
    hasGuidance: true,
    refreshRequested: false,
  }

  assert.equal(liveCoachForcedRefreshTurnThreshold, 4)
  assert.equal(shouldForceLiveQuestionRefresh(base), false)
  assert.equal(
    shouldForceLiveQuestionRefresh({ ...base, feedbackChanged: true }),
    true
  )
  assert.equal(
    shouldForceLiveQuestionRefresh({ ...base, hasGuidance: false }),
    true
  )
  assert.equal(
    shouldForceLiveQuestionRefresh({ ...base, refreshRequested: true }),
    true
  )
})

test("a model hold decision preserves the exact visible question", async () => {
  const { shouldKeepCurrentLiveQuestion } = await importLiveQuestionPolicy()
  const lifecycle = {
    currentQuestionState: "active",
    shouldReplaceQuestion: false,
    stabilityRecommendation: "hold",
  }

  assert.equal(
    shouldKeepCurrentLiveQuestion({
      currentQuestion: "What is making that difficult today?",
      lifecycle,
      mustReplacePreviousQuestion: false,
    }),
    true
  )
  assert.equal(
    shouldKeepCurrentLiveQuestion({
      currentQuestion: "What is making that difficult today?",
      latestFeedbackAction: "asked",
      lifecycle,
      mustReplacePreviousQuestion: false,
    }),
    false
  )
  assert.equal(
    shouldKeepCurrentLiveQuestion({
      currentQuestion: "What is making that difficult today?",
      lifecycle: { ...lifecycle, currentQuestionState: "answered", stabilityRecommendation: "replace" },
      mustReplacePreviousQuestion: true,
    }),
    false
  )
})

test("answered intents cannot produce a contradictory hold decision", async () => {
  const { normalizeLiveQuestionDecision } = await importLiveQuestionPolicy()
  const result = normalizeLiveQuestionDecision({
    evidenceCommit: { answeredCurrentIntent: true },
    mustReplacePreviousQuestion: false,
    questionLifecycle: {
      currentQuestionState: "active",
      shouldReplaceQuestion: false,
      stabilityRecommendation: "hold",
    },
  })

  assert.equal(result.mustReplacePreviousQuestion, true)
  assert.equal(result.questionLifecycle.currentQuestionState, "answered")
  assert.equal(result.questionLifecycle.shouldReplaceQuestion, true)
  assert.equal(result.questionLifecycle.stabilityRecommendation, "replace")
})

test("terminal intent states cannot be silently downgraded", async () => {
  const { resolveLiveIntentStatusTransition } = await importLiveQuestionPolicy()

  assert.equal(resolveLiveIntentStatusTransition("confirmed", "weak_evidence"), null)
  assert.equal(resolveLiveIntentStatusTransition("answered", "asked"), null)
  assert.equal(resolveLiveIntentStatusTransition("do_not_repeat_this_call", "confirmed"), null)
  assert.equal(resolveLiveIntentStatusTransition("parked", "answered"), "answered")
  assert.equal(resolveLiveIntentStatusTransition("answered", "confirmed"), "confirmed")
})
