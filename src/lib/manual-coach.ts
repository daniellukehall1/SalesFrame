import type {
  LiveGuidance,
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

export function getAlternativeQuestions(guidance: LiveGuidance): ManualQuestion[] {
  if (guidance.alternatives?.length) {
    return guidance.alternatives.slice(0, 3).map((item, index) => ({
      id: createManualQuestionId(`alternative-${index + 1}`, item.target, item.question),
      question: item.question,
      target: item.target,
      framework: guidance.playbookLabel,
      reason: item.reason,
      source: "alternative",
    }))
  }

  return []
}

function createManualQuestionId(source: string, target: string, question: string) {
  return `${source}-${normalizeComparableText(`${target}-${question}`).slice(0, 72)}`
}
