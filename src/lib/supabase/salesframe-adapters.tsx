import { Building2Icon } from "lucide-react"

import type { AccountNavItem } from "@/components/nav-projects"
import type { WorkspaceNavItem } from "@/components/workspace-switcher"
import { formatCloseDateValue } from "@/lib/date-utils"
import { createStarterOpportunity } from "@/lib/record-factories"
import {
  defaultCustomerResearch,
  defaultSellerResearchProfile,
  normalizeCurrencyCode,
  type AccountDraft,
  type CallSummary,
  type CallPlaybook,
  type CustomerResearchConfig,
  type NextCallBrief,
  type Opportunity,
  type OpportunityDraft,
  type SellerResearchProfile,
  type TranscriptSpeaker,
} from "@/lib/salesframe-core"
import { formatPlaybooks, normalizePlaybooks } from "@/lib/playbook-utils"
import type {
  AccountRow,
  CallNoteRow,
  CallRow,
  CallSpeakerRow,
  CustomerResearchRunRow,
  NextCallBriefRow,
  OpportunityFieldEvidenceRow,
  OpportunityPlaybookRow,
  OpportunityRow,
  PlaybookFieldRow,
  PlaybookRow,
  SellerResearchProfileRow,
  TranscriptSegmentRow,
  WorkspaceRow,
} from "@/lib/supabase/salesframe-data"

export function mapWorkspaceRowToNavItem(row: WorkspaceRow): WorkspaceNavItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "Seller workspace",
    defaultCurrency: normalizeCurrencyCode(row.default_currency),
    onboardingCompletedAt: row.onboarding_completed_at,
    role: "Owner",
  }
}

export function mapAccountRowsToNavItems(accounts: AccountRow[], opportunities: OpportunityRow[]) {
  return accounts.map<AccountNavItem>((account) => ({
    id: account.id,
    name: account.name,
    description: account.industry ?? "Account",
    website: account.website ?? "",
    currency: normalizeCurrencyCode(account.currency),
    icon: <Building2Icon />,
    opportunities: opportunities
      .filter((opportunity) => opportunity.account_id === account.id)
      .map((opportunity) => ({
        id: opportunity.id,
        name: opportunity.name,
        stage: opportunity.stage,
      })),
  }))
}

export function mapAccountRowsToDrafts(accounts: AccountRow[], ownerName: string) {
  return Object.fromEntries(
    accounts.map((account) => [
      account.id,
      mapAccountRowToDraft(account, ownerName),
    ])
  ) as Record<string, AccountDraft>
}

export function mapAccountRowToDraft(account: AccountRow, ownerName: string): AccountDraft {
  return {
    accountName: account.name,
    website: account.website ?? "",
    industry: account.industry ?? "Account",
    employeeCount: account.employee_count ?? "",
    region: account.region ?? "Australia",
    currency: normalizeCurrencyCode(account.currency),
    owner: ownerName,
    currentTools: account.current_tools ?? "",
    strategicInitiatives: account.strategic_initiatives ?? "",
    competitors: account.competitors ?? "",
    accountNotes: account.notes ?? "",
  }
}

export function mapOpportunityRowsToDrafts({
  opportunities,
  playbooks,
  playbookAssignments,
  ownerName,
}: {
  opportunities: OpportunityRow[]
  playbooks: PlaybookRow[]
  playbookAssignments: OpportunityPlaybookRow[]
  ownerName: string
}) {
  return Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.id,
      mapOpportunityRowToDraft({
        opportunity,
        playbooks,
        playbookAssignments,
        ownerName,
      }),
    ])
  ) as Record<string, OpportunityDraft>
}

