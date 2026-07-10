import { AccountLogoAvatar } from "@/components/account-logo-avatar"
import type { AccountNavItem } from "@/components/nav-projects"
import type { WorkspaceNavItem } from "@/components/workspace-switcher"
import {
  buildAccountLogoFallbackUrl,
  buildAccountLogoUrl,
  normalizeAccountLogoDomain,
  type AccountLogoStatus,
} from "@/lib/account-logo"
import { formatCurrencyAmount } from "@/lib/currency-utils"
import { formatCloseDateValue } from "@/lib/date-utils"
import { createStarterOpportunity } from "@/lib/record-factories"
import {
  defaultCustomerResearch,
  defaultSellerResearchProfile,
  MAX_LIVE_CALL_SECONDS,
  normalizeCallEndedReason,
  normalizeCurrencyCode,
  type AccountDraft,
  type CallSummary,
  type CallPlaybook,
  type CallContact,
  type Contact,
  type ContactBuyingRole,
  type ContactEnrichmentProfile,
  type ContactEnrichmentStatus,
  type CustomerResearchConfig,
  type NextCallBrief,
  type Opportunity,
  type OpportunityContact,
  type OpportunityDraft,
  type RecordingLifecycleStatus,
  type SellerResearchProfile,
  type TranscriptSpeaker,
} from "@/lib/salesframe-core"
import { formatPlaybooks, normalizePlaybooks } from "@/lib/playbook-utils"
import { normalizeWorkspaceIconId } from "@/lib/workspace-icons"
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

type ContactRowLike = {
  id: string
  workspace_id: string
  account_id: string
  full_name: string
  preferred_name: string | null
  job_title: string | null
  department: string | null
  seniority: string | null
  work_email: string | null
  business_phone: string | null
  linkedin_url: string | null
  location: string | null
  timezone: string | null
  employment_status: string
  private_notes: string | null
  source: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

type OpportunityContactRowLike = {
  id: string
  workspace_id: string
  account_id: string
  opportunity_id: string
  contact_id: string
  buying_roles: string[]
  influence: string
  relationship_strength: string
  stance: string
  is_primary: boolean
  notes: string | null
}

type CallContactRowLike = {
  id: string
  workspace_id: string
  account_id: string
  opportunity_id: string
  call_id: string
  contact_id: string
  attendance_status: string
  is_primary: boolean
}

type ContactEnrichmentProfileRowLike = {
  contact_id: string
  professional_summary: string | null
  role_scope: string | null
  likely_priorities: string | null
  likely_kpis: string | null
  relevant_experience: string | null
  recent_professional_signals: string | null
  discovery_angles: string | null
  confidence: number | null
  caveats: string | null
  sources: unknown
  last_enriched_at: string | null
}

type ContactEnrichmentRunRowLike = {
  contact_id: string
  status: string
  error_message?: string | null
  created_at: string
}

export function mapWorkspaceRowToNavItem(row: WorkspaceRow): WorkspaceNavItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "Seller workspace",
    defaultCurrency: normalizeCurrencyCode(row.default_currency),
    workspaceIcon: normalizeWorkspaceIconId(row.workspace_icon),
    onboardingCompletedAt: row.onboarding_completed_at,
    role: "Owner",
  }
}

export function mapAccountRowsToNavItems(accounts: AccountRow[], opportunities: OpportunityRow[]) {
  return accounts.map<AccountNavItem>((account) => {
    const logoDomain = normalizeAccountLogoDomain(account.website) || account.logo_domain || ""
    const generatedLogoUrl = buildAccountLogoUrl(logoDomain) || buildAccountLogoFallbackUrl(logoDomain)
    const logoUrl = generatedLogoUrl || account.logo_url || ""
    const logoStatus = ["resolved", "fallback", "missing"].includes(account.logo_status)
      ? account.logo_status as AccountLogoStatus
      : logoDomain
        ? "resolved"
        : "missing"

    return {
      id: account.id,
      name: account.name,
      description: account.industry ?? "",
      website: account.website ?? "",
      createdAt: formatCloseDateValue(account.created_at),
      createdAtIso: account.created_at,
      currency: normalizeCurrencyCode(account.currency),
      logoDomain,
      logoStatus,
      logoUrl,
      logoCheckedAt: account.logo_checked_at ?? "",
      icon: (
        <AccountLogoAvatar
          domain={logoDomain}
          logoUrl={logoUrl}
          name={account.name}
          retryKey={account.logo_checked_at}
        />
      ),
      opportunities: opportunities
        .filter((opportunity) => opportunity.account_id === account.id)
        .map((opportunity) => ({
          id: opportunity.id,
          name: opportunity.name,
          stage: opportunity.stage,
        })),
    }
  })
}

