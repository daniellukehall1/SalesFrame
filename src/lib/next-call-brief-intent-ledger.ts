import type { PlaybookIntentCluster } from "./salesframe-intent-clusters"

export type NextCallBriefQuestionIntent = {
  intentClusterId?: string | null
  kind: "question"
}

export type SuggestedBriefIntentLedgerRow = {
  call_id: string
  confidence: 0
  expires_at: null
  intent_cluster_id: string
  intent_label: string
  last_answer: null
  last_question: null
  opportunity_id: string
  reason: "pre_call_brief"
  related_playbook_field_ids: string[]
  source_turn_ids: []
  status: "suggested"
  summary: ""
  value: null
  workspace_id: string
}

export type PreparationHintDisposition =
  | "opening_option"
  | "rerank_after_live_turn"
  | "follow_live_topic"
  | "parked_by_feedback"
  | "dropped_by_feedback"
  | "soften_for_buyer"
  | "recover_only_if_natural"

export function derivePreparationHintDisposition({
  briefIntentClusterId,
  buyerMood = "neutral",
  conversationStage = "opening",
  currentIntentClusterId = "",
  hasLiveTranscript,
  sellerFeedbackAction = "",
}: {
  briefIntentClusterId: string
  buyerMood?: string
  conversationStage?: string
  currentIntentClusterId?: string
  hasLiveTranscript: boolean
  sellerFeedbackAction?: string
}) {
  let disposition: PreparationHintDisposition = hasLiveTranscript
    ? "rerank_after_live_turn"
    : "opening_option"

  if (sellerFeedbackAction === "skip") disposition = "dropped_by_feedback"
  else if (sellerFeedbackAction === "too_soon") disposition = "parked_by_feedback"
  else if (sellerFeedbackAction === "softer" || ["confused", "rushed", "defensive"].includes(buyerMood)) {
    disposition = "soften_for_buyer"
  } else if (conversationStage === "wrap-up") disposition = "recover_only_if_natural"
  else if (
    hasLiveTranscript &&
    currentIntentClusterId &&
    currentIntentClusterId !== briefIntentClusterId
  ) {
    disposition = "follow_live_topic"
  }

  const liveDirective: Record<PreparationHintDisposition, string> = {
    opening_option: "Treat the hint as one optional opening intent; generate fresh wording.",
    rerank_after_live_turn: "Re-rank the hint below the customer's latest committed turn.",
    follow_live_topic: "Follow the active customer topic and keep the hint parked.",
    parked_by_feedback: "Keep the hint parked until the buyer creates a natural re-entry cue.",
    dropped_by_feedback: "Do not use this hint again during the call.",
    soften_for_buyer: "Prefer listening, acknowledging, or a lower-pressure clarification.",
    recover_only_if_natural: "Recover at most this one hint only if it fits the wrap-up naturally.",
  }

  return { disposition, liveDirective: liveDirective[disposition] }
}

/**
 * Converts validated preparation intent references into low-priority live-call
 * hints. Question wording, sources, brief identifiers, and evidence state are
 * intentionally not accepted by this boundary.
 */
export function buildSuggestedIntentLedgerRowsFromNextCallBrief({
  callId,
  existingIntentClusterIds = [],
  intentClusters,
  opportunityId,
  questions,
  workspaceId,
}: {
  callId: string
  existingIntentClusterIds?: Iterable<string>
  intentClusters: readonly PlaybookIntentCluster[]
  opportunityId: string
  questions: readonly NextCallBriefQuestionIntent[]
  workspaceId: string
}): SuggestedBriefIntentLedgerRow[] {
  const existingIds = new Set(
    Array.from(existingIntentClusterIds, (value) => value.trim()).filter(Boolean)
  )
  const availableClusters = new Map(
    intentClusters
      .filter((cluster) => cluster.status !== "confirmed")
      .map((cluster) => [cluster.id, cluster] as const)
  )
  const selectedClusterIds = new Set<string>()

  questions.forEach((question) => {
    const intentClusterId = question.kind === "question"
      ? question.intentClusterId?.trim()
      : ""
    if (
      intentClusterId &&
      availableClusters.has(intentClusterId) &&
      !existingIds.has(intentClusterId)
    ) {
      selectedClusterIds.add(intentClusterId)
    }
  })

  return Array.from(selectedClusterIds).flatMap((intentClusterId) => {
    const cluster = availableClusters.get(intentClusterId)
    if (!cluster) return []

    const relatedPlaybookFieldIds = Array.from(new Set(
      cluster.fields.map((field) => field.playbookFieldId.trim()).filter(Boolean)
    ))

    return [{
      call_id: callId,
      confidence: 0 as const,
      expires_at: null,
      intent_cluster_id: cluster.id,
      intent_label: cluster.label,
      last_answer: null,
      last_question: null,
      opportunity_id: opportunityId,
      reason: "pre_call_brief" as const,
      related_playbook_field_ids: relatedPlaybookFieldIds,
      source_turn_ids: [] as [],
      status: "suggested" as const,
      summary: "" as const,
      value: null,
      workspace_id: workspaceId,
    }]
  })
}
