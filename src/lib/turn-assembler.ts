export type TranscriptTurnLike = {
  attribution: {
    speakerLabel: string
  }
  lastActivityMs: number
  text: string
}

export type RecentFinalTranscriptEvent = {
  elapsedMs: number
  sourceKind: string
  text: string
}

export type TurnAssemblerDecision = {
  duplicate: boolean
  lowQuality: boolean
  normalizedText: string
  qualityFlags: string[]
}

export const speakerTurnPauseWindowMs = 5200
export const oneChannelSpeakerTurnPauseWindowMs = 2200
export const oneChannelQuestionAnswerBoundaryMs = 900
export const maxMergedTurnCharacters = 900
export const duplicateTranscriptWindowMs = 9000
export const exactDuplicateTranscriptWindowMs = 90000

export function shouldSuppressFinalTranscript({
  elapsedMs,
  finalText,
  recentEvents,
  sourceKind,
}: {
  elapsedMs: number
  finalText: string
  recentEvents: RecentFinalTranscriptEvent[]
  sourceKind: string
}): TurnAssemblerDecision {
  const normalizedText = normalizeTranscriptForComparison(finalText)
  const qualityFlags = getTranscriptQualityFlags(finalText)
  const lowQuality = qualityFlags.length > 0
  const duplicate = isLikelyDuplicateTranscriptEvent({
    elapsedMs,
    finalText,
    recentEvents,
    sourceKind,
  })

  return {
    duplicate,
    lowQuality,
    normalizedText,
    qualityFlags: [
      ...qualityFlags,
      ...(duplicate ? ["duplicate_provider_turn"] : []),
    ],
  }
}

export function canContinueTranscriptTurn({
  attributionSpeaker,
  elapsedMs,
  nextText,
  sourceKind,
  turn,
}: {
  attributionSpeaker: string
  elapsedMs: number
  nextText: string
  sourceKind?: string
  turn: TranscriptTurnLike
}) {
  const pauseMs = Math.max(0, elapsedMs - turn.lastActivityMs)

  if (turn.attribution.speakerLabel !== attributionSpeaker) return false
  if (isOneChannelAudioSource(sourceKind)) {
    if (shouldSplitOneChannelQuestionAnswerTurn({ nextText, pauseMs, turn })) return false
    if (pauseMs > oneChannelSpeakerTurnPauseWindowMs) return false
  } else if (pauseMs > speakerTurnPauseWindowMs) {
    return false
  }
  if (turn.text.length + nextText.length > maxMergedTurnCharacters) return false

  return true
}

export function shouldInferOneChannelCustomerTurn({
  nextText,
  pauseMs,
  sourceKind,
  turn,
}: {
  nextText: string
  pauseMs: number
  sourceKind?: string
  turn: TranscriptTurnLike | null | undefined
}) {
  if (!turn || !isOneChannelAudioSource(sourceKind)) return false
  if (pauseMs < oneChannelQuestionAnswerBoundaryMs) return false
  if (!isQuestionLikeTranscript(turn.text)) return false
  if (!isAnswerLikeTranscript(nextText)) return false

  return turn.attribution.speakerLabel === "Seller" || turn.attribution.speakerLabel === "Unknown"
}

export function shouldSplitOneChannelQuestionAnswerTurn({
  nextText,
  pauseMs,
  turn,
}: {
  nextText: string
  pauseMs: number
  turn: TranscriptTurnLike
}) {
  return shouldInferOneChannelCustomerTurn({
    nextText,
    pauseMs,
    sourceKind: "in_person_microphone",
    turn,
  })
}

export function isOneChannelAudioSource(sourceKind?: string) {
  return sourceKind === "mixed_audio" || sourceKind === "in_person_microphone"
}

export function isQuestionLikeTranscript(value: string) {
  const text = value.trim()
  if (!text) return false
  if (/[?？]\s*$/.test(text)) return true

  return /^(what|why|how|when|where|who|which|can|could|would|do|does|did|is|are|was|were|have|has|had|tell me|walk me|help me understand)\b/i.test(text)
}

