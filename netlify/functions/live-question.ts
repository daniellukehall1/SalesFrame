import type { Config, Context } from "@netlify/functions"

import { buildPlaybookIntentClusters } from "../../src/lib/salesframe-intent-clusters"
import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeAccount, authorizeCall, authorizeOpportunity, requireUser } from "./_shared/supabase"

type TranscriptLine = {
  audioSourceKind?: string
  diarizationSpeaker?: string
  endOfTurnConfidence?: number
  id?: string
  isPartial?: boolean
  languageDetected?: string
  providerSessionId?: string
  providerTurnIndex?: number
  speaker?: string
  speakerLabel?: string
  speakerSource?: string
  text?: string
  time?: string
  wordConfidence?: number
}

type SellerFeedbackSignal = {
  action?: "asked" | "too_soon" | "softer" | "skip" | "use_next"
  createdAt?: string
  playbookLabel?: string
  question?: string
  reason?: string
  target?: string
}

type LiveQuestionPayload = {
  accountId?: string
  accountProfile?: Record<string, unknown>
  callId?: string
  callType?: string
  currentGuidance?: unknown
  customerResearch?: Record<string, unknown>
  opportunityId?: string
  playbooks?: string[]
  refreshContext?: Record<string, unknown>
  sellerFeedback?: SellerFeedbackSignal[]
  transcript?: TranscriptLine[]
}

type LiveQuestionResult = {
  question: string
  shortReason: string
  target: string
  playbookLabel: string
  primaryIntentClusterId: string
  primaryIntentLabel: string
  alsoCovers: {
    fieldLabel: string
    intentClusterId: string
    playbookFieldId: string
    playbookLabel: string
  }[]
  uiMode: "ask_now" | "listen" | "acknowledge" | "clarify" | "wrap_up" | "park_and_follow_flow" | "recover_before_close" | "error"
  confidence: number
  softerAlternative: string
  activeIntentStatus: "confirmed" | "answered" | "asked" | "weak" | "missing"
  conversationStage: "opening" | "discovery" | "pain" | "impact" | "decision" | "commercial" | "wrap-up"
  buyerMood: "engaged" | "skeptical" | "confused" | "rushed" | "defensive" | "neutral" | "curious"
  sellerMove: "ask" | "listen" | "acknowledge" | "clarify" | "soften" | "go_deeper" | "close_next_step"
  customerSignal: string
  naturalnessGuidance: string
  shouldAskNow: boolean
  questionTiming: "now" | "wait" | "too_early" | "follow_up_only"
  riskLevel: "low" | "medium" | "high"
  topicShiftConfidence: number
  questionLifecycle: {
    awkwardnessRisk: "low" | "medium" | "high"
    currentQuestionState: "active" | "asked" | "answered" | "stale" | "parked" | "revisit_before_close" | "dropped"
    replacementReason: string
    shouldReplaceQuestion: boolean
    stabilityRecommendation: "hold" | "replace" | "park" | "recover"
    topicShiftConfidence: number
  }
  contextUsed: {
    field: string
    influence: string
    source: "account" | "opportunity"
  }[]
  mustReplacePreviousQuestion: boolean
}

function cleanText(value: unknown, defaultValue = "") {
  return typeof value === "string" && value.trim() ? value.trim() : defaultValue
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function normalizeKey(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : ""
}

function normalizeQuestion(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "")
}

function cleanTranscript(transcript: TranscriptLine[] | undefined) {
  return Array.isArray(transcript)
    ? transcript
        .filter((line) => line && typeof line.text === "string" && line.text.trim())
        .filter((line) => !line.isPartial)
        .slice(-12)
        .map((line) => ({
          audioSourceKind: cleanText(line.audioSourceKind),
          diarizationSpeaker: cleanText(line.diarizationSpeaker),
          endOfTurnConfidence: cleanNumber(line.endOfTurnConfidence),
          id: cleanText(line.id),
          languageDetected: cleanText(line.languageDetected),
          providerSessionId: cleanText(line.providerSessionId),
          providerTurnIndex: cleanNumber(line.providerTurnIndex),
          speaker: cleanText(line.speaker ?? line.speakerLabel, "Unknown"),
          speakerSource: cleanText(line.speakerSource),
          time: cleanText(line.time),
          text: cleanText(line.text),
          wordConfidence: cleanNumber(line.wordConfidence),
        }))
    : []
}

