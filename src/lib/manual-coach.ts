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

function createManualQuestionId(source: string, target: string, question: string) {
  return `${source}-${normalizeComparableText(`${target}-${question}`).slice(0, 72)}`
}