export function isAnswerLikeTranscript(value: string) {
  const text = value.trim()
  if (!text || isQuestionLikeTranscript(text)) return false

  const normalized = normalizeTranscriptForComparison(text)
  if (!normalized) return false
  if (/^(yes|yeah|yep|yup|no|nah|not really|correct|exactly|probably|maybe|sure|right|currently|because)\b/.test(normalized)) {
    return true
  }
  if (/^(we|we re|we are|we ve|we have|we use|our|i|i m|i am|i ve|i have|it|it s|it is|that|that s|the|this)\b/.test(normalized)) {
    return true
  }

  return normalized.split(/\s+/).length >= 3
}

export function rememberFinalTranscriptEvent({
  elapsedMs,
  recentEvents,
  sourceKind,
  text,
}: {
  elapsedMs: number
  recentEvents: RecentFinalTranscriptEvent[]
  sourceKind: string
  text: string
}) {
  recentEvents.push({
    elapsedMs,
    sourceKind,
    text,
  })

  const staleBefore = elapsedMs - exactDuplicateTranscriptWindowMs
  while (recentEvents.length > 0 && recentEvents[0].elapsedMs < staleBefore) {
    recentEvents.shift()
  }
}

export function joinTranscriptText(existingText: string, nextText: string) {
  const existing = existingText.trim()
  const next = nextText.trim()
  if (!existing) return next
  if (!next) return existing
  if (existing.endsWith(next)) return existing
  if (next.startsWith(existing)) return next

  return `${existing}${needsJoiningSpace(existing, next) ? " " : ""}${next}`
}

export function appendTranscriptDelta(existingText: string, deltaText: string) {
  if (!existingText) return deltaText
  if (!deltaText) return existingText

  const existing = existingText
  const delta = deltaText

  if (/\s$/.test(existing) || /^\s/.test(delta)) return `${existing}${delta}`
  if (/^[,.;:!?)]/.test(delta)) return `${existing}${delta}`
  if (/[(\[{]$/.test(existing)) return `${existing}${delta}`

  return `${existing}${needsJoiningSpace(existing, delta) ? " " : ""}${delta}`
}

export function normalizeTranscriptForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isLikelyDuplicateTranscriptEvent({
  elapsedMs,
  finalText,
  recentEvents,
  sourceKind,
}: {
  elapsedMs: number
  finalText: string
  recentEvents: RecentFinalTranscriptEvent[]
  sourceKind: string
}) {
  const normalizedText = normalizeTranscriptForComparison(finalText)
  if (!normalizedText) return true

  return recentEvents.some((event) => {
    const elapsedDistance = Math.abs(elapsedMs - event.elapsedMs)

    const normalizedEventText = normalizeTranscriptForComparison(event.text)
    if (!normalizedEventText) return false

    if (
      normalizedEventText === normalizedText &&
      normalizedText.length >= 24 &&
      elapsedDistance <= exactDuplicateTranscriptWindowMs
    ) {
      return true
    }

    if (event.sourceKind !== sourceKind) return false
    if (elapsedDistance > duplicateTranscriptWindowMs) return false

    if (normalizedEventText === normalizedText) return true

    const longer = normalizedEventText.length >= normalizedText.length ? normalizedEventText : normalizedText
    const shorter = normalizedEventText.length < normalizedText.length ? normalizedEventText : normalizedText
    if (shorter.length < 16) return false

    return longer.includes(shorter)
  })
}

function getTranscriptQualityFlags(value: string) {
  const text = value.trim()
  const flags: string[] = []
  if (!text) return ["empty_text"]

  const letters = text.match(/\p{L}/gu) ?? []
  if (letters.length === 0) flags.push("no_letters")

  const latinLetters = text.match(/\p{Script=Latin}/gu) ?? []
  const latinRatio = letters.length ? latinLetters.length / letters.length : 0
  if (letters.length >= 3 && latinRatio < 0.62) flags.push("language_drift_or_low_confidence")

  const normalized = normalizeTranscriptForComparison(text)
  if (!normalized) flags.push("empty_normalized_text")

  return flags
}

function needsJoiningSpace(existing: string, next: string) {
  if (!existing || !next) return false
  if (/\s$/.test(existing) || /^\s/.test(next)) return false
  if (/^[,.;:!?)]/.test(next)) return false

  return true
}