export function mapAccountRowsToDrafts(accounts: AccountRow[]) {
  return Object.fromEntries(
    accounts.map((account) => [
      account.id,
      mapAccountRowToDraft(account),
    ])
  ) as Record<string, AccountDraft>
}

export function mapContactRowsToUi({
  contacts,
  enrichmentProfiles = [],
  enrichmentRuns = [],
}: {
  contacts: ContactRowLike[]
  enrichmentProfiles?: ContactEnrichmentProfileRowLike[]
  enrichmentRuns?: ContactEnrichmentRunRowLike[]
}): Contact[] {
  const profileByContactId = new Map(enrichmentProfiles.map((profile) => [profile.contact_id, profile]))
  const latestRunByContactId = new Map<string, ContactEnrichmentRunRowLike>()

  enrichmentRuns
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .forEach((run) => {
      if (!latestRunByContactId.has(run.contact_id)) latestRunByContactId.set(run.contact_id, run)
    })

  return contacts.map((contact) => {
    const profile = profileByContactId.get(contact.id)
    const latestRun = latestRunByContactId.get(contact.id)

    return {
      id: contact.id,
      workspaceId: contact.workspace_id,
      accountId: contact.account_id,
      fullName: contact.full_name,
      preferredName: contact.preferred_name ?? "",
      jobTitle: contact.job_title ?? "",
      department: contact.department ?? "",
      seniority: contact.seniority ?? "",
      workEmail: contact.work_email ?? "",
      businessPhone: contact.business_phone ?? "",
      linkedinUrl: contact.linkedin_url ?? "",
      location: contact.location ?? "",
      timezone: contact.timezone ?? "",
      employmentStatus:
        contact.employment_status === "former" || contact.employment_status === "unknown"
          ? contact.employment_status
          : "active",
      privateNotes: contact.private_notes ?? "",
      source: contact.source,
      createdAt: formatCloseDateValue(contact.created_at),
      createdAtIso: contact.created_at,
      updatedAtIso: contact.updated_at,
      archivedAtIso: contact.archived_at,
      enrichment: profile || latestRun
        ? mapContactEnrichmentProfile(profile, latestRun, contact.id)
        : null,
    }
  })
}

export function mapOpportunityContactRowsToUi(rows: OpportunityContactRowLike[]): OpportunityContact[] {
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    accountId: row.account_id,
    opportunityId: row.opportunity_id,
    contactId: row.contact_id,
    buyingRoles: row.buying_roles.filter((role): role is ContactBuyingRole =>
      [
        "champion",
        "coach",
        "economic_buyer",
        "decision_maker",
        "evaluator",
        "technical_buyer",
        "influencer",
        "end_user",
        "procurement",
        "legal",
        "security",
        "blocker",
        "other",
      ].includes(role)
    ),
    influence:
      row.influence === "high" || row.influence === "medium" || row.influence === "low"
        ? row.influence
        : "unknown",
    relationshipStrength:
      row.relationship_strength === "strong" || row.relationship_strength === "developing" || row.relationship_strength === "weak"
        ? row.relationship_strength
        : "unknown",
    stance:
      row.stance === "supportive" || row.stance === "neutral" || row.stance === "resistant"
        ? row.stance
        : "unknown",
    isPrimary: row.is_primary,
    notes: row.notes ?? "",
  }))
}

export function mapCallContactRowsToUi(rows: CallContactRowLike[]): CallContact[] {
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    accountId: row.account_id,
    opportunityId: row.opportunity_id,
    callId: row.call_id,
    contactId: row.contact_id,
    attendance:
      row.attendance_status === "expected" || row.attendance_status === "attended" || row.attendance_status === "absent"
        ? row.attendance_status
        : "unknown",
    isPrimary: row.is_primary,
  }))
}

function mapContactEnrichmentProfile(
  profile: ContactEnrichmentProfileRowLike | undefined,
  latestRun: ContactEnrichmentRunRowLike | undefined,
  contactId: string
): ContactEnrichmentProfile {
  const runStatus = latestRun?.status
  const status: ContactEnrichmentStatus =
    runStatus === "queued" || runStatus === "running" || runStatus === "failed" || runStatus === "ambiguous"
      ? runStatus
      : profile?.last_enriched_at
        ? "completed"
        : "not_enriched"

  return {
    contactId,
    professionalSummary: profile?.professional_summary ?? "",
    roleScope: profile?.role_scope ?? "",
    priorities: textList(profile?.likely_priorities),
    kpis: textList(profile?.likely_kpis),
    relevantExperience: textList(profile?.relevant_experience),
    recentSignals: textList(profile?.recent_professional_signals),
    discoveryAngles: textList(profile?.discovery_angles),
    confidence: profile?.confidence ?? null,
    caveats: textList(profile?.caveats),
    sources: mapContactEnrichmentSources(profile?.sources),
    status,
    statusMessage: latestRun?.error_message ?? "",
    lastEnrichedAt: profile?.last_enriched_at ? formatCloseDateValue(profile.last_enriched_at) : null,
  }
}

