export const callPlaybookOptions = [
  "MEDDICC",
  "MEDDPICC",
  "BANT",
  "Force Management",
  "SPIN Selling",
  "Sandler",
  "The Challenger Sale",
  "Gap Selling",
  "Value Selling",
  "Strategic Selling (Miller Heiman)",
  "SPICED (Winning by Design)",
  "Custom framework",
] as const

export type CallPlaybook = (typeof callPlaybookOptions)[number]

export const defaultCallPlaybooks: CallPlaybook[] = ["MEDDICC", "BANT"]

export const callAudioCaptureModes = ["microphone", "in_person_microphone", "meeting_audio"] as const

export type CallAudioCaptureMode = (typeof callAudioCaptureModes)[number]

export const currencyOptions = [
  "AUD",
  "USD",
  "NZD",
  "GBP",
  "EUR",
  "CAD",
  "SGD",
  "JPY",
] as const

export type CurrencyCode = (typeof currencyOptions)[number]

export const defaultCurrencyCode: CurrencyCode = "AUD"

export const currencyLabels: Record<CurrencyCode, string> = {
  AUD: "AUD - Australian dollar",
  USD: "USD - US dollar",
  NZD: "NZD - New Zealand dollar",
  GBP: "GBP - British pound",
  EUR: "EUR - Euro",
  CAD: "CAD - Canadian dollar",
  SGD: "SGD - Singapore dollar",
  JPY: "JPY - Japanese yen",
}

export function normalizeCurrencyCode(value: string | null | undefined): CurrencyCode {
  const normalized = (value ?? "").trim().toUpperCase()

  return currencyOptions.includes(normalized as CurrencyCode)
    ? (normalized as CurrencyCode)
    : defaultCurrencyCode
}

export const callPlaybookDescriptions: Record<CallPlaybook, string> = {
  MEDDICC: "Enterprise deal evidence and buyer navigation.",
  MEDDPICC: "MEDDICC plus paper process evidence for procurement and contracting.",
  BANT: "Fast qualification for budget, authority, need, and timing.",
  "Force Management": "Value messaging, required capabilities, outcomes, metrics, and differentiation.",
  "SPIN Selling": "Situation, problem, implication, and need-payoff discovery coaching.",
  Sandler: "Upfront contracts, pain, budget, decision process, fulfillment, and post-sell.",
  "The Challenger Sale": "Commercial insight, reframing, constructive tension, and differentiated value.",
  "Gap Selling": "Current state, future state, gap, root cause, impact, urgency, and decision criteria.",
  "Value Selling": "Business issue, impact, value proof, required capabilities, and mutual value plan.",
  "Strategic Selling (Miller Heiman)": "Buying influences, win-results, response modes, red flags, and next best action.",
  "SPICED (Winning by Design)": "Situation, pain, impact, critical event, and decision for recurring revenue sales.",
  "Custom framework": "Workspace-specific fields, exit criteria, and coaching standards.",
}

export const callPlaybookAliases: Record<string, CallPlaybook> = {
  meddpicc: "MEDDPICC",
  "force management / command of the message": "Force Management",
  "command of the message": "Force Management",
  spin: "SPIN Selling",
  "spin selling": "SPIN Selling",
  sandler: "Sandler",
  challenger: "The Challenger Sale",
  "challenger sale": "The Challenger Sale",
  "the challenger": "The Challenger Sale",
  "the challenger sale": "The Challenger Sale",
  gap: "Gap Selling",
  "gap selling": "Gap Selling",
  value: "Value Selling",
  "value selling": "Value Selling",
  strategic: "Strategic Selling (Miller Heiman)",
  "strategic selling": "Strategic Selling (Miller Heiman)",
  "strategic selling miller heiman": "Strategic Selling (Miller Heiman)",
  "miller heiman": "Strategic Selling (Miller Heiman)",
  spiced: "SPICED (Winning by Design)",
  "winning by design": "SPICED (Winning by Design)",
  "spiced winning by design": "SPICED (Winning by Design)",
}

export const trustedResearchSources = [
  "LinkedIn company and profile pages",
  "Company website and newsroom",
  "Annual reports or investor pages",
  "Trusted business press",
] as const

export type CustomerResearchConfig = {
  enabled: boolean
  sellerCompany: string
  sellerDomain: string
  productContext: string
  customerContact: string
  customerRole: string
}

export type CustomerResearchInsight = {
  headline: string
  summary: string
  questionAngle: string
  sources: string[]
}