export function mapOpportunityRowsToUi({
  calls = [],
  callNotes = [],
  callSpeakers = [],
  nextCallBriefs = [],
  opportunityFieldEvidence = [],
  opportunities,
  playbookFields = [],
  playbooks,
  playbookAssignments,
  transcriptSegments = [],
}: {
  calls?: CallRow[]
  callNotes?: CallNoteRow[]
  callSpeakers?: CallSpeakerRow[]
  nextCallBriefs?: NextCallBriefRow[]
  opportunityFieldEvidence?: OpportunityFieldEvidenceRow[]
  opportunities: OpportunityRow[]
  playbookFields?: PlaybookFieldRow[]
  playbooks: PlaybookRow[]
  playbookAssignments: OpportunityPlaybookRow[]
  transcriptSegments?: TranscriptSegmentRow[]
}) {
  return opportunities.map((opportunity) =>
    mapOpportunityRowToUi({
      calls,
      callNotes,
      callSpeakers,
      nextCallBriefs,
      opportunity,
      opportunityFieldEvidence,
      playbookFields,
      selectedPlaybooks: getOpportunityPlaybooks(opportunity.id, playbooks, playbookAssignments),
      transcriptSegments,
    })
  )
}

export function mapCallRowsToSummaries(calls: CallRow[]): CallSummary[] {
  return calls.map((call) => ({
    id: call.id,
    opportunityId: call.opportunity_id,
    title: call.title,
    date: formatCallDate(call.started_at ?? call.created_at),
    duration: formatCallDuration(call.duration_seconds),
    durationSeconds: call.duration_seconds ?? 0,
    recordingStoragePath: call.recording_storage_path,
    recordingUrl: call.recording_url,
    startedAt: call.started_at,
    type: call.call_type,
    status: formatCallStatus(call.status),
  }))
}

export function mapOpportunityRowToDraft({
  opportunity,
  playbooks,
  playbookAssignments,
  ownerName,
}: {
  opportunity: OpportunityRow
  playbooks: PlaybookRow[]
  playbookAssignments: OpportunityPlaybookRow[]
  ownerName: string
}): OpportunityDraft {
  return {
    opportunityName: opportunity.name,
    stage: opportunity.stage,
    amount: opportunity.amount ?? "Unqualified",
    closeDate: formatCloseDateValue(opportunity.close_date_note ?? opportunity.close_date),
    owner: ownerName,
    source: opportunity.source ?? "Manual update",
    frameworks: formatPlaybooks(getOpportunityPlaybooks(opportunity.id, playbooks, playbookAssignments)),
    nextStep: opportunity.next_step ?? "Use the next call to identify pain, authority, and measurable impact.",
    pain: opportunity.pain ?? "Not captured yet.",
    decisionProcess: opportunity.decision_process ?? "Unknown.",
    manualNotes: opportunity.manual_notes ?? "",
  }
}

