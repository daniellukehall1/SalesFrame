import type { Config, Context } from "@netlify/functions"

import type { Json } from "../../src/lib/supabase/database.types"
import { buildPlaybookIntentClusters, type PlaybookIntentCluster } from "../../src/lib/salesframe-intent-clusters"
import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, logSafeEvent, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeAccount, authorizeCall, authorizeOpportunity, requireUser } from "./_shared/supabase"

type TranscriptLine = {
  id?: string
  isPartial?: boolean
  speaker?: string
  text?: string
  time?: string
}

type LiveGuidancePayload = {
  account?: Record<string, unknown>
  accountProfile?: Record<string, unknown>
  accountId?: string
  callId?: string
  callType?: string
  currentGuidance?: unknown
  customerResearch?: Record<string, unknown>
  opportunity?: Record<string, unknown>
  opportunityId?: string
  playbooks?: string[]
  refreshContext?: Record<string, unknown>
  sellerFeedback?: SellerFeedbackSignal[]
  transcript?: TranscriptLine[]
}

type LiveIntentStatus = "confirmed" | "answered" | "asked" | "weak" | "missing"
type GapStatus = "confirmed" | "weak" | "missing"
type LiveUiMode = "ask_now" | "listen" | "acknowledge" | "clarify" | "wrap_up" | "park_and_follow_flow" | "recover_before_close" | "error"
type LiveRiskLevel = "low" | "medium" | "high"
type LiveQuestionTiming = "now" | "wait" | "too_early" | "follow_up_only"
type LiveSellerMove = "ask" | "listen" | "acknowledge" | "clarify" | "soften" | "go_deeper" | "close_next_step"
type LiveFeedbackAction = "asked" | "too_soon" | "softer" | "skip" | "use_next"
type LiveQuestionLifecycleState = "active" | "asked" | "answered" | "stale" | "parked" | "revisit_before_close" | "dropped"
type LiveStabilityRecommendation = "hold" | "replace" | "park" | "recover"
type LiveRevisitMoment = "mid_call" | "before_wrap" | "next_call"

type SellerFeedbackSignal = {
  action?: LiveFeedbackAction
  createdAt?: string
  playbookLabel?: string
  question?: string
  reason?: string
  target?: string
}

type RecordContext = {
  account: {
    name: string
    website: string
    industry: string
    employeeCount: string
    region: string
    currency: string
    currentTools: string
    strategicInitiatives: string
    competitors: string
    profileNotes: string
    updatedAt: string
    accountEnrichmentProfile: {
      businessSummary: string
      likelyBuyingTriggers: string
      strategicPriorities: string
      currentTechStack: string
      hiringGrowthSignals: string
      recentNewsSignals: string
      procurementSignals: string
      reviewSentimentSignals: string
      likelyStakeholders: string
      discoveryAngles: string
      riskFlags: string
      sourceNotes: string
      confidence: string
      lastEnrichedAt: string
    }
  }
  opportunity: {
    name: string
    stage: string
    amount: string
    closeDate: string
    closeDateNote: string
    source: string
    pain: string
    decisionProcess: string
    nextStep: string
    manualNotes: string
    callType: string
    coverageScore: number
    missingCount: number
    weakCount: number
    updatedAt: string
  }
  contextRules: string[]
}

type LiveGuidanceResult = {
  nextQuestion: string
  questionReason: string
  target: string
  playbookLabel: string
  displayRecommendation: {
    question: string
    reason: string
    target: string
    playbookLabel: string
    primaryIntentClusterId: string
    primaryIntentLabel: string
    alsoCovers: {
      playbookFieldId: string
      playbookLabel: string
      fieldLabel: string
      intentClusterId: string
    }[]
    uiMode: LiveUiMode
    confidence: number
    softerAlternative: string
  }
  coveredCount: number
  activeIntentStatus: LiveIntentStatus
  conversationState: {
    conversationStage: string
    buyerMood: string
    flowStage: string
    mood: string
    sentiment: string
    pace: string
    sellerMove: LiveSellerMove
    customerSignal: string
    shouldAskNow: boolean
    naturalnessGuidance: string
    activeIntent: string
    intentStatus: LiveIntentStatus
    questionTiming: LiveQuestionTiming
    riskLevel: LiveRiskLevel
    confidence: number
  }
  coveredIntents: {
    label: string
    framework: string
    status: LiveIntentStatus
    evidence: string
    confidence: number
  }[]
  gaps: {
    label: string
    status: GapStatus
    detail: string
  }[]
  evidence: {
    label: string
    framework: string
    status: LiveIntentStatus
    detail: string
  }[]
  candidateScores: {
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
  }[]
  evidenceUpdates: {
    playbookFieldId: string
    intentClusterId: string
    label: string
    framework: string
    status: LiveIntentStatus
    confidence: number
    summary: string
    value: string
  }[]
  sellerFeedbackRequest: {
    prompt: string
    preferredActions: LiveFeedbackAction[]
  }
  questionLifecycle: {
    currentQuestionState: LiveQuestionLifecycleState
    shouldReplaceQuestion: boolean
    replacementReason: string
    awkwardnessRisk: LiveRiskLevel
    topicShiftConfidence: number
    stabilityRecommendation: LiveStabilityRecommendation
  }
  parkedIntents: {
    intentClusterId: string
    intentLabel: string
    priority: LiveRiskLevel
    reasonParked: string
    reentryCue: string
    bridgeQuestion: string
    latestRevisitMoment: LiveRevisitMoment
    relatedPlaybookFields: string[]
  }[]
  uiMode: LiveUiMode
  flow: {
    label: string
    detail: string
  }[]
  alternatives: {
    question: string
    target: string
    reason: string
  }[]
  contextUsed: {
    source: string
    field: string
    influence: string
  }[]
}

type PreCallLiveGuidanceResult = {
  displayRecommendation: LiveGuidanceResult["displayRecommendation"]
  candidateScores: LiveGuidanceResult["candidateScores"]
  conversationState: Pick<
    LiveGuidanceResult["conversationState"],
    | "sellerMove"
    | "customerSignal"
    | "shouldAskNow"
    | "naturalnessGuidance"
    | "activeIntent"
    | "intentStatus"
    | "questionTiming"
    | "riskLevel"
    | "confidence"
  >
  questionLifecycle: LiveGuidanceResult["questionLifecycle"]
  sellerFeedbackRequest: LiveGuidanceResult["sellerFeedbackRequest"]
  uiMode: LiveUiMode
  contextUsed: LiveGuidanceResult["contextUsed"]
}

const liveGuidanceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "nextQuestion",
    "questionReason",
    "target",
    "playbookLabel",
    "displayRecommendation",
    "coveredCount",
    "activeIntentStatus",
    "conversationState",
    "coveredIntents",
    "gaps",
    "evidence",
    "candidateScores",
    "evidenceUpdates",
    "sellerFeedbackRequest",
    "questionLifecycle",
    "parkedIntents",
    "uiMode",
    "flow",
    "alternatives",
    "contextUsed",
  ],
  properties: {
    nextQuestion: { type: "string" },
    questionReason: { type: "string" },
    target: { type: "string" },
    playbookLabel: { type: "string" },
    displayRecommendation: {
      type: "object",
      additionalProperties: false,
      required: [
        "question",
        "reason",
        "target",
        "playbookLabel",
        "primaryIntentClusterId",
        "primaryIntentLabel",
        "alsoCovers",
        "uiMode",
        "confidence",
        "softerAlternative",
      ],
      properties: {
        question: { type: "string" },
        reason: { type: "string" },
        target: { type: "string" },
        playbookLabel: { type: "string" },
        primaryIntentClusterId: { type: "string" },
        primaryIntentLabel: { type: "string" },
        alsoCovers: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["playbookFieldId", "playbookLabel", "fieldLabel", "intentClusterId"],
            properties: {
              playbookFieldId: { type: "string" },
              playbookLabel: { type: "string" },
              fieldLabel: { type: "string" },
              intentClusterId: { type: "string" },
            },
          },
        },
        uiMode: { type: "string", enum: ["ask_now", "listen", "acknowledge", "clarify", "wrap_up", "park_and_follow_flow", "recover_before_close", "error"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        softerAlternative: { type: "string" },
      },
    },
    coveredCount: { type: "integer", minimum: 0 },
    activeIntentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
    conversationState: {
      type: "object",
      additionalProperties: false,
      required: [
        "conversationStage",
        "buyerMood",
        "flowStage",
        "mood",
        "sentiment",
        "pace",
        "sellerMove",
        "customerSignal",
        "shouldAskNow",
        "naturalnessGuidance",
        "activeIntent",
        "intentStatus",
        "questionTiming",
        "riskLevel",
        "confidence",
      ],
      properties: {
        conversationStage: { type: "string", enum: ["opening", "discovery", "pain", "impact", "decision", "commercial", "wrap-up"] },
        buyerMood: { type: "string", enum: ["engaged", "skeptical", "confused", "rushed", "defensive", "neutral", "curious"] },
        flowStage: { type: "string" },
        mood: { type: "string" },
        sentiment: { type: "string" },
        pace: { type: "string" },
        sellerMove: { type: "string", enum: ["ask", "listen", "acknowledge", "clarify", "soften", "go_deeper", "close_next_step"] },
        customerSignal: { type: "string" },
        shouldAskNow: { type: "boolean" },
        naturalnessGuidance: { type: "string" },
        activeIntent: { type: "string" },
        intentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
        questionTiming: { type: "string", enum: ["now", "wait", "too_early", "follow_up_only"] },
        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    coveredIntents: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "framework", "status", "evidence", "confidence"],
        properties: {
          label: { type: "string" },
          framework: { type: "string" },
          status: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
          evidence: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    gaps: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "status", "detail"],
        properties: {
          label: { type: "string" },
          status: { type: "string", enum: ["confirmed", "weak", "missing"] },
          detail: { type: "string" },
        },
      },
    },
    evidence: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "framework", "status", "detail"],
        properties: {
          label: { type: "string" },
          framework: { type: "string" },
          status: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
          detail: { type: "string" },
        },
      },
    },
    candidateScores: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "question",
          "target",
          "playbookLabel",
          "intentClusterId",
          "methodologyValue",
          "askNowFit",
          "currentTopicFit",
          "stageFit",
          "naturalness",
          "timingFit",
          "timingRisk",
          "buyerMoodFit",
          "informationGain",
          "reentryPotential",
          "risk",
          "overallScore",
          "reason",
        ],
        properties: {
          question: { type: "string" },
          target: { type: "string" },
          playbookLabel: { type: "string" },
          intentClusterId: { type: "string" },
          methodologyValue: { type: "number", minimum: 0, maximum: 1 },
          askNowFit: { type: "number", minimum: 0, maximum: 1 },
          currentTopicFit: { type: "number", minimum: 0, maximum: 1 },
          stageFit: { type: "number", minimum: 0, maximum: 1 },
          naturalness: { type: "number", minimum: 0, maximum: 1 },
          timingFit: { type: "number", minimum: 0, maximum: 1 },
          timingRisk: { type: "string", enum: ["low", "medium", "high"] },
          buyerMoodFit: { type: "number", minimum: 0, maximum: 1 },
          informationGain: { type: "number", minimum: 0, maximum: 1 },
          reentryPotential: { type: "number", minimum: 0, maximum: 1 },
          risk: { type: "string", enum: ["low", "medium", "high"] },
          overallScore: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
      },
    },
    evidenceUpdates: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["playbookFieldId", "intentClusterId", "label", "framework", "status", "confidence", "summary", "value"],
        properties: {
          playbookFieldId: { type: "string" },
          intentClusterId: { type: "string" },
          label: { type: "string" },
          framework: { type: "string" },
          status: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          summary: { type: "string" },
          value: { type: "string" },
        },
      },
    },
    sellerFeedbackRequest: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "preferredActions"],
      properties: {
        prompt: { type: "string" },
        preferredActions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string", enum: ["asked", "too_soon", "softer", "skip", "use_next"] },
        },
      },
    },
    questionLifecycle: {
      type: "object",
      additionalProperties: false,
      required: [
        "currentQuestionState",
        "shouldReplaceQuestion",
        "replacementReason",
        "awkwardnessRisk",
        "topicShiftConfidence",
        "stabilityRecommendation",
      ],
      properties: {
        currentQuestionState: { type: "string", enum: ["active", "asked", "answered", "stale", "parked", "revisit_before_close", "dropped"] },
        shouldReplaceQuestion: { type: "boolean" },
        replacementReason: { type: "string" },
        awkwardnessRisk: { type: "string", enum: ["low", "medium", "high"] },
        topicShiftConfidence: { type: "number", minimum: 0, maximum: 1 },
        stabilityRecommendation: { type: "string", enum: ["hold", "replace", "park", "recover"] },
      },
    },
    parkedIntents: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "intentClusterId",
          "intentLabel",
          "priority",
          "reasonParked",
          "reentryCue",
          "bridgeQuestion",
          "latestRevisitMoment",
          "relatedPlaybookFields",
        ],
        properties: {
          intentClusterId: { type: "string" },
          intentLabel: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          reasonParked: { type: "string" },
          reentryCue: { type: "string" },
          bridgeQuestion: { type: "string" },
          latestRevisitMoment: { type: "string", enum: ["mid_call", "before_wrap", "next_call"] },
          relatedPlaybookFields: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
        },
      },
    },
    uiMode: { type: "string", enum: ["ask_now", "listen", "acknowledge", "clarify", "wrap_up", "park_and_follow_flow", "recover_before_close", "error"] },
    flow: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail"],
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
        },
      },
    },
    alternatives: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "target", "reason"],
        properties: {
          question: { type: "string" },
          target: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    contextUsed: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "field", "influence"],
        properties: {
          source: { type: "string", enum: ["account", "opportunity"] },
          field: { type: "string" },
          influence: { type: "string" },
        },
      },
    },
  },
}

const preCallLiveGuidanceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "displayRecommendation",
    "candidateScores",
    "conversationState",
    "questionLifecycle",
    "sellerFeedbackRequest",
    "uiMode",
    "contextUsed",
  ],
  properties: {
    displayRecommendation: liveGuidanceSchema.properties.displayRecommendation,
    candidateScores: liveGuidanceSchema.properties.candidateScores,
    conversationState: {
      type: "object",
      additionalProperties: false,
      required: [
        "sellerMove",
        "customerSignal",
        "shouldAskNow",
        "naturalnessGuidance",
        "activeIntent",
        "intentStatus",
        "questionTiming",
        "riskLevel",
        "confidence",
      ],
      properties: {
        sellerMove: { type: "string", enum: ["ask", "listen", "acknowledge", "clarify", "soften", "go_deeper", "close_next_step"] },
        customerSignal: { type: "string" },
        shouldAskNow: { type: "boolean" },
        naturalnessGuidance: { type: "string" },
        activeIntent: { type: "string" },
        intentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
        questionTiming: { type: "string", enum: ["now", "wait", "too_early", "follow_up_only"] },
        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    questionLifecycle: liveGuidanceSchema.properties.questionLifecycle,
    sellerFeedbackRequest: liveGuidanceSchema.properties.sellerFeedbackRequest,
    uiMode: liveGuidanceSchema.properties.uiMode,
    contextUsed: liveGuidanceSchema.properties.contextUsed,
  },
}

function cleanText(value: unknown, defaultValue = "") {
  return typeof value === "string" && value.trim() ? value.trim() : defaultValue
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "")
}

function getRecordText(record: Record<string, unknown> | null | undefined, key: string) {
  return cleanText(record?.[key])
}

function buildAccountProfileContext(
  account: Record<string, unknown>,
  accountProfile: Record<string, unknown> | undefined
) {
  const profileNotes =
    cleanText(accountProfile?.profileNotes) ||
    cleanText(accountProfile?.accountNotes) ||
    getRecordText(account, "notes")

  return {
    profileNotes,
    currentTools: cleanText(accountProfile?.currentTools) || getRecordText(account, "current_tools"),
    strategicInitiatives:
      cleanText(accountProfile?.strategicInitiatives) ||
      getRecordText(account, "strategic_initiatives"),
    competitors: cleanText(accountProfile?.competitors) || getRecordText(account, "competitors"),
    employeeCount: cleanText(accountProfile?.employeeCount) || getRecordText(account, "employee_count"),
    region: cleanText(accountProfile?.region) || getRecordText(account, "region"),
    website: cleanText(accountProfile?.website) || getRecordText(account, "website"),
  }
}

function buildAccountEnrichmentProfileContext(profile: Record<string, unknown> | null | undefined) {
  return {
    businessSummary: getRecordText(profile, "business_summary"),
    confidence: getRecordText(profile, "confidence"),
    currentTechStack: getRecordText(profile, "current_tech_stack"),
    discoveryAngles: getRecordText(profile, "discovery_angles"),
    hiringGrowthSignals: getRecordText(profile, "hiring_growth_signals"),
    lastEnrichedAt: getRecordText(profile, "last_enriched_at"),
    likelyBuyingTriggers: getRecordText(profile, "likely_buying_triggers"),
    likelyStakeholders: getRecordText(profile, "likely_stakeholders"),
    procurementSignals: getRecordText(profile, "procurement_signals"),
    recentNewsSignals: getRecordText(profile, "recent_news_signals"),
    reviewSentimentSignals: getRecordText(profile, "review_sentiment_signals"),
    riskFlags: getRecordText(profile, "risk_flags"),
    sourceNotes: getRecordText(profile, "source_notes"),
    strategicPriorities: getRecordText(profile, "strategic_priorities"),
  }
}

function numberContextValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function buildRecordContext({
  account,
  accountEnrichmentProfileContext,
  accountProfileContext,
  opportunity,
  selectedCallType,
}: {
  account: Record<string, unknown>
  accountEnrichmentProfileContext: ReturnType<typeof buildAccountEnrichmentProfileContext>
  accountProfileContext: ReturnType<typeof buildAccountProfileContext>
  opportunity: Record<string, unknown>
  selectedCallType: string
}): RecordContext {
  return {
    account: {
      name: getRecordText(account, "name"),
      website: accountProfileContext.website,
      industry: getRecordText(account, "industry"),
      employeeCount: accountProfileContext.employeeCount,
      region: accountProfileContext.region,
      currency: getRecordText(account, "currency"),
      currentTools: accountProfileContext.currentTools,
      strategicInitiatives: accountProfileContext.strategicInitiatives,
      competitors: accountProfileContext.competitors,
      profileNotes: accountProfileContext.profileNotes,
      updatedAt: getRecordText(account, "updated_at"),
      accountEnrichmentProfile: accountEnrichmentProfileContext,
    },
    opportunity: {
      name: getRecordText(opportunity, "name"),
      stage: getRecordText(opportunity, "stage"),
      amount: getRecordText(opportunity, "amount"),
      closeDate: getRecordText(opportunity, "close_date"),
      closeDateNote: getRecordText(opportunity, "close_date_note"),
      source: getRecordText(opportunity, "source"),
      pain: getRecordText(opportunity, "pain"),
      decisionProcess: getRecordText(opportunity, "decision_process"),
      nextStep: getRecordText(opportunity, "next_step"),
      manualNotes: getRecordText(opportunity, "manual_notes"),
      callType: selectedCallType || getRecordText(opportunity, "call_type"),
      coverageScore: numberContextValue(opportunity.coverage_score),
      missingCount: numberContextValue(opportunity.missing_count),
      weakCount: numberContextValue(opportunity.weak_count),
      updatedAt: getRecordText(opportunity, "updated_at"),
    },
    contextRules: [
      "Selected playbooks and intent clusters decide what must be learned.",
      "Account and opportunity record fields shape how and when the question is asked.",
      "Use record context to avoid redundant questions when seller-entered fields already contain useful context.",
      "Use record context to make wording specific, natural, and commercially relevant.",
      "Use accountEnrichmentProfile to make live questions more specific, timely, and relevant.",
      "AI Enriched Sales Signals shape wording and timing but do not complete methodology fields by themselves.",
      "Do not mark a framework field complete from record context alone unless the saved field is explicit seller-entered evidence for that methodology intent.",
      "Use opportunity stage and call type to control question depth: lighter questions early, sharper decision or commercial questions later.",
    ],
  }
}

function cleanTranscript(transcript: TranscriptLine[] | undefined) {
  return Array.isArray(transcript)
    ? transcript
        .filter((line) => line && typeof line.text === "string" && line.text.trim())
        .filter((line) => !line.isPartial || (line.text?.trim().split(/\s+/).length ?? 0) >= 6)
        .slice(-28)
        .map((line) => ({
          id: cleanText(line.id),
          speaker: cleanText(line.speaker, "Unknown"),
          time: cleanText(line.time),
          text: cleanText(line.text),
        }))
    : []
}

function getConversationMaturity(transcript: ReturnType<typeof cleanTranscript>) {
  const customerLines = transcript.filter((line) => !/^seller$/i.test(line.speaker))
  const customerWordCount = customerLines.reduce(
    (total, line) => total + line.text.split(/\s+/).filter(Boolean).length,
    0
  )
  const stage =
    transcript.length <= 1 || customerLines.length === 0 || customerWordCount < 18
      ? "opening"
      : customerLines.length <= 2 || customerWordCount < 55
        ? "early"
        : customerLines.length <= 5 || customerWordCount < 160
          ? "developing"
          : "deep"

  return {
    stage,
    customerLineCount: customerLines.length,
    customerWordCount,
    rule:
      stage === "opening"
        ? "Earn context first. Ask a low-friction opening or current-state question. Do not ask for budget, procurement, economic buyer, quantified metrics, champion, or legal process unless the customer raised it first."
        : stage === "early"
          ? "Stay conversational. Clarify current state, problem, pain, relevance, or desired outcome before moving to commercial or buyer-process questions."
          : stage === "developing"
            ? "Deepen the strongest customer-owned thread. Impact, criteria, authority, timing, and required capabilities are allowed when connected to what the customer just said."
            : "Use sharper methodology questions only when they fit the customer's current topic, mood, and pace.",
  }
}