export type CallSummary = {
  id: string
  opportunityId: string
  title: string
  date: string
  duration: string
  durationSeconds: number
  recordingStoragePath: string | null
  recordingUrl: string | null
  startedAt: string | null
  type: string
  status: string
}

export type TranscriptSpeaker =
  | "Seller"
  | "Customer"
  | "Customer 2"
  | "Customer 3"
  | "Speaker 1"
  | "Speaker 2"
  | "Speaker 3"
  | "Unknown"

export type SellerResearchProfile = Pick<
  CustomerResearchConfig,
  "sellerCompany" | "sellerDomain" | "productContext"
>

export type SavedOpenAiKeyState = {
  maskedKey: string
  fingerprint: string
  savedAt: string
  storageMode: "browser-managed" | "server-encrypted"
}

export const defaultCustomerResearch: CustomerResearchConfig = {
  enabled: false,
  sellerCompany: "SalesFrame",
  sellerDomain: "salesframe.ai",
  productContext:
    "AI-guided sales call coaching that enforces MEDDICC, MEDDPICC, BANT, Force Management, SPIN, Sandler, Challenger, Gap Selling, Value Selling, Strategic Selling, SPICED, and custom playbooks in real time.",
  customerContact: "",
  customerRole: "",
}

export const defaultSellerResearchProfile: SellerResearchProfile = {
  sellerCompany: defaultCustomerResearch.sellerCompany,
  sellerDomain: defaultCustomerResearch.sellerDomain,
  productContext: defaultCustomerResearch.productContext,
}

export const sellerResearchProfileStorageKey = "salesframe.sellerResearchProfile"
export const openAiKeyStateStorageKey = "salesframe.openAiKeyState"

export const workspaceDataStateOptions = [
  "ready",
  "loading",
  "empty",
  "error",
  "permission-denied",
] as const

export type WorkspaceDataState = (typeof workspaceDataStateOptions)[number]

export const workspaceDataStateLabels: Record<WorkspaceDataState, string> = {
  ready: "Ready",
  loading: "Loading",
  empty: "Empty workspace",
  error: "Error",
  "permission-denied": "Permission denied",
}

export const knownSellerResearchProfiles: Record<string, SellerResearchProfile> = {
  "salesframe.ai": defaultSellerResearchProfile,
  "salesforce.com": {
    sellerCompany: "Salesforce",
    sellerDomain: "salesforce.com",
    productContext:
      "CRM, sales engagement, customer service, marketing automation, analytics, and AI products that help businesses manage customer relationships and revenue operations.",
  },
  "zendesk.com": {
    sellerCompany: "Zendesk",
    sellerDomain: "zendesk.com",
    productContext:
      "Customer service, support, messaging, knowledge base, and AI tools that help companies improve customer experience and support efficiency.",
  },
  "clickup.com": {
    sellerCompany: "ClickUp",
    sellerDomain: "clickup.com",
    productContext:
      "Work management, project collaboration, documentation, automation, and productivity software that helps teams centralize work and improve execution.",
  },
  "atlassian.com": {
    sellerCompany: "Atlassian",
    sellerDomain: "atlassian.com",
    productContext:
      "Software development, IT service management, project tracking, collaboration, and knowledge management products for technical and business teams.",
  },
  "monday.com": {
    sellerCompany: "monday.com",
    sellerDomain: "monday.com",
    productContext:
      "Work operating system products for CRM, project management, workflow automation, portfolio management, and cross-functional team execution.",
  },
  "apple.com": {
    sellerCompany: "Apple",
    sellerDomain: "apple.com",
    productContext:
      "Apple sells integrated hardware, software, and services across iPhone, Mac, iPad, Apple Watch, AirPods, Apple TV, iCloud, AppleCare, payments, media, and business device management. Customers buy Apple for product experience, ecosystem integration, security, privacy, reliability, employee productivity, and brand preference.",
  },
}

export type MethodField = {
  label: string
  status: "confirmed" | "weak" | "missing"
  detail: string
}

export type NextCallBrief = {
  previousCall: string
  objective: string
  opening: string
  focusQuestions: string[]
  missingEvidence: string[]
  riskNotes: string[]
  recommendedNextStep: string
}

