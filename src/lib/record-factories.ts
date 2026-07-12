import type { Opportunity } from "@/lib/salesframe-core"

export const starterOpportunityGuidance = {
  nextQuestion: "Ready for your first live question",
  questionReason: "Start a call and SalesFrame will shape the opener from this account, opportunity, and selected playbooks.",
}

export function hasStarterOpportunityGuidance(opportunity: Pick<Opportunity, "nextQuestion" | "questionReason">) {
  return (
    opportunity.nextQuestion === starterOpportunityGuidance.nextQuestion &&
    opportunity.questionReason === starterOpportunityGuidance.questionReason
  )
}

export function createRecordId(value: string, prefix: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return `${prefix}-${slug || "new"}-${Date.now().toString(36)}`
}

export function createStarterOpportunity({
  id,
  accountId,
  name,
  callType,
}: {
  id: string
  accountId: string
  name: string
  callType: string
}): Opportunity {
  return {
    id,
    accountId,
    name,
    stage: "Discovery",
    amount: "Unqualified",
    closeDate: "Not set",
    createdAt: "Not set",
    createdAtIso: null,
    updatedAtIso: null,
    coverage: 0,
    missing: 11,
    weak: 0,
    callType,
    nextQuestion: starterOpportunityGuidance.nextQuestion,
    questionReason: starterOpportunityGuidance.questionReason,
    meddicc: [
      { label: "Metrics", status: "missing", detail: "No quantified impact captured yet." },
      { label: "Economic Buyer", status: "missing", detail: "Buyer and approval owner are unknown." },
      { label: "Decision Criteria", status: "missing", detail: "Evaluation criteria have not been captured." },
      { label: "Decision Process", status: "missing", detail: "Buying steps, dates, and approval gates are unknown." },
      { label: "Identify Pain", status: "missing", detail: "Customer pain has not been validated yet." },
      { label: "Champion", status: "missing", detail: "No champion has been identified or tested." },
      { label: "Competition", status: "missing", detail: "Alternatives and incumbents are unknown." },
    ],
    bant: [
      { label: "Budget", status: "missing", detail: "Budget or funding path has not been captured." },
      { label: "Authority", status: "missing", detail: "Authority path is unknown." },
      { label: "Need", status: "missing", detail: "Need has not been confirmed by the customer." },
      { label: "Timeline", status: "missing", detail: "Timeline and business trigger are unknown." },
    ],
    stakeholders: [],
    notes: [],
    transcript: [],
  }
}
