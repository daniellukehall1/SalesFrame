import type { Opportunity } from "@/lib/salesframe-core"

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
    coverage: 0,
    missing: 11,
    weak: 0,
    callType,
    nextQuestion: "AI guidance pending",
    questionReason: "Start a call to generate the next question with OpenAI live guidance.",
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
    notes: ["Start a call to generate live guidance, transcript, and post-call outputs with OpenAI."],
    transcript: [],
  }
}