export function mapOpportunityRowToUi({
  calls = [],
  callNotes = [],
  callSpeakers = [],
  nextCallBriefs = [],
  opportunity,
  opportunityFieldEvidence = [],
  playbookFields = [],
  selectedPlaybooks,
  transcriptSegments = [],
}: {
  calls?: CallRow[]
  callNotes?: CallNoteRow[]
  callSpeakers?: CallSpeakerRow[]
  nextCallBriefs?: NextCallBriefRow[]
  opportunity: OpportunityRow
  opportunityFieldEvidence?: OpportunityFieldEvidenceRow[]
  playbookFields?: PlaybookFieldRow[]
  selectedPlaybooks: CallPlaybook[]
  transcriptSegments?: TranscriptSegmentRow[]
}): Opportunity {
  const starter = createStarterOpportunity({
    id: opportunity.id,
    accountId: opportunity.account_id,
    name: opportunity.name,
    callType: opportunity.call_type,
  })
  const latestCall = getLatestOpportunityCall(opportunity.id, calls)
  const latestCallId = latestCall?.id
  const speakerById = new Map(
    callSpeakers
      .filter((speaker) => speaker.call_id === latestCallId)
      .map((speaker) => [speaker.id, speaker])
  )
  const persistedNotes = latestCallId
    ? callNotes
        .filter((note) => note.call_id === latestCallId)
        .map((note) => note.text)
    : []
  const persistedTranscript = latestCallId
    ? transcriptSegments
        .filter((segment) => segment.call_id === latestCallId)
        .map((segment) => {
          const speaker = segment.speaker_id ? speakerById.get(segment.speaker_id) : null
          const speakerLabel = normalizeTranscriptSpeaker(speaker?.label)

          return {
            id: segment.id,
            speaker: speakerLabel,
            speakerAttributionReason: segment.speaker_attribution_reason ?? undefined,
            speakerConfidence: segment.speaker_confidence ?? undefined,
            speakerDisplayName: speaker?.display_name || speaker?.label || speakerLabel,
            speakerId: speaker?.id,
            speakerLabel,
            speakerNeedsReview: segment.speaker_needs_review,
            speakerSource: segment.speaker_source ?? segment.speaker_attribution ?? undefined,
            time: formatTranscriptTime(segment.start_ms),
            text: segment.text,
          }
        })
    : []
  const latestBrief = nextCallBriefs.find((brief) => brief.opportunity_id === opportunity.id)
  const persistedEvidenceFields = mapEvidenceRowsToMethodFields({
    evidenceRows: opportunityFieldEvidence.filter((evidence) => evidence.opportunity_id === opportunity.id),
    playbookFields,
  })

  return {
    ...starter,
    stage: opportunity.stage,
    amount: opportunity.amount ?? starter.amount,
    closeDate: formatCloseDateValue(opportunity.close_date_note ?? opportunity.close_date ?? starter.closeDate),
    coverage: opportunity.coverage_score,
    missing: opportunity.missing_count,
    weak: opportunity.weak_count,
    callType: opportunity.call_type,
    nextQuestion: opportunity.next_question ?? starter.nextQuestion,
    questionReason: opportunity.question_reason ?? starter.questionReason,
    notes: [
      ...persistedNotes,
      opportunity.pain ? `Known pain: ${opportunity.pain}` : "",
      opportunity.next_step ? `Next step: ${opportunity.next_step}` : "",
      opportunity.manual_notes ?? "",
    ].filter(Boolean),
    meddicc: [...starter.meddicc, ...persistedEvidenceFields],
    transcript: persistedTranscript,
    nextCallBrief: latestBrief ? mapNextCallBriefRow(latestBrief, latestCall) : starter.nextCallBrief,
  }
}

function mapEvidenceRowsToMethodFields({
  evidenceRows,
  playbookFields,
}: {
  evidenceRows: OpportunityFieldEvidenceRow[]
  playbookFields: PlaybookFieldRow[]
}): Opportunity["meddicc"] {
  const fieldById = new Map(playbookFields.map((field) => [field.id, field]))
  const statusRank = { confirmed: 3, weak: 2, missing: 0 } satisfies Record<Opportunity["meddicc"][number]["status"], number>
  const methodFieldsByLabel = new Map<string, Opportunity["meddicc"][number]>()

  for (const evidence of evidenceRows) {
    const field = fieldById.get(evidence.playbook_field_id)
    if (!field) continue

    const status: Opportunity["meddicc"][number]["status"] =
      evidence.status === "confirmed" ? "confirmed" : evidence.status === "missing" ? "missing" : "weak"
    const detail = evidence.evidence_summary || evidence.value || "Evidence captured from historical call context."
    const nextField = {
      detail,
      label: field.label,
      status,
    }
    const normalizedLabel = field.label.trim().toLowerCase()
    const currentField = methodFieldsByLabel.get(normalizedLabel)

    if (!currentField || statusRank[nextField.status] > statusRank[currentField.status]) {
      methodFieldsByLabel.set(normalizedLabel, nextField)
    }
  }

  return [...methodFieldsByLabel.values()]
}

function getLatestOpportunityCall(opportunityId: string, calls: CallRow[]) {
  return calls
    .filter((call) => call.opportunity_id === opportunityId)
    .sort((left, right) => {
      const leftTime = new Date(left.started_at ?? left.created_at).getTime()
      const rightTime = new Date(right.started_at ?? right.created_at).getTime()

      return rightTime - leftTime
    })[0]
}