export type Opportunity = {
  id: string
  accountId: string
  name: string
  stage: string
  amount: string
  closeDate: string
  createdAt: string
  createdAtIso: string | null
  coverage: number
  missing: number
  weak: number
  callType: string
  nextQuestion: string
  questionReason: string
  nextCallBrief?: NextCallBrief
  meddicc: MethodField[]
  bant: MethodField[]
  stakeholders: {
    name: string
    role: string
    status: string
  }[]
  notes: string[]
  transcript: {
    clientId?: string
    id?: string
    isPartial?: boolean
    speaker: TranscriptSpeaker
    speakerAttributionReason?: string
    speakerConfidence?: number
    speakerDisplayName?: string
    speakerId?: string
    speakerLabel?: TranscriptSpeaker
    speakerNeedsReview?: boolean
    speakerSource?: string
    time: string
    text: string
  }[]
}

export type AccountDraft = {
  accountName: string
  website: string
  industry: string
  employeeCount: string
  region: string
  currency: CurrencyCode
  currentTools: string
  strategicInitiatives: string
  competitors: string
  accountNotes: string
}

export type OpportunityDraft = {
  opportunityName: string
  stage: string
  amount: string
  closeDate: string
  source: string
  frameworks: string
  nextStep: string
  pain: string
  decisionProcess: string
  manualNotes: string
}

export type StartRecordingPayload = {
  abortSignal?: AbortSignal
  accountMode: "existing" | "new"
  accountId: string
  accountName: string
  accountWebsite: string
  accountIndustry: string
  accountCurrency: CurrencyCode
  audioCaptureMode: CallAudioCaptureMode
  opportunityMode: "existing" | "new"
  opportunityId: string
  opportunityName: string
  callType: string
  playbooks: CallPlaybook[]
  customerResearch: CustomerResearchConfig
  openAiApiKey: string
  onPreparationStep?: (update: StartCallPreparationUpdate) => void
}

export type StartCallPreparationStepId = "ai_access" | "records" | "context" | "coach" | "audio"

export type StartCallPreparationUpdate = {
  detail?: string
  step: StartCallPreparationStepId
}

export type StartRecordingResult =
  | {
      ok: true
    }
  | {
      message: string
      ok: false
    }

export type StartRecordingHandler = (
  payload: StartRecordingPayload
) => Promise<StartRecordingResult> | StartRecordingResult

export type CreateAccountPayload = {
  accountName: string
  website: string
  aiEnrichmentEnabled: boolean
  industry: string
  employeeCount: string
  region: string
  currency: CurrencyCode
  currentTools: string
  strategicInitiatives: string
  competitors: string
  accountNotes: string
  customerResearch: CustomerResearchConfig
  createOpportunity: boolean
  opportunityName: string
  stage: string
  amount: string
  closeDate: string
  playbooks: CallPlaybook[]
  nextStep: string
  pain: string
  openAiApiKey: string
}

export type EditAccountPayload = AccountDraft & {
  accountId: string
}

export type CreateOpportunityPayload = {
  accountId: string
  opportunityName: string
  stage: string
  amount: string
  closeDate: string
  playbooks: CallPlaybook[]
  nextStep: string
  pain: string
  decisionProcess: string
  manualNotes: string
}

export type EditOpportunityPayload = CreateOpportunityPayload & {
  opportunityId: string
  source: string
}

export type PendingDeleteRecord =
  | {
      type: "account"
      id: string
      name: string
      detail: string
    }
  | {
      type: "opportunity"
      id: string
      name: string
      detail: string
    }
  | {
      type: "call"
      id: string
      name: string
      detail: string
    }

export type OpportunityCoverageFilter = "all" | "low" | "mid" | "high" | "needs-attention"
export type OpportunitySort = "gaps" | "coverage-asc" | "coverage-desc" | "value-desc" | "close-date"
export type PlaybookFocusFilter = "all" | "qualification" | "discovery" | "value" | "commercial" | "custom"

export type LiveIntentStatus = "confirmed" | "answered" | "asked" | "weak" | "missing"

export type LiveUiMode =
  | "ask_now"
  | "listen"
  | "acknowledge"
  | "clarify"
  | "wrap_up"
  | "park_and_follow_flow"
  | "recover_before_close"
  | "error"
export type LiveQuestionTiming = "now" | "wait" | "too_early" | "follow_up_only"
export type LiveRiskLevel = "low" | "medium" | "high"
export type LiveQuestionLifecycleState =
  | "active"
  | "asked"
  | "answered"
  | "stale"
  | "parked"
  | "revisit_before_close"
  | "dropped"
export type LiveStabilityRecommendation = "hold" | "replace" | "park" | "recover"
export type LiveRevisitMoment = "mid_call" | "before_wrap" | "next_call"
export type LiveSellerMove =
  | "ask"
  | "listen"
  | "acknowledge"
  | "clarify"
  | "soften"
  | "go_deeper"
  | "close_next_step"