function getPlaybookConversationSequence(playbooks: string[]) {
  const sequences: Record<string, string> = {
    BANT: "Need before Timeline, Authority, then Budget unless the customer raises commercial context first.",
    MEDDICC: "Identify Pain and current business context before Metrics, Decision Criteria, Decision Process, Economic Buyer, Champion, and Competition.",
    MEDDPICC:
      "Identify Pain and current business context before Metrics, Decision Criteria, Decision Process, Paper Process, Economic Buyer, Champion, and Competition.",
    "Force Management":
      "Business Pain and Positive Business Outcomes before Required Capabilities, Value Metrics, and Differentiation.",
    "SPIN Selling": "Situation before Problem, Problem before Implication, Implication before Need-payoff.",
    Sandler: "Upfront Contract before Pain, then Budget, Decision Process, Fulfillment, and Post-sell.",
    "The Challenger Sale":
      "Permissioned Commercial Insight before Reframe, then impact, new way, unique strengths, and constructive tension.",
    "Gap Selling": "Current State before Future State, then Gap, Root Cause, Impact, Urgency, and Decision Criteria.",
    "Value Selling":
      "Business Issue and Reasons before Impact, then Required Capabilities, Value, Proof, and Mutual Plan.",
    "Strategic Selling (Miller Heiman)":
      "Current stakeholder context before Buying Influences, then Win-Results, Response Mode, Red Flags, Coach, and Next Best Action.",
    "SPICED (Winning by Design)":
      "Situation before Pain, Pain before Impact, then Critical Event, Decision, and Success Criteria.",
    "Custom framework":
      "Use configured fields, but ask the lightest useful version until the customer has given enough context.",
  }

  return playbooks.map((playbook) => sequences[playbook] ?? `${playbook}: follow the selected framework, but keep the next question natural.`)
}

function getOpeningPlaybookGuidance(playbooks: string[]) {
  const guidance: Record<string, string> = {
    BANT: "Open with need and current situation. Do not start with budget unless the buyer raises buying context first.",
    MEDDICC: "Open with Identify Pain or current business context. Avoid metrics, economic buyer, decision process, champion, and competition until the buyer gives context.",
    MEDDPICC:
      "Open with Identify Pain or current business context. Avoid paper process, procurement, metrics, economic buyer, and decision process until the buyer raises buying motion.",
    "Force Management":
      "Open with customer business pain, desired outcome, or what changed. Do not lead with differentiation before the buyer names the problem.",
    "SPIN Selling":
      "Open with a light Situation question, then move to Problem only after the customer gives current-state context.",
    Sandler:
      "Open with an upfront contract / ANOT-style opener: agenda, needs or outcomes, time, and next step. Keep it conversational and permission-based.",
    "The Challenger Sale":
      "Open with permission to share or test a relevant commercial insight. Do not challenge hard before earning context.",
    "Gap Selling":
      "Open with current state or the reason for the conversation, then work toward future state and gap.",
    "Value Selling":
      "Open with the business issue, initiative, or desired outcome. Do not push proof, value case, or mutual plan before the buyer confirms relevance.",
    "Strategic Selling (Miller Heiman)":
      "Open with customer context and the people involved at a light level. Do not interrogate power, politics, or red flags before the buyer has given context.",
    "SPICED (Winning by Design)":
      "Open with Situation or Pain in plain language. Do not ask about critical event or decision process until urgency or buying motion is naturally raised.",
    "Custom framework":
      "Open with the lightest configured field that earns context before asking heavier qualification questions.",
  }

  return playbooks.map((playbook) => guidance[playbook] ?? `${playbook}: open with a low-pressure context question before deeper qualification.`)
}

function requiredText(value: unknown, message: string, code: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw upstreamFailure(message, code)
  }

  return value.trim()
}

function requiredNumber(value: unknown, message: string, code: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw upstreamFailure(message, code)
  }

  return Math.max(0, Math.round(value))
}

function requiredBoolean(value: unknown, message: string, code: string) {
  if (typeof value !== "boolean") {
    throw upstreamFailure(message, code)
  }

  return value
}

function requiredConfidence(value: unknown, message: string, code: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw upstreamFailure(message, code)
  }

  return Math.max(0, Math.min(1, value))
}

function requiredLiveIntentStatus(value: unknown, message: string, code: string): LiveIntentStatus {
  if (value === "confirmed" || value === "answered" || value === "asked" || value === "weak" || value === "missing") return value

  throw upstreamFailure(message, code)
}

function requiredGapStatus(value: unknown, message: string, code: string): GapStatus {
  if (value === "confirmed" || value === "weak" || value === "missing") return value

  throw upstreamFailure(message, code)
}

function requireRecord(value: unknown, message: string, code: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw upstreamFailure(message, code)
  }

  return value as Record<string, unknown>
}

function requiredUiMode(value: unknown, message: string, code: string): LiveUiMode {
  if (
    value === "ask_now" ||
    value === "listen" ||
    value === "acknowledge" ||
    value === "clarify" ||
    value === "wrap_up" ||
    value === "park_and_follow_flow" ||
    value === "recover_before_close" ||
    value === "error"
  ) return value

  throw upstreamFailure(message, code)
}

function requiredRiskLevel(value: unknown, message: string, code: string): LiveRiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value

  throw upstreamFailure(message, code)
}

function requiredQuestionTiming(value: unknown, message: string, code: string): LiveQuestionTiming {
  if (value === "now" || value === "wait" || value === "too_early" || value === "follow_up_only") return value

  throw upstreamFailure(message, code)
}

function requiredSellerMove(value: unknown, message: string, code: string): LiveSellerMove {
  if (value === "ask" || value === "listen" || value === "acknowledge" || value === "clarify" || value === "soften" || value === "go_deeper" || value === "close_next_step") return value

  throw upstreamFailure(message, code)
}

function requiredFeedbackAction(value: unknown, message: string, code: string): LiveFeedbackAction {
  if (value === "asked" || value === "too_soon" || value === "softer" || value === "skip" || value === "use_next") return value

  throw upstreamFailure(message, code)
}

function requiredQuestionLifecycleState(value: unknown, message: string, code: string): LiveQuestionLifecycleState {
  if (
    value === "active" ||
    value === "asked" ||
    value === "answered" ||
    value === "stale" ||
    value === "parked" ||
    value === "revisit_before_close" ||
    value === "dropped"
  ) return value

  throw upstreamFailure(message, code)
}

function requiredStabilityRecommendation(value: unknown, message: string, code: string): LiveStabilityRecommendation {
  if (value === "hold" || value === "replace" || value === "park" || value === "recover") return value

  throw upstreamFailure(message, code)
}

function requiredRevisitMoment(value: unknown, message: string, code: string): LiveRevisitMoment {
  if (value === "mid_call" || value === "before_wrap" || value === "next_call") return value

  throw upstreamFailure(message, code)
}

function mapAlsoCovers(value: unknown) {
  if (!Array.isArray(value)) {
    throw upstreamFailure("Live guidance display did not return also-covered fields.", "openai_invalid_live_guidance_display_also_covers")
  }

  return value.slice(0, 8).map((item, index) => {
    const cover = requireRecord(item, `Live guidance also-covered field ${index + 1} was invalid.`, "openai_invalid_live_guidance_also_cover")

    return {
      playbookFieldId: requiredText(cover.playbookFieldId, `Live guidance also-covered field ${index + 1} did not return a field id.`, "openai_empty_live_guidance_also_cover_field"),
      playbookLabel: requiredText(cover.playbookLabel, `Live guidance also-covered field ${index + 1} did not return a playbook label.`, "openai_empty_live_guidance_also_cover_playbook"),
      fieldLabel: requiredText(cover.fieldLabel, `Live guidance also-covered field ${index + 1} did not return a field label.`, "openai_empty_live_guidance_also_cover_label"),
      intentClusterId: requiredText(cover.intentClusterId, `Live guidance also-covered field ${index + 1} did not return an intent cluster id.`, "openai_empty_live_guidance_also_cover_cluster"),
    }
  })
}

function requiredOpeningText(value: unknown, fallback: string, hasTranscript: boolean, message: string, code: string) {
  const text = cleanText(value)
  if (text) return text
  if (!hasTranscript) return fallback

  throw upstreamFailure(message, code)
}

function requiredQuestionReplacementReason(
  value: unknown,
  lifecycle: Record<string, unknown>,
  hasTranscript: boolean,
  message: string,
  code: string
) {
  const text = cleanText(value)
  if (text) return text

  if (!hasTranscript) {
    return "Pre-call readiness selected the best opening recommendation from account context, opportunity history, and selected playbooks."
  }

  if (lifecycle.shouldReplaceQuestion === false && lifecycle.stabilityRecommendation === "hold") {
    return "The current recommendation remains appropriate for the latest meaningful turn."
  }

  throw upstreamFailure(message, code)
}

function cloneRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null
}

function keepRecordWithTextFields(value: unknown, fields: string[]) {
  const record = cloneRecord(value)
  if (!record) return null

  return fields.every((field) => cleanText(record[field])) ? record : null
}

function normalizeTextArrayRecords(value: unknown, fields: string[]) {
  return Array.isArray(value)
    ? value
        .map((item) => keepRecordWithTextFields(item, fields))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : []
}

function hydratePreCallGuidanceResult(value: unknown): unknown {
  const record = cloneRecord(value)
  if (!record) return value

  const displayRecommendation = cloneRecord(record.displayRecommendation) ?? {}
  const conversationState = cloneRecord(record.conversationState) ?? {}
  const questionLifecycle = cloneRecord(record.questionLifecycle) ?? {}
  const sellerFeedbackRequest = cloneRecord(record.sellerFeedbackRequest) ?? {}
  const target = cleanText(displayRecommendation.target, cleanText(displayRecommendation.primaryIntentLabel, "Opening"))
  const playbookLabel = cleanText(displayRecommendation.playbookLabel, "Selected playbooks")
  const question = cleanText(displayRecommendation.question)
  const reason = cleanText(displayRecommendation.reason)
  const softerAlternative = cleanText(displayRecommendation.softerAlternative)

  return {
    nextQuestion: question,
    questionReason: reason,
    target,
    playbookLabel,
    displayRecommendation: {
      question,
      reason,
      target,
      playbookLabel,
      primaryIntentClusterId: cleanText(displayRecommendation.primaryIntentClusterId),
      primaryIntentLabel: cleanText(displayRecommendation.primaryIntentLabel, target),
      alsoCovers: Array.isArray(displayRecommendation.alsoCovers) ? displayRecommendation.alsoCovers : [],
      uiMode: cleanText(displayRecommendation.uiMode, cleanText(record.uiMode, "ask_now")),
      confidence: typeof displayRecommendation.confidence === "number" ? displayRecommendation.confidence : 0.72,
      softerAlternative,
    },
    coveredCount: 0,
    activeIntentStatus: cleanText(conversationState.intentStatus, "missing"),
    conversationState: {
      conversationStage: "opening",
      buyerMood: "neutral",
      flowStage: "opening",
      mood: "neutral",
      sentiment: "neutral before live customer speech",
      pace: "not established before live customer speech",
      sellerMove: cleanText(conversationState.sellerMove, "ask"),
      customerSignal: cleanText(
        conversationState.customerSignal,
        "No customer speech has been captured yet; use the first question to open naturally."
      ),
      shouldAskNow: typeof conversationState.shouldAskNow === "boolean" ? conversationState.shouldAskNow : true,
      naturalnessGuidance: cleanText(
        conversationState.naturalnessGuidance,
        "Start with a low-pressure opening question and then listen for the buyer's first signal."
      ),
      activeIntent: cleanText(conversationState.activeIntent, target),
      intentStatus: cleanText(conversationState.intentStatus, "missing"),
      questionTiming: cleanText(conversationState.questionTiming, "now"),
      riskLevel: cleanText(conversationState.riskLevel, "low"),
      confidence: typeof conversationState.confidence === "number" ? conversationState.confidence : 0.72,
    },
    coveredIntents: [],
    gaps: [],
    evidence: [],
    candidateScores: Array.isArray(record.candidateScores) ? record.candidateScores : [],
    evidenceUpdates: [],
    sellerFeedbackRequest: {
      prompt: cleanText(sellerFeedbackRequest.prompt, "Tell SalesFrame what happened with this suggestion."),
      preferredActions: Array.isArray(sellerFeedbackRequest.preferredActions) && sellerFeedbackRequest.preferredActions.length
        ? sellerFeedbackRequest.preferredActions
        : ["asked", "too_soon", "softer", "skip"],
    },
    questionLifecycle: {
      currentQuestionState: cleanText(questionLifecycle.currentQuestionState, "active"),
      shouldReplaceQuestion: typeof questionLifecycle.shouldReplaceQuestion === "boolean"
        ? questionLifecycle.shouldReplaceQuestion
        : true,
      replacementReason: cleanText(
        questionLifecycle.replacementReason,
        "Pre-call readiness selected the best opening recommendation from account context, opportunity history, and selected playbooks."
      ),
      awkwardnessRisk: cleanText(questionLifecycle.awkwardnessRisk, "low"),
      topicShiftConfidence: typeof questionLifecycle.topicShiftConfidence === "number"
        ? questionLifecycle.topicShiftConfidence
        : 0,
      stabilityRecommendation: cleanText(questionLifecycle.stabilityRecommendation, "replace"),
    },
    parkedIntents: [],
    uiMode: cleanText(record.uiMode, cleanText(displayRecommendation.uiMode, "ask_now")),
    flow: [],
    alternatives: softerAlternative
      ? [{
          question: softerAlternative,
          target,
          reason: "Softer wording for the same opening intent.",
        }]
      : [],
    contextUsed: Array.isArray(record.contextUsed) ? record.contextUsed : [],
  }
}