function normalizeTranscriptSpeaker(value: string | null | undefined): TranscriptSpeaker {
  const normalized = value?.toLowerCase() ?? ""

  if (normalized.includes("seller")) return "Seller"
  if (normalized.includes("unknown") || normalized.includes("uncertain")) return "Unknown"
  if (normalized.includes("speaker 3") || normalized.includes("speaker three")) return "Speaker 3"
  if (normalized.includes("speaker 2") || normalized.includes("speaker two")) return "Speaker 2"
  if (normalized.includes("speaker 1") || normalized.includes("speaker one")) return "Speaker 1"
  if (normalized.includes("3") || normalized.includes("three")) return "Customer 3"
  if (normalized.includes("2") || normalized.includes("two")) return "Customer 2"
  if (normalized.includes("customer")) return "Customer"

  return "Unknown"
}

function formatTranscriptTime(value: number | null) {
  if (value === null) return "live"

  const totalSeconds = Math.max(0, Math.round(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function mapNextCallBriefRow(row: NextCallBriefRow, previousCall?: CallRow): NextCallBrief {
  return {
    previousCall: previousCall?.title ?? "Previous call",
    objective: row.objective ?? "Confirm the next decision step and close the remaining methodology gaps.",
    opening: row.suggested_opening ?? "Recap the previous conversation and confirm what has changed since then.",
    focusQuestions: jsonStringArray(row.focus_questions),
    missingEvidence: jsonStringArray(row.missing_evidence),
    riskNotes: jsonStringArray(row.risk_notes),
    recommendedNextStep: row.recommended_next_step ?? "Secure a concrete next step with the buying group.",
  }
}

export function getOpportunityPlaybooks(
  opportunityId: string,
  playbooks: PlaybookRow[],
  playbookAssignments: OpportunityPlaybookRow[]
) {
  const playbookIds = new Set(
    playbookAssignments
      .filter((assignment) => assignment.opportunity_id === opportunityId)
      .map((assignment) => assignment.playbook_id)
  )

  return normalizePlaybooks(
    playbooks
      .filter((playbook) => playbookIds.has(playbook.id))
      .map((playbook) => getCanonicalPlaybookName(playbook))
  )
}

export function getPlaybookIdsForSelection(playbooks: PlaybookRow[], selectedPlaybooks: readonly string[]) {
  const selected = new Set(normalizePlaybooks(selectedPlaybooks))
  const workspaceCustomPlaybook = playbooks.find((playbook) => playbook.slug === "custom" && !playbook.is_system)

  return playbooks
    .filter((playbook) => {
      if (playbook.slug === "custom") {
        return selected.has("Custom framework") && playbook.id === (workspaceCustomPlaybook?.id ?? playbook.id)
      }

      return selected.has(normalizePlaybooks([getCanonicalPlaybookName(playbook)])[0])
    })
    .map((playbook) => playbook.id)
}

function getCanonicalPlaybookName(playbook: PlaybookRow) {
  return playbook.slug === "custom" ? "Custom framework" : playbook.name
}

export function mapSellerResearchProfileRow(row: SellerResearchProfileRow | null): SellerResearchProfile {
  if (!row) return defaultSellerResearchProfile

  return {
    sellerCompany: row.seller_company,
    sellerDomain: row.seller_domain ?? "",
    productContext: row.product_context,
  }
}

export function mapCustomerResearchRunsToAccountConfig(runs: CustomerResearchRunRow[]) {
  const byAccountId: Record<string, CustomerResearchConfig> = {}

  runs.forEach((run) => {
    if (byAccountId[run.account_id]) return

    byAccountId[run.account_id] = {
      ...defaultCustomerResearch,
      enabled: run.enabled,
      sellerCompany: run.seller_company ?? defaultCustomerResearch.sellerCompany,
      sellerDomain: run.seller_domain ?? defaultCustomerResearch.sellerDomain,
      productContext: run.product_context ?? defaultCustomerResearch.productContext,
      customerContact: run.customer_contact ?? "",
      customerRole: run.customer_role ?? "",
    }
  })

  return byAccountId
}

function formatCallDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not dated"

  const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Today"

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  })
}

function formatCallDuration(value: number | null) {
  if (!value) return "Live"

  const minutes = Math.floor(value / 60)
  const seconds = value % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatCallStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