export type LiveSellerFeedbackAction =
  | "asked"
  | "too_soon"
  | "softer"
  | "skip"
  | "use_next"

export type LiveEvidenceItem = {
  label: string
  framework: CallPlaybook
  status: LiveIntentStatus
  detail: string
  confidence?: number
}

export type LiveConversationState = {
  conversationStage: string
  buyerMood: string
  flowStage: string
  mood: string
  sentiment: string
  pace: string
  sellerMove: LiveSellerMove | string
  customerSignal: string
  shouldAskNow: boolean
  naturalnessGuidance: string
  activeIntent: string
  intentStatus: LiveIntentStatus
  questionTiming: LiveQuestionTiming
  riskLevel: LiveRiskLevel
  confidence: number
  topicShiftConfidence?: number
  activeIntentStatus?: LiveIntentStatus
  shouldRefreshQuestion?: boolean
  refreshReason?: string
}

export type LiveAlternativeQuestion = {
  question: string
  target: string
  reason: string
}

export type LiveDisplayRecommendation = {
  question: string
  reason: string
  target: string
  playbookLabel: string
  primaryIntentClusterId: string
  primaryIntentLabel: string
  alsoCovers: LiveIntentCoverage[]
  uiMode: LiveUiMode
  confidence: number
  softerAlternative?: string
}

export type LiveIntentCoverage = {
  playbookFieldId: string
  playbookLabel: string
  fieldLabel: string
  intentClusterId: string
}

export type LiveCandidateScore = {
  question: string
  target: string
  playbookLabel: string
  intentClusterId: string
  methodologyValue: number
  askNowFit: number
  currentTopicFit: number
  stageFit: number
  naturalness: number
  timingFit: number
  timingRisk: LiveRiskLevel
  buyerMoodFit: number
  informationGain: number
  reentryPotential: number
  risk: LiveRiskLevel
  overallScore: number
  reason: string
}

export type LiveQuestionLifecycle = {
  currentQuestionState: LiveQuestionLifecycleState
  shouldReplaceQuestion: boolean
  replacementReason: string
  awkwardnessRisk: LiveRiskLevel
  topicShiftConfidence: number
  stabilityRecommendation: LiveStabilityRecommendation
}

export type LiveParkedIntent = {
  intentClusterId: string
  intentLabel: string
  priority: LiveRiskLevel
  reasonParked: string
  reentryCue: string
  bridgeQuestion: string
  latestRevisitMoment: LiveRevisitMoment
  relatedPlaybookFields: string[]
}

export type LiveEvidenceUpdate = {
  playbookFieldId: string
  intentClusterId: string
  label: string
  framework: string
  status: LiveIntentStatus
  confidence: number
  summary: string
  value?: string
}

export type LiveSellerFeedbackRequest = {
  prompt: string
  preferredActions: LiveSellerFeedbackAction[]
}

export type LiveSellerFeedbackSignal = {
  action: LiveSellerFeedbackAction
  question: string
  target: string
  playbookLabel: string
  reason: string
  createdAt: string
}

export type LiveContextUsed = {
  source: "account" | "opportunity"
  field: string
  influence: string
}

export type LiveGuidance = {
  nextQuestion: string
  questionReason: string
  target: string
  playbookLabel: string
  displayRecommendation?: LiveDisplayRecommendation
  alternatives?: LiveAlternativeQuestion[]
  conversationState?: LiveConversationState
  researchInsight?: CustomerResearchInsight
  coveredCount: number
  activeIntentStatus: LiveIntentStatus
  candidateScores?: LiveCandidateScore[]
  evidenceUpdates?: LiveEvidenceUpdate[]
  evidence: LiveEvidenceItem[]
  gaps: MethodField[]
  questionLifecycle?: LiveQuestionLifecycle
  parkedIntents?: LiveParkedIntent[]
  sellerFeedbackRequest?: LiveSellerFeedbackRequest
  contextUsed?: LiveContextUsed[]
  uiMode?: LiveUiMode
  flow: {
    label: string
    detail: string
  }[]
}

export type ManualQuestion = {
  id: string
  question: string
  target: string
  framework: string
  reason: string
  source: "live" | "alternative"
}

export type ManualCoachState = {
  activeQuestion: ManualQuestion | null
  askedQuestionIds: string[]
  deferredQuestionIds: string[]
  feedbackSignals: LiveSellerFeedbackSignal[]
  lastAction: string
}