function normalizePreCallGuidanceForValidation(value: unknown, options: { hasTranscript: boolean }) {
  if (options.hasTranscript) return value

  const record = cloneRecord(value)
  if (!record) return value

  const displayRecommendation = cloneRecord(record.displayRecommendation)
  if (displayRecommendation) {
    displayRecommendation.reason = cleanText(
      displayRecommendation.reason,
      "Start the call with a low-pressure opener that fits the selected playbooks."
    )
    displayRecommendation.target = cleanText(
      displayRecommendation.target,
      cleanText(displayRecommendation.primaryIntentLabel, "Opening context")
    )
    displayRecommendation.playbookLabel = cleanText(
      displayRecommendation.playbookLabel,
      cleanText(record.playbookLabel, "Selected playbooks")
    )
    displayRecommendation.softerAlternative = cleanText(
      displayRecommendation.softerAlternative,
      cleanText(displayRecommendation.question)
    )
    displayRecommendation.alsoCovers = normalizeTextArrayRecords(displayRecommendation.alsoCovers, [
      "playbookFieldId",
      "playbookLabel",
      "fieldLabel",
      "intentClusterId",
    ])
    record.displayRecommendation = displayRecommendation
  }

  const conversationState = cloneRecord(record.conversationState)
  if (conversationState) {
    conversationState.sentiment = cleanText(conversationState.sentiment, "neutral before live customer speech")
    conversationState.pace = cleanText(conversationState.pace, "not established before live customer speech")
    conversationState.customerSignal = cleanText(
      conversationState.customerSignal,
      "No customer speech has been captured yet; use the first question to open naturally."
    )
    conversationState.naturalnessGuidance = cleanText(
      conversationState.naturalnessGuidance,
      "Start with a low-pressure opening question and then listen for the buyer's first signal."
    )
    record.conversationState = conversationState
  }

  const questionLifecycle = cloneRecord(record.questionLifecycle)
  if (questionLifecycle) {
    questionLifecycle.replacementReason = cleanText(
      questionLifecycle.replacementReason,
      "Pre-call readiness selected the best opening recommendation from account context, opportunity history, and selected playbooks."
    )
    record.questionLifecycle = questionLifecycle
  }

  record.coveredIntents = normalizeTextArrayRecords(record.coveredIntents, ["label", "framework", "status", "evidence"])
  record.gaps = normalizeTextArrayRecords(record.gaps, ["label", "status", "detail"])
  record.evidence = normalizeTextArrayRecords(record.evidence, ["label", "framework", "status", "detail"])
  record.evidenceUpdates = normalizeTextArrayRecords(record.evidenceUpdates, [
    "playbookFieldId",
    "intentClusterId",
    "label",
    "framework",
    "status",
    "summary",
  ])
  record.parkedIntents = normalizeTextArrayRecords(record.parkedIntents, [
    "intentClusterId",
    "intentLabel",
    "priority",
    "reasonParked",
    "reentryCue",
    "bridgeQuestion",
    "latestRevisitMoment",
  ]).map((parkedIntent) => ({
    ...parkedIntent,
    relatedPlaybookFields: Array.isArray(parkedIntent.relatedPlaybookFields)
      ? parkedIntent.relatedPlaybookFields
      : [],
  }))
  record.flow = normalizeTextArrayRecords(record.flow, ["label", "detail"])
  record.alternatives = normalizeTextArrayRecords(record.alternatives, ["question", "target", "reason"])
  record.contextUsed = normalizeTextArrayRecords(record.contextUsed, ["source", "field", "influence"])

  const sellerFeedbackRequest = cloneRecord(record.sellerFeedbackRequest)
  if (sellerFeedbackRequest) {
    sellerFeedbackRequest.prompt = cleanText(sellerFeedbackRequest.prompt, "Tell SalesFrame what happened with this suggestion.")
    sellerFeedbackRequest.preferredActions = Array.isArray(sellerFeedbackRequest.preferredActions) && sellerFeedbackRequest.preferredActions.length
      ? sellerFeedbackRequest.preferredActions
      : ["asked", "too_soon", "softer", "skip"]
    record.sellerFeedbackRequest = sellerFeedbackRequest
  }

  return record
}

