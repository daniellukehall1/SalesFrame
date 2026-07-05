import type {
  LiveGuidance,
  ManualCoachState,
  ManualQuestion,
} from "@/lib/salesframe-core"
import { normalizeComparableText } from "@/lib/research-profile"

export function createManualQuestionFromGuidance(guidance: LiveGuidance): ManualQuestion {
  return {
    id: createManualQuestionId("live", guidance.displayRecommendation?.target ?? guidance.target, guidance.displayRecommendation?.question ?? guidance.nextQuestion),
    question: guidance.displayRecommendation?.question ?? guidance.nextQuestion,
    target: guidance.displayRecommendation?.target ?? guidance.target,
    framework: guidance.displayRecommendation?.playbookLabel ?? guidance.playbookLabel,
    reason: guidance.displayRecommendation?.reason ?? guidance.questionReason,
    source: "live",
  }
}

export function getDisplayedLiveCoachQuestion({
  guidance,
  manualCoach,
}: {
  guidance: LiveGuidance | null
  manualCoach: ManualCoachState
}): ManualQuestion | null {
  const rawLiveQuestion = guidance ? createManualQuestionFromGuidance(guidance) : null
  const liveQuestion =
    rawLiveQuestion &&
    !manualCoach.askedQuestionIds.includes(rawLiveQuestion.id) &&
    !manualCoach.deferredQuestionIds.includes(rawLiveQuestion.id)
      ? rawLiveQuestion
      : null

  return manualCoach.activeQuestion ?? liveQuestion
}

export function createManualQuestionId(source: string, target: string, question: string) {
  return `${source}-${normalizeComparableText(`${target}-${question}`).slice(0, 72)}`
}