function normalizeSellerFeedback(value: unknown): SellerFeedbackSignal[] {
  if (!Array.isArray(value)) return []

  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
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

function compactRecordContext({
  account,
  accountEnrichmentProfile,
  accountProfile,
  opportunity,
  selectedCallType,
}: {
  account: Record<string, unknown>
  accountEnrichmentProfile: Record<string, unknown> | null
  accountProfile?: Record<string, unknown>
  opportunity: Record<string, unknown>
  selectedCallType: string
}) {
  return {
    account: {
      name: cleanText(account.name),
      website: cleanText(accountProfile?.website) || cleanText(account.website),
      industry: cleanText(account.industry),
      employeeCount: cleanText(accountProfile?.employeeCount) || cleanText(account.employee_count),
      location: cleanText(accountProfile?.region) || cleanText(account.region),
      currency: cleanText(account.currency),
      currentTools: cleanText(accountProfile?.currentTools) || cleanText(account.current_tools),
      strategicInitiatives: cleanText(accountProfile?.strategicInitiatives) || cleanText(account.strategic_initiatives),
      competitors: cleanText(accountProfile?.competitors) || cleanText(account.competitors),
      profileNotes:
        cleanText(accountProfile?.profileNotes) ||
        cleanText(accountProfile?.accountNotes) ||
        cleanText(account.notes),
      enrichment: {
        businessSummary: cleanText(accountEnrichmentProfile?.business_summary),
        likelyBuyingTriggers: cleanText(accountEnrichmentProfile?.likely_buying_triggers),
        strategicPriorities: cleanText(accountEnrichmentProfile?.strategic_priorities),
        currentTechStack: cleanText(accountEnrichmentProfile?.current_tech_stack),
        recentNewsSignals: cleanText(accountEnrichmentProfile?.recent_news_signals),
        reviewSentimentSignals: cleanText(accountEnrichmentProfile?.review_sentiment_signals),
        likelyStakeholders: cleanText(accountEnrichmentProfile?.likely_stakeholders),
        discoveryAngles: cleanText(accountEnrichmentProfile?.discovery_angles),
        riskFlags: cleanText(accountEnrichmentProfile?.risk_flags),
        confidence: cleanText(accountEnrichmentProfile?.confidence),
      },
    },
    opportunity: {
      name: cleanText(opportunity.name),
      stage: cleanText(opportunity.stage),
      amount: cleanText(opportunity.amount),
      closeDate: cleanText(opportunity.close_date),
      closeDateNote: cleanText(opportunity.close_date_note),
      source: cleanText(opportunity.source),
      pain: cleanText(opportunity.pain),
      decisionProcess: cleanText(opportunity.decision_process),
      nextStep: cleanText(opportunity.next_step),
      manualNotes: cleanText(opportunity.manual_notes),
      callType: selectedCallType || cleanText(opportunity.call_type),
      coverageScore: cleanNumber(opportunity.coverage_score),
      missingCount: cleanNumber(opportunity.missing_count),
      weakCount: cleanNumber(opportunity.weak_count),
    },
    contextRules: [
      "Selected playbooks and intent clusters decide what must be learned.",
      "Account and opportunity record fields shape wording, depth, timing, and redundancy checks.",
      "Do not mark methodology fields complete from record context alone.",
      "Prefer one natural seller move that fits the current conversation flow.",
    ],
  }
}

function compactEvidenceRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, 24).map((row) => ({
    playbookFieldId: cleanText(row.playbook_field_id),
    fieldLabel: cleanText(row.field_label),
    playbookLabel: cleanText(row.playbook_label),
    status: cleanText(row.status),
    summary: cleanText(row.summary),
    confidence: cleanNumber(row.confidence),
    updatedAt: cleanText(row.updated_at),
  }))
}

function latestActedQuestion(feedback: SellerFeedbackSignal[]) {
  return [...feedback]
    .reverse()
    .find((signal) => signal.action === "asked" || signal.action === "skip" || signal.action === "too_soon" || signal.action === "softer")
}