function assertLiveGuidanceResult(value: unknown, options: { hasTranscript: boolean }): LiveGuidanceResult {
  const record = requireRecord(value, "Live guidance returned an invalid shape.", "openai_invalid_live_guidance")
  const displayRecommendation = requireRecord(
    record.displayRecommendation,
    "Live guidance did not return a display recommendation.",
    "openai_invalid_live_guidance_display"
  )
  const conversationState = requireRecord(
    record.conversationState,
    "Live guidance did not return conversation state.",
    "openai_invalid_live_guidance_conversation_state"
  )
  const questionLifecycle = requireRecord(
    record.questionLifecycle,
    "Live guidance did not return question lifecycle.",
    "openai_invalid_live_guidance_question_lifecycle"
  )

  if (
    !Array.isArray(record.coveredIntents) ||
    !Array.isArray(record.gaps) ||
    !Array.isArray(record.evidence) ||
    !Array.isArray(record.candidateScores) ||
    !Array.isArray(record.evidenceUpdates) ||
    !Array.isArray(record.parkedIntents) ||
    !Array.isArray(record.flow) ||
    !Array.isArray(record.alternatives) ||
    !Array.isArray(record.contextUsed)
  ) {
    throw upstreamFailure("Live guidance returned an invalid shape.", "openai_invalid_live_guidance")
  }

  if (typeof conversationState.shouldAskNow !== "boolean") {
    throw upstreamFailure("Live guidance did not return shouldAskNow.", "openai_invalid_live_guidance_should_ask_now")
  }
  if (record.candidateScores.length !== 3) {
    throw upstreamFailure("Live guidance must return exactly three ranked candidates.", "openai_invalid_live_guidance_candidates")
  }

  const sellerFeedbackRequest = requireRecord(
    record.sellerFeedbackRequest,
    "Live guidance did not return a seller feedback request.",
    "openai_invalid_live_guidance_feedback_request"
  )
  if (!Array.isArray(sellerFeedbackRequest.preferredActions)) {
    throw upstreamFailure("Live guidance returned invalid seller feedback actions.", "openai_invalid_live_guidance_feedback_actions")
  }

  return {
    nextQuestion: requiredText(record.nextQuestion, "Live guidance did not return a next question.", "openai_empty_live_guidance_question"),
    questionReason: requiredText(record.questionReason, "Live guidance did not return question reasoning.", "openai_empty_live_guidance_reason"),
    target: requiredText(record.target, "Live guidance did not return a target.", "openai_empty_live_guidance_target"),
    playbookLabel: requiredText(record.playbookLabel, "Live guidance did not return a playbook label.", "openai_empty_live_guidance_playbook"),
    displayRecommendation: {
      question: requiredText(displayRecommendation.question, "Live guidance display did not return a question.", "openai_empty_live_guidance_display_question"),
      reason: requiredText(displayRecommendation.reason, "Live guidance display did not return a reason.", "openai_empty_live_guidance_display_reason"),
      target: requiredText(displayRecommendation.target, "Live guidance display did not return a target.", "openai_empty_live_guidance_display_target"),
      playbookLabel: requiredText(displayRecommendation.playbookLabel, "Live guidance display did not return a playbook label.", "openai_empty_live_guidance_display_playbook"),
      primaryIntentClusterId: requiredText(displayRecommendation.primaryIntentClusterId, "Live guidance display did not return a primary intent cluster id.", "openai_empty_live_guidance_display_cluster"),
      primaryIntentLabel: requiredText(displayRecommendation.primaryIntentLabel, "Live guidance display did not return a primary intent label.", "openai_empty_live_guidance_display_intent_label"),
      alsoCovers: mapAlsoCovers(displayRecommendation.alsoCovers),
      uiMode: requiredUiMode(displayRecommendation.uiMode, "Live guidance display returned an invalid UI mode.", "openai_invalid_live_guidance_display_ui_mode"),
      confidence: requiredConfidence(displayRecommendation.confidence, "Live guidance display did not return confidence.", "openai_invalid_live_guidance_display_confidence"),
      softerAlternative: requiredText(displayRecommendation.softerAlternative, "Live guidance display did not return a softer alternative.", "openai_empty_live_guidance_softener"),
    },
    coveredCount: requiredNumber(record.coveredCount, "Live guidance did not return covered count.", "openai_invalid_live_guidance_covered_count"),
    activeIntentStatus: requiredLiveIntentStatus(record.activeIntentStatus, "Live guidance returned an invalid active intent status.", "openai_invalid_live_guidance_status"),
    conversationState: {
      conversationStage: requiredText(conversationState.conversationStage, "Live guidance did not return a conversation stage.", "openai_empty_live_guidance_conversation_stage"),
      buyerMood: requiredText(conversationState.buyerMood, "Live guidance did not return buyer mood.", "openai_empty_live_guidance_buyer_mood"),
      flowStage: requiredText(conversationState.flowStage, "Live guidance did not return a flow stage.", "openai_empty_live_guidance_flow_stage"),
      mood: requiredText(conversationState.mood, "Live guidance did not return mood.", "openai_empty_live_guidance_mood"),
      sentiment: requiredOpeningText(conversationState.sentiment, "neutral before live customer speech", options.hasTranscript, "Live guidance did not return sentiment.", "openai_empty_live_guidance_sentiment"),
      pace: requiredOpeningText(conversationState.pace, "not established before live customer speech", options.hasTranscript, "Live guidance did not return pace.", "openai_empty_live_guidance_pace"),
      sellerMove: requiredSellerMove(conversationState.sellerMove, "Live guidance returned an invalid seller move.", "openai_invalid_live_guidance_seller_move"),
      customerSignal: requiredOpeningText(conversationState.customerSignal, "No customer speech has been captured yet; use the first question to open naturally.", options.hasTranscript, "Live guidance did not return customer signal.", "openai_empty_live_guidance_customer_signal"),
      shouldAskNow: conversationState.shouldAskNow,
      naturalnessGuidance: requiredOpeningText(conversationState.naturalnessGuidance, "Start with a low-pressure opening question and then listen for the buyer's first signal.", options.hasTranscript, "Live guidance did not return naturalness guidance.", "openai_empty_live_guidance_naturalness"),
      activeIntent: requiredText(conversationState.activeIntent, "Live guidance did not return active intent.", "openai_empty_live_guidance_active_intent"),
      intentStatus: requiredLiveIntentStatus(conversationState.intentStatus, "Live guidance returned invalid intent status.", "openai_invalid_live_guidance_intent_status"),
      questionTiming: requiredQuestionTiming(conversationState.questionTiming, "Live guidance returned invalid question timing.", "openai_invalid_live_guidance_question_timing"),
      riskLevel: requiredRiskLevel(conversationState.riskLevel, "Live guidance returned invalid risk level.", "openai_invalid_live_guidance_risk"),
      confidence: requiredConfidence(conversationState.confidence, "Live guidance did not return conversation confidence.", "openai_invalid_live_guidance_conversation_confidence"),
    },
    coveredIntents: record.coveredIntents.slice(0, 8).map((item, index) => {
      const intent = requireRecord(item, `Live guidance covered intent ${index + 1} was invalid.`, "openai_invalid_live_guidance_covered_intent")

      return {
        label: requiredText(intent.label, `Live guidance covered intent ${index + 1} did not return a label.`, "openai_empty_live_guidance_covered_intent_label"),
        framework: requiredText(intent.framework, `Live guidance covered intent ${index + 1} did not return a framework.`, "openai_empty_live_guidance_covered_intent_framework"),
        status: requiredLiveIntentStatus(intent.status, `Live guidance covered intent ${index + 1} returned an invalid status.`, "openai_invalid_live_guidance_covered_intent_status"),
        evidence: requiredText(intent.evidence, `Live guidance covered intent ${index + 1} did not return evidence.`, "openai_empty_live_guidance_covered_intent_evidence"),
        confidence: requiredConfidence(intent.confidence, `Live guidance covered intent ${index + 1} did not return confidence.`, "openai_invalid_live_guidance_covered_intent_confidence"),
      }
    }),
    gaps: record.gaps.slice(0, 5).map((item, index) => {
      const gap = requireRecord(item, `Live guidance gap ${index + 1} was invalid.`, "openai_invalid_live_guidance_gap")

      return {
        label: requiredText(gap.label, `Live guidance gap ${index + 1} did not return a label.`, "openai_empty_live_guidance_gap_label"),
        status: requiredGapStatus(gap.status, `Live guidance gap ${index + 1} returned an invalid status.`, "openai_invalid_live_guidance_gap_status"),
        detail: requiredText(gap.detail, `Live guidance gap ${index + 1} did not return detail.`, "openai_empty_live_guidance_gap_detail"),
      }
    }),
    evidence: record.evidence.slice(0, 12).map((item, index) => {
      const evidence = requireRecord(item, `Live guidance evidence ${index + 1} was invalid.`, "openai_invalid_live_guidance_evidence")

      return {
        label: requiredText(evidence.label, `Live guidance evidence ${index + 1} did not return a label.`, "openai_empty_live_guidance_evidence_label"),
        framework: requiredText(evidence.framework, `Live guidance evidence ${index + 1} did not return a framework.`, "openai_empty_live_guidance_evidence_framework"),
        status: requiredLiveIntentStatus(evidence.status, `Live guidance evidence ${index + 1} returned an invalid status.`, "openai_invalid_live_guidance_evidence_status"),
        detail: requiredText(evidence.detail, `Live guidance evidence ${index + 1} did not return detail.`, "openai_empty_live_guidance_evidence_detail"),
      }
    }),
    candidateScores: record.candidateScores.map((item, index) => {
      const candidate = requireRecord(item, `Live guidance candidate ${index + 1} was invalid.`, "openai_invalid_live_guidance_candidate")

      return {
        question: requiredText(candidate.question, `Live guidance candidate ${index + 1} did not return a question.`, "openai_empty_live_guidance_candidate_question"),
        target: requiredText(candidate.target, `Live guidance candidate ${index + 1} did not return a target.`, "openai_empty_live_guidance_candidate_target"),
        playbookLabel: requiredText(candidate.playbookLabel, `Live guidance candidate ${index + 1} did not return a playbook label.`, "openai_empty_live_guidance_candidate_playbook"),
        intentClusterId: requiredText(candidate.intentClusterId, `Live guidance candidate ${index + 1} did not return an intent cluster id.`, "openai_empty_live_guidance_candidate_cluster"),
        methodologyValue: requiredConfidence(candidate.methodologyValue, `Live guidance candidate ${index + 1} did not return methodology value.`, "openai_invalid_live_guidance_candidate_methodology"),
        askNowFit: requiredConfidence(candidate.askNowFit, `Live guidance candidate ${index + 1} did not return ask-now fit.`, "openai_invalid_live_guidance_candidate_ask_now_fit"),
        currentTopicFit: requiredConfidence(candidate.currentTopicFit, `Live guidance candidate ${index + 1} did not return current topic fit.`, "openai_invalid_live_guidance_candidate_topic_fit"),
        stageFit: requiredConfidence(candidate.stageFit, `Live guidance candidate ${index + 1} did not return stage fit.`, "openai_invalid_live_guidance_candidate_stage_fit"),
        naturalness: requiredConfidence(candidate.naturalness, `Live guidance candidate ${index + 1} did not return naturalness.`, "openai_invalid_live_guidance_candidate_naturalness"),
        timingFit: requiredConfidence(candidate.timingFit, `Live guidance candidate ${index + 1} did not return timing fit.`, "openai_invalid_live_guidance_candidate_timing"),
        timingRisk: requiredRiskLevel(candidate.timingRisk, `Live guidance candidate ${index + 1} returned invalid timing risk.`, "openai_invalid_live_guidance_candidate_timing_risk"),
        buyerMoodFit: requiredConfidence(candidate.buyerMoodFit, `Live guidance candidate ${index + 1} did not return buyer mood fit.`, "openai_invalid_live_guidance_candidate_mood"),
        informationGain: requiredConfidence(candidate.informationGain, `Live guidance candidate ${index + 1} did not return information gain.`, "openai_invalid_live_guidance_candidate_gain"),
        reentryPotential: requiredConfidence(candidate.reentryPotential, `Live guidance candidate ${index + 1} did not return re-entry potential.`, "openai_invalid_live_guidance_candidate_reentry"),
        risk: requiredRiskLevel(candidate.risk, `Live guidance candidate ${index + 1} returned invalid risk.`, "openai_invalid_live_guidance_candidate_risk"),
        overallScore: requiredConfidence(candidate.overallScore, `Live guidance candidate ${index + 1} did not return an overall score.`, "openai_invalid_live_guidance_candidate_score"),
        reason: requiredText(candidate.reason, `Live guidance candidate ${index + 1} did not return a reason.`, "openai_empty_live_guidance_candidate_reason"),
      }
    }),
    evidenceUpdates: record.evidenceUpdates.slice(0, 8).map((item, index) => {
      const update = requireRecord(item, `Live guidance evidence update ${index + 1} was invalid.`, "openai_invalid_live_guidance_evidence_update")

      return {
        playbookFieldId: requiredText(update.playbookFieldId, `Live guidance evidence update ${index + 1} did not return a playbook field id.`, "openai_empty_live_guidance_update_field_id"),
        intentClusterId: requiredText(update.intentClusterId, `Live guidance evidence update ${index + 1} did not return an intent cluster id.`, "openai_empty_live_guidance_update_cluster"),
        label: requiredText(update.label, `Live guidance evidence update ${index + 1} did not return a label.`, "openai_empty_live_guidance_update_label"),
        framework: requiredText(update.framework, `Live guidance evidence update ${index + 1} did not return a framework.`, "openai_empty_live_guidance_update_framework"),
        status: requiredLiveIntentStatus(update.status, `Live guidance evidence update ${index + 1} returned invalid status.`, "openai_invalid_live_guidance_update_status"),
        confidence: requiredConfidence(update.confidence, `Live guidance evidence update ${index + 1} did not return confidence.`, "openai_invalid_live_guidance_update_confidence"),
        summary: requiredText(update.summary, `Live guidance evidence update ${index + 1} did not return a summary.`, "openai_empty_live_guidance_update_summary"),
        value: typeof update.value === "string" ? update.value.trim() : "",
      }
    }),
    sellerFeedbackRequest: {
      prompt: requiredText(sellerFeedbackRequest.prompt, "Live guidance did not return seller feedback prompt.", "openai_empty_live_guidance_feedback_prompt"),
      preferredActions: sellerFeedbackRequest.preferredActions.slice(0, 4).map((action, index) =>
        requiredFeedbackAction(action, `Live guidance feedback action ${index + 1} was invalid.`, "openai_invalid_live_guidance_feedback_action")
      ),
    },
    questionLifecycle: {
      currentQuestionState: requiredQuestionLifecycleState(questionLifecycle.currentQuestionState, "Live guidance returned invalid question lifecycle state.", "openai_invalid_live_guidance_lifecycle_state"),
      shouldReplaceQuestion: requiredBoolean(questionLifecycle.shouldReplaceQuestion, "Live guidance did not return whether to replace the question.", "openai_invalid_live_guidance_lifecycle_replace"),
      replacementReason: requiredQuestionReplacementReason(questionLifecycle.replacementReason, questionLifecycle, options.hasTranscript, "Live guidance did not return question replacement reasoning.", "openai_empty_live_guidance_lifecycle_reason"),
      awkwardnessRisk: requiredRiskLevel(questionLifecycle.awkwardnessRisk, "Live guidance returned invalid awkwardness risk.", "openai_invalid_live_guidance_lifecycle_awkwardness"),
      topicShiftConfidence: requiredConfidence(questionLifecycle.topicShiftConfidence, "Live guidance did not return topic shift confidence.", "openai_invalid_live_guidance_lifecycle_topic_shift"),
      stabilityRecommendation: requiredStabilityRecommendation(questionLifecycle.stabilityRecommendation, "Live guidance returned invalid stability recommendation.", "openai_invalid_live_guidance_lifecycle_stability"),
    },
    parkedIntents: record.parkedIntents.slice(0, 4).map((item, index) => {
      const parkedIntent = requireRecord(item, `Live guidance parked intent ${index + 1} was invalid.`, "openai_invalid_live_guidance_parked_intent")
      const relatedPlaybookFields = Array.isArray(parkedIntent.relatedPlaybookFields)
        ? parkedIntent.relatedPlaybookFields.slice(0, 8).map((field) => cleanText(field)).filter(Boolean)
        : []

      return {
        intentClusterId: requiredText(parkedIntent.intentClusterId, `Live guidance parked intent ${index + 1} did not return an intent cluster id.`, "openai_empty_live_guidance_parked_cluster"),
        intentLabel: requiredText(parkedIntent.intentLabel, `Live guidance parked intent ${index + 1} did not return an intent label.`, "openai_empty_live_guidance_parked_label"),
        priority: requiredRiskLevel(parkedIntent.priority, `Live guidance parked intent ${index + 1} returned invalid priority.`, "openai_invalid_live_guidance_parked_priority"),
        reasonParked: requiredText(parkedIntent.reasonParked, `Live guidance parked intent ${index + 1} did not return why it was parked.`, "openai_empty_live_guidance_parked_reason"),
        reentryCue: requiredText(parkedIntent.reentryCue, `Live guidance parked intent ${index + 1} did not return a re-entry cue.`, "openai_empty_live_guidance_parked_reentry"),
        bridgeQuestion: requiredText(parkedIntent.bridgeQuestion, `Live guidance parked intent ${index + 1} did not return a bridge question.`, "openai_empty_live_guidance_parked_bridge"),
        latestRevisitMoment: requiredRevisitMoment(parkedIntent.latestRevisitMoment, `Live guidance parked intent ${index + 1} returned invalid revisit moment.`, "openai_invalid_live_guidance_parked_revisit"),
        relatedPlaybookFields,
      }
    }),
    uiMode: requiredUiMode(record.uiMode, "Live guidance returned an invalid UI mode.", "openai_invalid_live_guidance_ui_mode"),
    flow: record.flow.slice(0, 4).map((item, index) => {
      const flow = requireRecord(item, `Live guidance flow item ${index + 1} was invalid.`, "openai_invalid_live_guidance_flow_item")

      return {
        label: requiredText(flow.label, `Live guidance flow item ${index + 1} did not return a label.`, "openai_empty_live_guidance_flow_label"),
        detail: requiredText(flow.detail, `Live guidance flow item ${index + 1} did not return detail.`, "openai_empty_live_guidance_flow_detail"),
      }
    }),
    alternatives: record.alternatives.slice(0, 3).map((item, index) => {
      const alternative = requireRecord(item, `Live guidance alternative ${index + 1} was invalid.`, "openai_invalid_live_guidance_alternative")

      return {
        question: requiredText(alternative.question, `Live guidance alternative ${index + 1} did not return a question.`, "openai_empty_live_guidance_alternative_question"),
        target: requiredText(alternative.target, `Live guidance alternative ${index + 1} did not return a target.`, "openai_empty_live_guidance_alternative_target"),
        reason: requiredText(alternative.reason, `Live guidance alternative ${index + 1} did not return a reason.`, "openai_empty_live_guidance_alternative_reason"),
      }
    }),
    contextUsed: record.contextUsed.slice(0, 8).map((item, index) => {
      const context = requireRecord(item, `Live guidance context-used item ${index + 1} was invalid.`, "openai_invalid_live_guidance_context_used")
      const source = context.source === "account" || context.source === "opportunity"
        ? context.source
        : null

      if (!source) {
        throw upstreamFailure(`Live guidance context-used item ${index + 1} returned an invalid source.`, "openai_invalid_live_guidance_context_source")
      }

      return {
        source,
        field: requiredText(context.field, `Live guidance context-used item ${index + 1} did not return a field.`, "openai_empty_live_guidance_context_field"),
        influence: requiredText(context.influence, `Live guidance context-used item ${index + 1} did not return an influence.`, "openai_empty_live_guidance_context_influence"),
      }
    }),
  }
}

