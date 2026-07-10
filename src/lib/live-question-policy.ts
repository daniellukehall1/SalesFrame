export const liveCoachForcedRefreshTurnThreshold = 4

export type LiveQuestionLifecyclePolicy = {
  currentQuestionState?: string
  shouldReplaceQuestion?: boolean
  stabilityRecommendation?: string
}

export type LiveIntentLedgerStatusPolicy =
  | "missing"
  | "suggested"
  | "asked"
  | "weak_evidence"
  | "answered"
  | "confirmed"
  | "parked"
  | "do_not_repeat_this_call"
  | "dropped"

export type LiveQuestionDecisionPolicy = {
  evidenceCommit: {
    answeredCurrentIntent: boolean
  }
  mustReplacePreviousQuestion: boolean
  questionLifecycle: {
    currentQuestionState: "active" | "asked" | "answered" | "stale" | "parked" | "revisit_before_close" | "dropped"
    shouldReplaceQuestion: boolean
    stabilityRecommendation: "hold" | "replace" | "park" | "recover"
  }
}

export type LiveTranscriptPolicyLine = {
  endOfTurnConfidence?: number
  isPartial?: boolean
  speaker?: string
  speakerLabel?: string
  text?: string
  wordConfidence?: number
}

const shortAnswerPattern = /^(?:absolutely|correct|exactly|maybe|no|nope|not really|probably|right|sometimes|sure|yes|yeah|yep|we do|we don't|we dont|we have|we haven't|we havent|we are|we aren't|we arent|i do|i don't|i dont|i have|i haven't|i havent|it is|it isn't|it isnt|they do|they don't|they dont)(?:\b|$)/i
const fillerOnlyPattern = /^(?:ah|er|erm|hmm+|hm+|mm+|mhm|oh|uh|uh-huh|um|you know)[.!?…]*$/i
const questionPattern = /^(?:can|could|did|do|does|had|has|have|help me understand|how|is|tell me|walk me through|was|were|what|when|where|which|who|why|would)\b/i

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

export function shouldIncludeLiveTranscriptLine(line: LiveTranscriptPolicyLine) {
  const text = normalizedText(line.text)
  if (!text || line.isPartial) return false
  if (fillerOnlyPattern.test(text)) return false

  const wordCount = text.split(/\s+/).length
  if (wordCount >= 4) return true
  if (shortAnswerPattern.test(text) || questionPattern.test(text) || /[?？]\s*$/.test(text)) return true
  if (wordCount >= 2) return true
  if (/\d/.test(text) || /^\p{Lu}[\p{L}\p{N}-]{2,}$/u.test(text)) return true

  const wordConfidence = typeof line.wordConfidence === "number" ? line.wordConfidence : 0
  const endOfTurnConfidence = typeof line.endOfTurnConfidence === "number" ? line.endOfTurnConfidence : 0

  return wordConfidence >= 0.78 || endOfTurnConfidence >= 0.78
}

export function shouldForceLiveQuestionRefresh({
  feedbackChanged,
  hasGuidance,
  refreshRequested,
}: {
  feedbackChanged: boolean
  hasGuidance: boolean
  refreshRequested: boolean
}) {
  return feedbackChanged ||
    refreshRequested ||
    !hasGuidance
}

export function normalizeLiveQuestionDecision<T extends LiveQuestionDecisionPolicy>(result: T): T {
  const lifecycle = result.questionLifecycle
  const currentQuestionState = result.evidenceCommit.answeredCurrentIntent
    ? "answered"
    : lifecycle.currentQuestionState
  const lifecycleRequiresReplacement =
    lifecycle.shouldReplaceQuestion ||
    lifecycle.stabilityRecommendation !== "hold" ||
    currentQuestionState === "answered" ||
    currentQuestionState === "stale" ||
    currentQuestionState === "parked" ||
    currentQuestionState === "revisit_before_close" ||
    currentQuestionState === "dropped"
  const shouldReplaceQuestion = result.mustReplacePreviousQuestion || lifecycleRequiresReplacement
  const stabilityRecommendation = shouldReplaceQuestion
    ? lifecycle.stabilityRecommendation === "park" || lifecycle.stabilityRecommendation === "recover"
      ? lifecycle.stabilityRecommendation
      : "replace"
    : "hold"

  return {
    ...result,
    mustReplacePreviousQuestion: shouldReplaceQuestion,
    questionLifecycle: {
      ...lifecycle,
      currentQuestionState,
      shouldReplaceQuestion,
      stabilityRecommendation,
    },
  }
}

export function resolveLiveIntentStatusTransition(
  existingStatus: string | undefined,
  nextStatus: LiveIntentLedgerStatusPolicy
): LiveIntentLedgerStatusPolicy | null {
  if (existingStatus === "do_not_repeat_this_call" || existingStatus === "dropped") {
    return existingStatus === nextStatus ? nextStatus : null
  }
  if (existingStatus === "confirmed") return nextStatus === "confirmed" ? nextStatus : null
  if (existingStatus === "answered") {
    return nextStatus === "answered" ||
      nextStatus === "confirmed" ||
      nextStatus === "do_not_repeat_this_call" ||
      nextStatus === "dropped"
      ? nextStatus
      : null
  }

  return nextStatus
}

export function shouldKeepCurrentLiveQuestion({
  currentQuestion,
  latestFeedbackAction,
  lifecycle,
  mustReplacePreviousQuestion,
}: {
  currentQuestion: string
  latestFeedbackAction?: string
  lifecycle?: LiveQuestionLifecyclePolicy | null
  mustReplacePreviousQuestion: boolean
}) {
  if (!normalizedText(currentQuestion)) return false
  if (latestFeedbackAction) return false
  if (mustReplacePreviousQuestion) return false
  if (!lifecycle || lifecycle.shouldReplaceQuestion !== false) return false
  if (lifecycle.stabilityRecommendation !== "hold") return false

  return lifecycle.currentQuestionState === "active" || lifecycle.currentQuestionState === "asked"
}