function requireLiveQuestionResult(
  value: unknown,
  blockedQuestions: string[],
  fallbacks: {
    playbookLabel: string
    primaryIntentClusterId: string
    primaryIntentLabel: string
    target: string
  }
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw upstreamFailure("Live question returned an invalid shape.", "openai_invalid_live_question")
  }

  const result = value as LiveQuestionResult
  const question = cleanText(result.question)
  const shortReason = cleanText(result.shortReason)
  const primaryIntentClusterId = cleanText(result.primaryIntentClusterId, fallbacks.primaryIntentClusterId)
  const primaryIntentLabel = cleanText(result.primaryIntentLabel, fallbacks.primaryIntentLabel)
  const target = cleanText(result.target, primaryIntentLabel || fallbacks.target)
  const playbookLabel = cleanText(result.playbookLabel, fallbacks.playbookLabel)
  const lifecycle = result.questionLifecycle
  const replacementReason = lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle)
    ? cleanText(lifecycle.replacementReason, shortReason)
    : ""

  if (!question || !shortReason || !target || !playbookLabel || !primaryIntentClusterId || !primaryIntentLabel) {
    throw upstreamFailure("Live question did not return a complete recommendation.", "openai_invalid_live_question_recommendation")
  }
  if (!lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle) || !replacementReason) {
    throw upstreamFailure("Live question did not return question lifecycle reasoning.", "openai_invalid_live_question_lifecycle")
  }

  if (blockedQuestions.includes(normalizeQuestion(question))) {
    throw upstreamFailure("Live question repeated the acted-on question.", "openai_repeated_live_question")
  }

  return {
    ...result,
    question,
    shortReason,
    target,
    playbookLabel,
    primaryIntentClusterId,
    primaryIntentLabel,
    questionLifecycle: {
      ...result.questionLifecycle,
      replacementReason,
    },
  }
}

const liveQuestionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question",
    "shortReason",
    "target",
    "playbookLabel",
    "primaryIntentClusterId",
    "primaryIntentLabel",
    "alsoCovers",
    "uiMode",
    "confidence",
    "softerAlternative",
    "activeIntentStatus",
    "conversationStage",
    "buyerMood",
    "sellerMove",
    "customerSignal",
    "naturalnessGuidance",
    "shouldAskNow",
    "questionTiming",
    "riskLevel",
    "topicShiftConfidence",
    "questionLifecycle",
    "contextUsed",
    "mustReplacePreviousQuestion",
  ],
  properties: {
    question: { type: "string" },
    shortReason: { type: "string" },
    target: { type: "string" },
    playbookLabel: { type: "string" },
    primaryIntentClusterId: { type: "string" },
    primaryIntentLabel: { type: "string" },
    alsoCovers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fieldLabel", "intentClusterId", "playbookFieldId", "playbookLabel"],
        properties: {
          fieldLabel: { type: "string" },
          intentClusterId: { type: "string" },
          playbookFieldId: { type: "string" },
          playbookLabel: { type: "string" },
        },
      },
    },
    uiMode: { type: "string", enum: ["ask_now", "listen", "acknowledge", "clarify", "wrap_up", "park_and_follow_flow", "recover_before_close", "error"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    softerAlternative: { type: "string" },
    activeIntentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
    conversationStage: { type: "string", enum: ["opening", "discovery", "pain", "impact", "decision", "commercial", "wrap-up"] },
    buyerMood: { type: "string", enum: ["engaged", "skeptical", "confused", "rushed", "defensive", "neutral", "curious"] },
    sellerMove: { type: "string", enum: ["ask", "listen", "acknowledge", "clarify", "soften", "go_deeper", "close_next_step"] },
    customerSignal: { type: "string" },
    naturalnessGuidance: { type: "string" },
    shouldAskNow: { type: "boolean" },
    questionTiming: { type: "string", enum: ["now", "wait", "too_early", "follow_up_only"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    topicShiftConfidence: { type: "number", minimum: 0, maximum: 1 },
    questionLifecycle: {
      type: "object",
      additionalProperties: false,
      required: [
        "awkwardnessRisk",
        "currentQuestionState",
        "replacementReason",
        "shouldReplaceQuestion",
        "stabilityRecommendation",
        "topicShiftConfidence",
      ],
      properties: {
        awkwardnessRisk: { type: "string", enum: ["low", "medium", "high"] },
        currentQuestionState: { type: "string", enum: ["active", "asked", "answered", "stale", "parked", "revisit_before_close", "dropped"] },
        replacementReason: { type: "string" },
        shouldReplaceQuestion: { type: "boolean" },
        stabilityRecommendation: { type: "string", enum: ["hold", "replace", "park", "recover"] },
        topicShiftConfidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    contextUsed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "influence", "source"],
        properties: {
          field: { type: "string" },
          influence: { type: "string" },
          source: { type: "string", enum: ["account", "opportunity"] },
        },
      },
    },
    mustReplacePreviousQuestion: { type: "boolean" },
  },
}

function hydrateGuidance(result: LiveQuestionResult) {
  return {
    nextQuestion: result.question,
    questionReason: result.shortReason,
    target: result.target,
    playbookLabel: result.playbookLabel,
    displayRecommendation: {
      question: result.question,
      reason: result.shortReason,
      target: result.target,
      playbookLabel: result.playbookLabel,
      primaryIntentClusterId: result.primaryIntentClusterId,
      primaryIntentLabel: result.primaryIntentLabel,
      alsoCovers: result.alsoCovers,
      uiMode: result.uiMode,
      confidence: result.confidence,
      softerAlternative: result.softerAlternative,
    },
    coveredCount: 0,
    activeIntentStatus: result.activeIntentStatus,
    conversationState: {
      conversationStage: result.conversationStage,
      buyerMood: result.buyerMood,
      flowStage: result.conversationStage,
      mood: result.buyerMood,
      sentiment: result.buyerMood,
      pace: "live",
      sellerMove: result.sellerMove,
      customerSignal: result.customerSignal,
      shouldAskNow: result.shouldAskNow,
      naturalnessGuidance: result.naturalnessGuidance,
      activeIntent: result.primaryIntentLabel,
      intentStatus: result.activeIntentStatus,
      questionTiming: result.questionTiming,
      riskLevel: result.riskLevel,
      confidence: result.confidence,
      topicShiftConfidence: result.topicShiftConfidence,
      activeIntentStatus: result.activeIntentStatus,
      shouldRefreshQuestion: result.mustReplacePreviousQuestion,
      refreshReason: result.questionLifecycle.replacementReason,
    },
    evidence: [],
    gaps: [],
    questionLifecycle: result.questionLifecycle,
    parkedIntents: [],
    sellerFeedbackRequest: {
      prompt: "Use Asked, Too soon, Softer, or Skip to steer the live coach.",
      preferredActions: ["asked", "too_soon", "softer", "skip"],
    },
    contextUsed: result.contextUsed,
    uiMode: result.uiMode,
    flow: [{
      label: "Live coach",
      detail: result.shortReason,
    }],
  }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await readJson<LiveQuestionPayload>(request)
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")
    if (!payload.opportunityId) throw badRequest("opportunityId is required.", "opportunity_id_required")

    const { supabase, user } = await requireUser(request)
    const authorizedCall = await authorizeCall(user.id, payload.callId)
    const authorizedAccount = await authorizeAccount(user.id, payload.accountId)
    const authorizedOpportunity = await authorizeOpportunity(user.id, payload.opportunityId)

    if (authorizedCall.account_id !== authorizedAccount.id) throw forbidden("Call does not belong to this account.")
    if (authorizedCall.opportunity_id !== authorizedOpportunity.id) throw forbidden("Call does not belong to this opportunity.")
    if (authorizedOpportunity.account_id !== authorizedAccount.id) throw forbidden("Opportunity does not belong to this account.")

    assertRateLimit({
      key: `${user.id}:${authorizedCall.id}`,
      limit: 180,
      name: "live question",
      windowMs: 60 * 1000,
    })

    const selectedPlaybooks = Array.isArray(payload.playbooks)
      ? payload.playbooks.filter((playbook): playbook is string => typeof playbook === "string" && playbook.trim().length > 0)
      : []
    const selectedPlaybookKeys = new Set(selectedPlaybooks.map(normalizeKey))
    const sellerFeedback = normalizeSellerFeedback(payload.sellerFeedback)
    const actedQuestion = latestActedQuestion(sellerFeedback)
    const blockedQuestions = actedQuestion?.action === "asked" || actedQuestion?.action === "skip"
      ? [normalizeQuestion(actedQuestion.question)]
      : []

    const [
      { data: account, error: accountError },
      { data: opportunity, error: opportunityError },
      { data: call, error: callError },
      { data: accountEnrichmentProfile, error: accountEnrichmentError },
      { data: playbookRows, error: playbookError },
      { data: opportunityEvidence, error: evidenceError },
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
        .from("playbooks")
        .select("*")
        .or(`is_system.eq.true,workspace_id.eq.${authorizedCall.workspace_id}`),
      supabase
        .from("opportunity_field_evidence")
        .select("*")
        .eq("opportunity_id", authorizedOpportunity.id)
        .order("updated_at", { ascending: false }),
    ])

    if (accountError) throw new Error(accountError.message)
    if (opportunityError) throw new Error(opportunityError.message)
    if (callError) throw new Error(callError.message)
    if (accountEnrichmentError && !isMissingRelationError(accountEnrichmentError)) {
      throw new Error(accountEnrichmentError.message)
    }
    if (playbookError) throw new Error(playbookError.message)
    if (evidenceError) throw new Error(evidenceError.message)

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

    const intentClusters = buildPlaybookIntentClusters({
      opportunityEvidence: (opportunityEvidence ?? []) as Record<string, unknown>[],
      playbookFields: (playbookFieldResponse.data ?? []) as Record<string, unknown>[],
      playbooks: selectedPlaybookRows as Record<string, unknown>[],
    })

    if (!intentClusters.length) {
      throw upstreamFailure("Live question needs selected playbook intents.", "live_question_intent_clusters_empty")
    }

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, authorizedCall.workspace_id)
    const selectedCallType = payload.callType ?? call.call_type
    const transcript = cleanTranscript(payload.transcript)
    const recordContext = compactRecordContext({
      account: account as Record<string, unknown>,
      accountEnrichmentProfile: accountEnrichmentError ? null : accountEnrichmentProfile as Record<string, unknown> | null,
      accountProfile: payload.accountProfile,
      opportunity: opportunity as Record<string, unknown>,
      selectedCallType: cleanText(selectedCallType),
    })

    const rawResult = await callOpenAiJson<unknown>({
      apiKey,
      model: getEnv("OPENAI_LIVE_QUESTION_MODEL", "gpt-5.4-mini"),
      schema: liveQuestionSchema,
      schemaName: "salesframe_live_question",
      system:
        "You are SalesFrame's low-latency live sales coach. Return only schema-valid JSON for the single visible Ask this next card. Use selected intent clusters and previous evidence to decide what must be learned, but use account and opportunity context to make the wording specific and avoid asking what is already known. The transcript window contains final Deepgram Flux turns only; use audioSourceKind, providerTurnIndex, diarizationSpeaker, endOfTurnConfidence, and wordConfidence to understand source separation, turn order, speaker confidence, and whether a turn is reliable enough to act on. Keep the current question stable only if it still fits the live conversation. If sellerFeedback says asked, skip, or too_soon, do not repeat the acted-on question. Asked means either wait for the buyer answer if there is no answer yet, or move to the next best intent if the buyer answered. Skip means choose another intent or a listen/acknowledge move. Too soon means park that intent. Softer means keep the intent but lower the pressure. Never invent deterministic fallback copy; return one AI-ranked seller move. Never ask heavy budget, procurement, economic buyer, metrics, or decision-process questions in opening unless the buyer raised the topic. Keep the question concise, natural, and customer-language led.",
      input: JSON.stringify({
        selectedContext: {
          call: {
            callType: selectedCallType,
            status: cleanText(call.status),
            startedAt: cleanText(call.started_at),
          },
          currentGuidance: payload.currentGuidance ?? null,
          customerResearch: payload.customerResearch ?? null,
          opportunityEvidence: compactEvidenceRows((opportunityEvidence ?? []) as Record<string, unknown>[]),
          recordContext,
          selectedPlaybooks: selectedPlaybookRows.map((playbook) => ({
            id: playbook.id,
            name: playbook.name,
            slug: playbook.slug,
          })),
          intentClusters: intentClusters.slice(0, 10),
          sellerFeedback,
          blockedQuestions,
          refreshContext: payload.refreshContext ?? null,
        },
        latestTranscriptWindow: transcript,
        rules: [
          "Return a replacement quickly when the buyer answered the active intent, the seller clicked a control, or the topic moved.",
          "Treat low-confidence Deepgram turns as useful context but avoid making brittle evidence decisions from them.",
          "If the right move is to listen or acknowledge, still return the exact words the seller can say if they need to speak.",
          "Do not repeat any blockedQuestions.",
          "mustReplacePreviousQuestion must be true for seller feedback, answered intent, topic shift, or periodic audit replacement.",
          "contextUsed should name only the account or opportunity fields that actually shaped the wording or timing.",
        ],
      }),
    })

    const fallbackIntentCluster = intentClusters.find((cluster) => cluster.status !== "confirmed") ?? intentClusters[0]
    const fallbackIntentField = fallbackIntentCluster?.fields[0]
    const result = requireLiveQuestionResult(rawResult, blockedQuestions, {
      playbookLabel: cleanText(fallbackIntentField?.playbookLabel, selectedPlaybookRows[0]?.name ?? "Selected playbook"),
      primaryIntentClusterId: cleanText(fallbackIntentCluster?.id, "selected_intent"),
      primaryIntentLabel: cleanText(fallbackIntentCluster?.label, "Selected intent"),
      target: cleanText(fallbackIntentCluster?.label, "Selected intent"),
    })

    return dataResponse({ guidance: hydrateGuidance(result) })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/live-question",
  method: ["POST"],
}