function normalizeKey(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : ""
}

function normalizeSellerFeedback(value: unknown): SellerFeedbackSignal[] {
  if (!Array.isArray(value)) return []

  return value.slice(-12).flatMap((item) => {
    const record = requireRecord(item, "Seller feedback signal was invalid.", "invalid_seller_feedback")
    const action = record.action
    if (
      action !== "asked" &&
      action !== "too_soon" &&
      action !== "softer" &&
      action !== "skip" &&
      action !== "use_next"
    ) {
      return []
    }

    return [{
      action,
      createdAt: cleanText(record.createdAt),
      playbookLabel: cleanText(record.playbookLabel),
      question: cleanText(record.question),
      reason: cleanText(record.reason),
      target: cleanText(record.target),
    }]
  })
}

function mapEvidenceStatusForPersistence(status: LiveIntentStatus): "missing" | "asked" | "weak" | "confirmed" {
  if (status === "answered" || status === "confirmed") return "confirmed"
  if (status === "asked") return "asked"
  if (status === "weak") return "weak"

  return "missing"
}

function assertGuidanceReferencesSelectedFields({
  intentClusters,
  playbookFields,
  result,
}: {
  intentClusters: PlaybookIntentCluster[]
  playbookFields: Record<string, unknown>[]
  result: LiveGuidanceResult
}) {
  const validClusterIds = new Set(intentClusters.map((cluster) => cluster.id))
  const validPlaybookFieldIds = new Set(playbookFields.map((field) => cleanText(field.id)).filter(Boolean))
  const validClusterFieldPairs = new Set(
    intentClusters.flatMap((cluster) =>
      cluster.fields.map((field) => `${cluster.id}:${field.playbookFieldId}`)
    )
  )

  requireKnownCluster(
    result.displayRecommendation.primaryIntentClusterId,
    validClusterIds,
    "Live guidance referenced an unknown primary intent cluster.",
    "openai_unknown_live_guidance_display_cluster"
  )

  result.candidateScores.forEach((candidate, index) => {
    requireKnownCluster(
      candidate.intentClusterId,
      validClusterIds,
      `Live guidance candidate ${index + 1} referenced an unknown intent cluster.`,
      "openai_unknown_live_guidance_candidate_cluster"
    )
  })

  result.displayRecommendation.alsoCovers.forEach((cover, index) => {
    requireKnownCluster(
      cover.intentClusterId,
      validClusterIds,
      `Live guidance also-covered field ${index + 1} referenced an unknown intent cluster.`,
      "openai_unknown_live_guidance_also_cover_cluster"
    )
    requireKnownPlaybookField(
      cover.playbookFieldId,
      validPlaybookFieldIds,
      `Live guidance also-covered field ${index + 1} referenced an unknown playbook field.`,
      "openai_unknown_live_guidance_also_cover_field"
    )
    requireKnownClusterFieldPair(
      cover.intentClusterId,
      cover.playbookFieldId,
      validClusterFieldPairs,
      `Live guidance also-covered field ${index + 1} referenced a field outside its intent cluster.`,
      "openai_mismatched_live_guidance_also_cover_field"
    )
  })

  result.evidenceUpdates.forEach((update, index) => {
    requireKnownCluster(
      update.intentClusterId,
      validClusterIds,
      `Live guidance evidence update ${index + 1} referenced an unknown intent cluster.`,
      "openai_unknown_live_guidance_update_cluster"
    )
    requireKnownPlaybookField(
      update.playbookFieldId,
      validPlaybookFieldIds,
      `Live guidance evidence update ${index + 1} referenced an unknown playbook field.`,
      "openai_unknown_live_guidance_update_field"
    )
    requireKnownClusterFieldPair(
      update.intentClusterId,
      update.playbookFieldId,
      validClusterFieldPairs,
      `Live guidance evidence update ${index + 1} referenced a field outside its intent cluster.`,
      "openai_mismatched_live_guidance_update_field"
    )
  })

  result.parkedIntents.forEach((parkedIntent, index) => {
    requireKnownCluster(
      parkedIntent.intentClusterId,
      validClusterIds,
      `Live guidance parked intent ${index + 1} referenced an unknown intent cluster.`,
      "openai_unknown_live_guidance_parked_cluster"
    )
  })
}

function sanitizeDisplayAlsoCovers({
  intentClusters,
  playbookFields,
  result,
}: {
  intentClusters: PlaybookIntentCluster[]
  playbookFields: Record<string, unknown>[]
  result: LiveGuidanceResult
}) {
  const validClusterIds = new Set(intentClusters.map((cluster) => cluster.id))
  const validPlaybookFieldIds = new Set(playbookFields.map((field) => cleanText(field.id)).filter(Boolean))
  const validClusterFieldPairs = new Set(
    intentClusters.flatMap((cluster) =>
      cluster.fields.map((field) => `${cluster.id}:${field.playbookFieldId}`)
    )
  )

  const originalCount = result.displayRecommendation.alsoCovers.length
  result.displayRecommendation.alsoCovers = result.displayRecommendation.alsoCovers.filter((cover) => {
    if (!validClusterIds.has(cover.intentClusterId)) return false
    if (!validPlaybookFieldIds.has(cover.playbookFieldId)) return false
    return validClusterFieldPairs.has(`${cover.intentClusterId}:${cover.playbookFieldId}`)
  })

  return originalCount - result.displayRecommendation.alsoCovers.length
}

function requireKnownCluster(value: string, validClusterIds: Set<string>, message: string, code: string) {
  if (!validClusterIds.has(value)) throw upstreamFailure(message, code)
}

function requireKnownPlaybookField(value: string, validPlaybookFieldIds: Set<string>, message: string, code: string) {
  if (!validPlaybookFieldIds.has(value)) throw upstreamFailure(message, code)
}

function requireKnownClusterFieldPair(
  intentClusterId: string,
  playbookFieldId: string,
  validClusterFieldPairs: Set<string>,
  message: string,
  code: string
) {
  if (!validClusterFieldPairs.has(`${intentClusterId}:${playbookFieldId}`)) throw upstreamFailure(message, code)
}

async function persistEvidenceUpdates({
  callId,
  opportunityId,
  playbookFields,
  result,
  supabase,
}: {
  callId: string
  opportunityId: string
  playbookFields: Record<string, unknown>[]
  result: LiveGuidanceResult
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]
}) {
  const selectedPlaybookFieldIds = new Set(playbookFields.map((field) => cleanText(field.id)).filter(Boolean))

  for (const update of result.evidenceUpdates) {
    if (!selectedPlaybookFieldIds.has(update.playbookFieldId)) {
      throw upstreamFailure("Live guidance evidence update referenced an unknown playbook field.", "openai_unknown_live_guidance_update_field")
    }

    const { error } = await supabase
      .from("opportunity_field_evidence")
      .upsert(
        {
          opportunity_id: opportunityId,
          playbook_field_id: update.playbookFieldId,
          status: mapEvidenceStatusForPersistence(update.status),
          value: update.value || null,
          evidence_summary: update.summary,
          confidence: update.confidence,
          source: "live_guidance",
          source_call_id: callId,
        },
        { onConflict: "opportunity_id,playbook_field_id" }
      )

    if (error) throw new Error(error.message)
  }
}