function textList(value: string | null | undefined) {
  if (!value) return []

  return value
    .split(/\n|;/)
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
}

function mapContactEnrichmentSources(value: unknown): ContactEnrichmentProfile["sources"] {
  const sourceList = Array.isArray(value)
    ? value
    : value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Record<string, unknown>).consulted)
      ? (value as Record<string, unknown>).consulted as unknown[]
      : []

  return sourceList.flatMap((source) => {
    if (typeof source === "string") return [{ title: "Public professional source", url: source }]
    if (!source || typeof source !== "object" || Array.isArray(source)) return []
    const record = source as Record<string, unknown>
    const title = typeof record.title === "string" ? record.title : "Public professional source"
    const url = typeof record.url === "string" ? record.url : ""

    return url ? [{ title, url }] : []
  })
}

export function mapAccountRowToDraft(account: AccountRow): AccountDraft {
  return {
    accountName: account.name,
    website: account.website ?? "",
    industry: account.industry ?? "",
    employeeCount: account.employee_count ?? "",
    region: account.region ?? "Australia",
    currency: normalizeCurrencyCode(account.currency),
    currentTools: account.current_tools ?? "",
    strategicInitiatives: account.strategic_initiatives ?? "",
    competitors: account.competitors ?? "",
    accountNotes: account.notes ?? "",
  }
}

export function mapOpportunityRowsToDrafts({
  accounts = [],
  opportunities,
  playbooks,
  playbookAssignments,
}: {
  accounts?: AccountRow[]
  opportunities: OpportunityRow[]
  playbooks: PlaybookRow[]
  playbookAssignments: OpportunityPlaybookRow[]
}) {
  const accountById = new Map(accounts.map((account) => [account.id, account]))

  return Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.id,
      mapOpportunityRowToDraft({
        accountCurrency: accountById.get(opportunity.account_id)?.currency,
        opportunity,
        playbooks,
        playbookAssignments,
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
    durationLimitSeconds: call.duration_limit_seconds ?? MAX_LIVE_CALL_SECONDS,
    durationSeconds: call.duration_seconds ?? 0,
    endedReason: normalizeCallEndedReason(call.ended_reason),
    recordingError: call.recording_error,
    recordingMimeType: call.recording_mime_type,
    recordingReadyAt: call.recording_ready_at,
    recordingSizeBytes: call.recording_size_bytes,
    recordingStatus: normalizeRecordingLifecycleStatus(call.recording_status, call.recording_storage_path, call.recording_url),
    recordingStoragePath: call.recording_storage_path,
    recordingUrl: call.recording_url,
    startedAt: call.started_at,
    type: call.call_type,
    status: formatCallStatus(call.status),
  }))
}

function normalizeRecordingLifecycleStatus(
  value: string | null | undefined,
  recordingStoragePath: string | null,
  recordingUrl: string | null
): RecordingLifecycleStatus {
  if (
    value === "none" ||
    value === "recording" ||
    value === "uploading" ||
    value === "processing" ||
    value === "ready" ||
    value === "failed"
  ) {
    return value
  }

  return recordingStoragePath || recordingUrl ? "ready" : "none"
}

export function mapOpportunityRowToDraft({
  accountCurrency,
  opportunity,
  playbooks,
  playbookAssignments,
}: {
  accountCurrency?: string | null
  opportunity: OpportunityRow
  playbooks: PlaybookRow[]
  playbookAssignments: OpportunityPlaybookRow[]
}): OpportunityDraft {
  return {
    opportunityName: opportunity.name,
    stage: opportunity.stage,
    amount: formatCurrencyAmount(opportunity.amount, normalizeCurrencyCode(accountCurrency)),
    closeDate: formatCloseDateValue(opportunity.close_date_note ?? opportunity.close_date),
    source: opportunity.source ?? "",
    frameworks: formatPlaybooks(getOpportunityPlaybooks(opportunity.id, playbooks, playbookAssignments)),
    nextStep: opportunity.next_step ?? "",
    pain: opportunity.pain ?? "",
    decisionProcess: opportunity.decision_process ?? "",
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
            contactConfirmedAt: speaker?.contact_confirmed_at ?? undefined,
            contactId: speaker?.contact_id ?? undefined,
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
    createdAt: formatCloseDateValue(opportunity.created_at),
    createdAtIso: opportunity.created_at,
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

  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatCallStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