export default async (request: Request, context: Context) => {
  let payloadForDiagnostics: LiveGuidancePayload | null = null

  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<LiveGuidancePayload>(request)
    payloadForDiagnostics = payload
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")
    if (!payload.opportunityId) throw badRequest("opportunityId is required.", "opportunity_id_required")

    const { supabase, token, user } = await requireUser(request)
    const authorizedCall = await authorizeCall(user.id, payload.callId, supabase, { token })
    const authorizedAccount = await authorizeAccount(user.id, payload.accountId, supabase, { token })
    const authorizedOpportunity = await authorizeOpportunity(user.id, payload.opportunityId, supabase, { token })

    if (authorizedCall.account_id !== authorizedAccount.id) {
      throw forbidden("Call does not belong to this account.")
    }
    if (authorizedCall.opportunity_id !== authorizedOpportunity.id) {
      throw forbidden("Call does not belong to this opportunity.")
    }
    if (authorizedOpportunity.account_id !== authorizedAccount.id) {
      throw forbidden("Opportunity does not belong to this account.")
    }

    assertRateLimit({
      key: `${user.id}:${authorizedCall.id}`,
      limit: 90,
      name: "live guidance",
      windowMs: 60 * 1000,
    })

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, authorizedCall.workspace_id)
    const selectedPlaybooks = Array.isArray(payload.playbooks)
      ? payload.playbooks.filter((playbook): playbook is string => typeof playbook === "string" && playbook.trim().length > 0)
      : []
    const sellerFeedback = normalizeSellerFeedback(payload.sellerFeedback)
    const [
      { data: account, error: accountError },
      { data: opportunity, error: opportunityError },
      { data: call, error: callError },
      { data: accountEnrichmentProfile, error: accountEnrichmentError },
      { data: researchRuns, error: researchError },
      { data: priorGuidanceEvents, error: guidanceHistoryError },
      { data: systemPlaybookRows, error: systemPlaybookError },
      { data: workspacePlaybookRows, error: workspacePlaybookError },
      { data: opportunityEvidence, error: evidenceError },
      { data: priorFeedbackRows, error: feedbackError },
    ] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", authorizedAccount.id).single(),
      supabase.from("opportunities").select("*").eq("id", authorizedOpportunity.id).single(),
      supabase.from("calls").select("*").eq("id", authorizedCall.id).single(),
      supabase
        .from("account_enrichment_profiles")
        .select("*")
        .eq("workspace_id", authorizedCall.workspace_id)
        .eq("account_id", authorizedAccount.id)
        .maybeSingle(),
      supabase
        .from("customer_research_runs")
        .select("*")
        .eq("account_id", authorizedAccount.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("live_guidance_events")
        .select("recommended_question,reason,covered_intents,missing_gaps,conversation_flow,created_at")
        .eq("call_id", authorizedCall.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("playbooks")
        .select("*")
        .eq("is_system", true),
      supabase
        .from("playbooks")
        .select("*")
        .eq("workspace_id", authorizedCall.workspace_id),
      supabase
        .from("opportunity_field_evidence")
        .select("*")
        .eq("opportunity_id", authorizedOpportunity.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("live_guidance_feedback")
        .select("*")
        .eq("call_id", authorizedCall.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ])

    if (accountError) throw new Error(accountError.message)
    if (opportunityError) throw new Error(opportunityError.message)
    if (callError) throw new Error(callError.message)
    if (accountEnrichmentError && !isMissingRelationError(accountEnrichmentError)) {
      throw new Error(accountEnrichmentError.message)
    }
    if (researchError) throw new Error(researchError.message)
    if (guidanceHistoryError) throw new Error(guidanceHistoryError.message)
    if (systemPlaybookError) throw new Error(systemPlaybookError.message)
    if (workspacePlaybookError) throw new Error(workspacePlaybookError.message)
    if (evidenceError) throw new Error(evidenceError.message)
    if (feedbackError) throw new Error(feedbackError.message)

    const selectedPlaybookKeys = new Set(selectedPlaybooks.map(normalizeKey))
    const playbookRows = [...(systemPlaybookRows ?? []), ...(workspacePlaybookRows ?? [])]
    const selectedPlaybookRows = (playbookRows ?? []).filter((playbook) => {
      const nameKey = normalizeKey(playbook.name)
      const slugKey = normalizeKey(playbook.slug)
      return selectedPlaybookKeys.size === 0 ||
        selectedPlaybookKeys.has(nameKey) ||
        selectedPlaybookKeys.has(slugKey) ||
        [...selectedPlaybookKeys].some((key) => nameKey.includes(key) || key.includes(nameKey))
    })
    const playbookFieldResponse = selectedPlaybookRows.length
      ? await supabase
          .from("playbook_fields")
          .select("*")
          .in("playbook_id", selectedPlaybookRows.map((playbook) => playbook.id))
          .order("sort_order", { ascending: true })
      : { data: [], error: null }

    if (playbookFieldResponse.error) throw new Error(playbookFieldResponse.error.message)

    const transcript = cleanTranscript(payload.transcript)
    const hasTranscript = transcript.length > 0
    const selectedCallType = payload.callType ?? call.call_type
    const accountProfileContext = buildAccountProfileContext(
      account as Record<string, unknown>,
      payload.accountProfile
    )
    const accountEnrichmentProfileContext = buildAccountEnrichmentProfileContext(
      accountEnrichmentError ? null : accountEnrichmentProfile as Record<string, unknown> | null
    )
    const recordContext = buildRecordContext({
      account: account as Record<string, unknown>,
      accountEnrichmentProfileContext,
      accountProfileContext,
      opportunity: opportunity as Record<string, unknown>,
      selectedCallType,
    })
    const conversationMaturity = getConversationMaturity(transcript)
    const intentClusters = buildPlaybookIntentClusters({
      opportunityEvidence: opportunityEvidence as Record<string, unknown>[],
      playbookFields: (playbookFieldResponse.data ?? []) as Record<string, unknown>[],
      playbooks: selectedPlaybookRows as Record<string, unknown>[],
    })

    if (!intentClusters.length) {
      throw upstreamFailure("Live guidance needs another playbook intent check.", "live_guidance_intent_clusters_empty")
    }

    const guidanceStartedAt = Date.now()
    const rawGuidanceResult = hasTranscript
      ? await callOpenAiJson<unknown>({
        apiKey,
        model: getEnv("OPENAI_LIVE_COACH_MODEL", "gpt-5.4-mini"),
        schema: liveGuidanceSchema,
        schemaName: "salesframe_live_guidance",
        system:
          "You are SalesFrame's live enterprise sales coach. Your job is to make the seller sound like an elite, trusted, human seller in real time. Use the selected sales methodologies strictly, but never make the wording sound like a checklist. Treat intentClusters as the source of truth for what the call needs to learn: rank overlapping intent clusters, not individual playbook checklists. Account and opportunity record fields are secondary business context: they shape timing, depth, specificity, and wording, but selected playbooks and evidence-led intent coverage decide what must be learned. Account Enriched Sales Signals are public-source account intelligence inside recordContext.account.accountEnrichmentProfile: use them to make live questions more specific, timely, relevant, and commercially useful. AI Enriched Sales Signals shape wording and timing but do not complete methodology fields by themselves. Operate in three lanes: fast lane reads meaningful transcript turns and updates intent coverage, thinking lane ranks three candidate seller moves, and background lane records evidence memory for the opportunity. Return only schema-valid JSON. Generate exactly three candidate questions or seller moves internally, each tied to a valid intentClusterId from intentClusters. Score each for methodologyValue, askNowFit, currentTopicFit, stageFit, naturalness, timingFit, timingRisk, buyerMoodFit, informationGain, reentryPotential, risk, and overallScore, then return the winning displayRecommendation plus one softerAlternative. displayRecommendation.primaryIntentClusterId must be a valid cluster id, primaryIntentLabel must be the human cluster label, and alsoCovers must list selected playbook fields from that same intent cluster that this question can update. evidenceUpdates must use playbookFieldId values from intentClusters; never invent field ids, never write evidence to unselected fields, and mark a stricter field weak when the answer is only partial. Use recordContext to avoid redundant questions, shape natural wording, and choose the right depth for the opportunity stage and call type. Do not mark a framework field complete from account or opportunity record context alone unless the saved field is explicit seller-entered evidence for that methodology intent. Always return contextUsed as the account or opportunity fields that materially influenced the recommendation, including accountEnrichmentProfile fields when they shaped wording or timing, or an empty array if none did. Maintain a formal questionLifecycle: active means still natural now, stale means the conversation moved, parked means still valuable but wrong right now, revisit_before_close means recover gently before the call ends, dropped means not useful enough for this call. questionLifecycle.replacementReason must always be a non-empty sentence explaining why the current question should be held, replaced, parked, recovered, or used as the pre-call opener. Use parkedIntents as intent debt: remember high-value unanswered clusters, why they were parked, what cue would make them natural again, and the bridge question that could recover them. If the right move is to listen, acknowledge, clarify, wrap up, park and follow the customer's thread, or recover before close, set uiMode accordingly and make displayRecommendation.question the concise words the seller could say if needed. Treat account profile notes as seller-provided account intelligence: use them to shape context, priorities, and natural follow-ups, but do not blindly repeat sensitive or irrelevant notes. Pick one next move that fits the current conversation flow. If latestTranscriptWindow is empty, this is pre-call readiness: still return a real opening recommendation, set conversationStage to opening, buyerMood and mood to neutral, sentiment to neutral before live customer speech, pace to not established before live customer speech, customerSignal to No customer speech has been captured yet; use the first question to open naturally, naturalnessGuidance to Start with a low-pressure opening question and then listen for the buyer's first signal, and replacementReason to explain why this opener is the right first move. If the customer has naturally answered the intent, mark it answered or confirmed and do not ask it again. If the seller already asked a question that covers the intent, mark it asked and wait for the buyer answer or advance when answered. Use prior guidance events and sellerFeedback as history: asked means the seller used it, too_soon parks the intent unless the customer opens the door, softer requests lower pressure wording, skip drops or deprioritizes the intent unless the customer returns to it. Read buyer mood, sentiment, pace, resistance, confusion, urgency, topic movement, and openness from the recent transcript. Conversation maturity matters: in opening and early stages, ask easy current-state, relevance, agenda, pain, or desired-outcome questions; do not ask about budget, procurement, economic buyer, champion, paper process, quantified metrics, or hard differentiation unless the customer has already raised that topic. In developing and deep stages, go sharper only when it follows the customer's current words. When the customer sounds rushed, confused, defensive, or skeptical, soften the seller move and ask a lower-pressure clarifying question. When the customer is engaged, go deeper into impact, decision process, power, metrics, risk, or next commitment. Do not ask stacked questions. Keep the primary question concise, natural, and customer-language led.",
        input: JSON.stringify({
          callRecordSummary: {
            callType: selectedCallType,
            status: cleanText(call.status),
            startedAt: cleanText(call.started_at),
            endedAt: cleanText(call.ended_at),
          },
          selectedContext: {
            callType: selectedCallType,
            recordContext,
            accountEnrichmentProfile: accountEnrichmentProfileContext,
            accountProfile: accountProfileContext,
            playbooks: selectedPlaybooks,
            playbookFields: playbookFieldResponse.data,
            customerResearch: payload.customerResearch,
            recentResearchRuns: researchRuns,
            priorGuidanceEvents,
            currentGuidance: payload.currentGuidance ?? null,
            priorSellerFeedback: priorFeedbackRows,
            sellerFeedback,
            opportunityEvidence,
            intentClusters,
            conversationMaturity,
            openingPlaybookGuidance: getOpeningPlaybookGuidance(selectedPlaybooks),
            playbookConversationSequence: getPlaybookConversationSequence(selectedPlaybooks),
            refreshContext: payload.refreshContext ?? null,
          },
          latestTranscriptWindow: transcript,
          transcriptState: {
            hasTranscript,
            mode: hasTranscript ? "live_conversation" : "pre_call_readiness",
          },
          coachingRules: [
            "Primary question should usually be 8 to 24 words.",
            "Ask only one thing.",
            "Use the customer's latest words when possible.",
            "Selected playbooks and intent clusters decide what must be learned; account and opportunity record fields only shape wording, sequencing, and timing.",
            "Use recordContext.account fields such as current tools, strategic initiatives, competitors, notes, industry, size, location, and website to make the question specific without sounding scripted.",
            "Use recordContext.opportunity fields such as stage, amount, close date, pain, decision process, next step, manual notes, and call type to choose question depth and avoid asking what the seller already captured.",
            "Early or qualification-stage opportunities should stay lighter and avoid heavy budget, economic-buyer, procurement, metrics, or hard decision-process questions unless the buyer raises them.",
            "Later-stage opportunities may prioritize decision process, metrics, stakeholder risk, timing, next step, or commercial clarity when it naturally follows the conversation.",
            "Return contextUsed for every account or opportunity field that materially changed the recommendation, wording, or timing.",
            "Use account profile notes to avoid generic questions and to connect the next ask to known account context.",
            "Use accountEnrichmentProfile fields such as businessSummary, buyingTriggers, strategicPriorities, techStack, growthSignals, newsSignals, procurementSignals, stakeholderSignals, discoveryAngles, and riskFlags to shape wording and timing.",
            "Enriched account signals are context, not proof: never tick off methodology evidence from enrichment alone.",
            "Never repeat a covered intent just because a framework field is important.",
            "If a prior recommended question has just been asked and the buyer answered, the nextQuestion must move the conversation forward.",
            "If refreshContext.reason is periodic_30_second_ai_recheck, treat it as a mandatory AI audit of the visible recommendation: hold it only when it still clearly fits, otherwise park or replace it with the best next move using the latest transcript and seller feedback.",
            "On periodic rechecks, do not repeat the exact visible question when the seller appears to have asked it, the buyer appears to have answered it, the topic has moved on, or the question now has medium or high awkwardness risk.",
            "If sellerFeedback says too_soon, keep the same intent only if the customer has now opened the door.",
            "If sellerFeedback says softer, preserve the intent but lower pressure and shorten the wording.",
            "If sellerFeedback says skip, move to the next best intent unless the transcript makes the skipped topic urgent.",
            "Candidate scores must make the tradeoff visible: strong methodology questions lose if timing or mood fit is poor.",
            "Separate methodologyValue from askNowFit: an important intent can still be the wrong thing to ask right now.",
            "Hold the current question only when it still fits the buyer's latest thread and has low awkwardness risk.",
            "Replace the current question when the buyer answered its intent, seller feedback changed it, the topic materially shifted, or the current question now has medium or high awkwardness risk.",
            "Park the current intent when it still matters but is no longer natural right now.",
            "Do not return stabilityRecommendation hold if the previous recommendation appears to have been asked and answered.",
            "Keep flow, gaps, evidence, and candidate reason text compact because the live cockpit needs low latency.",
            "If the current intent is valuable but now awkward, set questionLifecycle.currentQuestionState to parked or stale, add it to parkedIntents, and show an on-topic bridge question instead.",
            "If the call is moving toward wrap-up, set uiMode to recover_before_close and recover only the top one or two highest-value parked intents using soft bridge wording.",
            "Use parkedIntents to remember intent debt in the background without creating a visible checklist for the seller.",
            "Rank intent clusters first, then choose wording that can satisfy the most useful overlapping fields without sounding like multiple questions.",
            "Use one natural question even when one answer can update several selected playbook fields.",
            "Use displayRecommendation.alsoCovers to show which selected playbook fields the question may update in the background.",
            "Use evidenceUpdates.playbookFieldId to write each field-level evidence update; do not rely on field labels for persistence.",
            "Return gaps as ranked intent clusters, not as a flat list of every selected playbook field.",
            "If a buyer answer is useful but incomplete for a stricter field, mark that field weak instead of confirmed.",
            "For opening or early maturity, prefer agenda, current-state, relevance, problem, pain, or desired outcome questions.",
            "When latestTranscriptWindow is empty, generate a real first recommendation automatically from account context, opportunity history, call type, selected playbooks, customer research, opportunity evidence, and openingPlaybookGuidance.",
            "When Sandler is selected and there is no transcript yet, strongly prefer an upfront contract / ANOT-style opener that covers agenda, needs or outcomes, time, and next step in natural language.",
            "Do not ask late-stage methodology questions until the customer has given conversational permission or raised that topic.",
            "Respect each selected playbook's natural sequence instead of treating fields as a flat checklist.",
            "If no ask fits the moment, recommend a brief acknowledgement question that keeps flow.",
            "Make the seller sound curious, commercially sharp, and calm.",
            "When latestTranscriptWindow is empty, never leave customerSignal, sentiment, pace, or naturalnessGuidance blank.",
          ],
        }),
      })
      : hydratePreCallGuidanceResult(await callOpenAiJson<PreCallLiveGuidanceResult>({
        apiKey,
        model: getEnv("OPENAI_LIVE_COACH_MODEL", "gpt-5.4-mini"),
        schema: preCallLiveGuidanceSchema,
        schemaName: "salesframe_pre_call_guidance",
        system:
          "You are SalesFrame's live enterprise sales coach. This request is pre-call readiness: no customer transcript exists yet. Return one natural first question that helps the seller open the call calmly and advances the selected playbooks without sounding like a checklist. Rank exactly three internal candidate moves using the provided intentClusters and recordContext. The selected playbooks and intent clusters decide what needs to be learned; account, opportunity, customer research, seller research, and enrichment context only shape timing and wording. Do not ask heavy budget, procurement, economic-buyer, champion, quantified-metrics, or hard decision-process questions in the opener unless the provided opportunity history clearly says the buyer already raised that topic. If Sandler is selected, prefer a natural upfront-contract or ANOT-style opener. Return only schema-valid JSON.",
        input: JSON.stringify({
          selectedContext: {
            callType: selectedCallType,
            recordContext,
            accountEnrichmentProfile: accountEnrichmentProfileContext,
            accountProfile: accountProfileContext,
            playbooks: selectedPlaybooks,
            customerResearch: payload.customerResearch,
            recentResearchRuns: researchRuns.slice(0, 2),
            priorGuidanceEvents: priorGuidanceEvents.slice(0, 3),
            priorSellerFeedback: priorFeedbackRows.slice(0, 4),
            sellerFeedback,
            opportunityEvidence: (opportunityEvidence as Record<string, unknown>[]).slice(0, 12),
            intentClusters,
            conversationMaturity,
            openingPlaybookGuidance: getOpeningPlaybookGuidance(selectedPlaybooks),
            playbookConversationSequence: getPlaybookConversationSequence(selectedPlaybooks),
          },
          latestTranscriptWindow: [],
          transcriptState: {
            hasTranscript: false,
            mode: "pre_call_readiness",
          },
          coachingRules: [
            "Primary question should usually be 8 to 24 words.",
            "Ask only one thing.",
            "Make the first question feel easy to answer.",
            "Use account and opportunity context to avoid generic wording.",
            "Use account enrichment and profile notes only to shape wording, not to mark methodology fields complete.",
            "Return a concrete question or a concise listen/acknowledge move; never return placeholder copy.",
            "questionLifecycle.replacementReason must be a non-empty sentence explaining why this is the right opener.",
            "candidateScores must include exactly three ranked candidates tied to valid intentClusterId values.",
          ],
        }),
      }))
    const result = assertLiveGuidanceResult(
      normalizePreCallGuidanceForValidation(rawGuidanceResult, { hasTranscript }),
      { hasTranscript }
    )
    const guidanceLatencyMs = Math.max(0, Date.now() - guidanceStartedAt)
    if (guidanceLatencyMs > 10000) {
      logSafeEvent("warn", "salesframe_live_guidance_slow", {
        accountId: payload.accountId,
        callId: authorizedCall.id,
        functionName: "live-guidance",
        guidanceLatencyMs,
        hasTranscript,
        opportunityId: authorizedOpportunity.id,
        playbookCount: selectedPlaybooks.length,
        requestId: context.requestId,
      })
    }

    const droppedAlsoCovers = sanitizeDisplayAlsoCovers({
      intentClusters,
      playbookFields: (playbookFieldResponse.data ?? []) as Record<string, unknown>[],
      result,
    })
    if (droppedAlsoCovers > 0) {
      logSafeEvent("warn", "salesframe_live_guidance_also_covers_sanitized", {
        accountId: payload.accountId,
        callId: authorizedCall.id,
        droppedAlsoCovers,
        functionName: "live-guidance",
        hasTranscript,
        opportunityId: authorizedOpportunity.id,
        requestId: context.requestId,
      })
    }

    assertGuidanceReferencesSelectedFields({
      intentClusters,
      playbookFields: (playbookFieldResponse.data ?? []) as Record<string, unknown>[],
      result,
    })

    await supabase.from("live_guidance_events").insert({
      call_id: authorizedCall.id,
      opportunity_id: authorizedOpportunity.id,
      recommended_question: result.displayRecommendation.question,
      reason: result.displayRecommendation.reason,
      selected_call_type: payload.callType ?? call.call_type,
      selected_playbooks: selectedPlaybooks as Json,
      covered_intents: result.coveredIntents as unknown as Json,
      missing_gaps: result.gaps as unknown as Json,
      ui_mode: result.uiMode,
      conversation_state: {
        ...result.conversationState,
        questionLifecycle: result.questionLifecycle,
        parkedIntents: result.parkedIntents,
        recordContextSnapshot: recordContext,
        contextUsed: result.contextUsed,
      } as unknown as Json,
      candidate_scores: result.candidateScores as unknown as Json,
      source_turn_ids: transcript.map((line) => line.id).filter(Boolean) as unknown as Json,
      guidance_latency_ms: guidanceLatencyMs,
      conversation_flow: {
        state: result.conversationState,
        questionLifecycle: result.questionLifecycle,
        parkedIntents: result.parkedIntents,
        displayRecommendation: result.displayRecommendation,
        recordContextSnapshot: recordContext,
        contextUsed: result.contextUsed,
        intentClusters,
        candidateScores: result.candidateScores,
        evidenceUpdates: result.evidenceUpdates,
        flow: result.flow,
        alternatives: result.alternatives,
        sellerFeedbackRequest: result.sellerFeedbackRequest,
        uiMode: result.uiMode,
      } as unknown as Json,
    })

    await persistEvidenceUpdates({
      callId: authorizedCall.id,
      opportunityId: authorizedOpportunity.id,
      playbookFields: playbookFieldResponse.data ?? [],
      result,
      supabase,
    })

    return dataResponse({ guidance: result })
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "live-guidance",
      metadata: {
        accountId: payloadForDiagnostics?.accountId,
        callId: payloadForDiagnostics?.callId,
        hasTranscript: Boolean(payloadForDiagnostics?.transcript?.length),
        opportunityId: payloadForDiagnostics?.opportunityId,
        playbookCount: payloadForDiagnostics?.playbooks?.length ?? 0,
      },
      request,
    })
  }
}

export const config: Config = {
  path: "/api/openai/live-guidance",
  method: ["POST"],
}
