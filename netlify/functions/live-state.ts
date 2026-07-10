import type { Config, Context } from "@netlify/functions"

import type { Database } from "../../src/lib/supabase/database.types"
import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, logSafeEvent, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { assertCallIsLive, authorizeCall, requireUser } from "./_shared/supabase"

type LiveStatePayload = {
  accountId?: string
  callId?: string
  currentGuidance?: unknown
  opportunityId?: string
  playbooks?: string[]
  refreshContext?: Record<string, unknown>
  sellerFeedback?: unknown[]
  transcript?: unknown[]
}

type AccountLiveStateRow = Pick<
  Database["public"]["Tables"]["accounts"]["Row"],
  | "competitors"
  | "current_tools"
  | "currency"
  | "employee_count"
  | "industry"
  | "name"
  | "notes"
  | "region"
  | "strategic_initiatives"
  | "updated_at"
  | "website"
>

type OpportunityLiveStateRow = Pick<
  Database["public"]["Tables"]["opportunities"]["Row"],
  | "amount"
  | "call_type"
  | "close_date"
  | "close_date_note"
  | "coverage_score"
  | "decision_process"
  | "manual_notes"
  | "missing_count"
  | "name"
  | "next_step"
  | "pain"
  | "source"
  | "stage"
  | "updated_at"
  | "weak_count"
>

type CallLiveStateRow = Pick<
  Database["public"]["Tables"]["calls"]["Row"],
  "call_type" | "duration_seconds" | "started_at" | "status" | "title"
>

type LiveStateResult = {
  activeIntent: string
  activeIntentStatus: "confirmed" | "answered" | "asked" | "weak" | "missing"
  buyerMood: "engaged" | "skeptical" | "confused" | "rushed" | "defensive" | "neutral" | "curious"
  confidence: number
  conversationStage: "opening" | "discovery" | "pain" | "impact" | "decision" | "commercial" | "wrap-up"
  customerSignal: string
  naturalnessGuidance: string
  pace: string
  sentiment: string
  intentStatus: "confirmed" | "answered" | "asked" | "weak" | "missing"
  questionTiming: "now" | "wait" | "too_early" | "follow_up_only"
  topicShiftConfidence: number
  shouldAskNow: boolean
  shouldRefreshQuestion: boolean
  refreshReason: string
  sellerMove: "ask" | "listen" | "acknowledge" | "clarify" | "soften" | "go_deeper" | "close_next_step"
  uiMode: "ask_now" | "listen" | "acknowledge" | "clarify" | "wrap_up" | "park_and_follow_flow" | "recover_before_close" | "error"
}

function cleanText(value: unknown, defaultValue = "", maxLength = 2000) {
  const text = typeof value === "string" && value.trim() ? value.trim() : defaultValue
  return text.slice(0, maxLength)
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function compactFlowContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  return {
    reason: cleanText(record.reason),
    elapsedCallSeconds: numberValue(record.elapsedCallSeconds),
    remainingCallSeconds: numberValue(record.remainingCallSeconds),
    elapsedSinceLastQuestionDecisionMs: numberValue(record.elapsedSinceLastQuestionDecisionMs),
    transcriptTurnCount: numberValue(record.transcriptTurnCount),
    turnsSinceLastFullGuidance: numberValue(record.turnsSinceLastFullGuidance),
    latestTranscriptTurnId: cleanText(record.latestTranscriptTurnId),
    latestTranscriptTurnTime: cleanText(record.latestTranscriptTurnTime),
  }
}

function compactCurrentGuidance(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const lifecycle = record.questionLifecycle && typeof record.questionLifecycle === "object" && !Array.isArray(record.questionLifecycle)
    ? record.questionLifecycle as Record<string, unknown>
    : null
  const evidenceCommit = record.evidenceCommit && typeof record.evidenceCommit === "object" && !Array.isArray(record.evidenceCommit)
    ? record.evidenceCommit as Record<string, unknown>
    : null

  return {
    activeIntentStatus: cleanText(record.activeIntentStatus, "", 80),
    answeredCurrentIntent: evidenceCommit?.answeredCurrentIntent === true,
    bankedIntentNote: cleanText(evidenceCommit?.bankedIntentNote, "", 500),
    playbookLabel: cleanText(record.playbookLabel, "", 160),
    primaryIntentClusterId: cleanText(record.primaryIntentClusterId, "", 160),
    primaryIntentLabel: cleanText(record.primaryIntentLabel, "", 160),
    question: cleanText(record.question, "", 600),
    questionLifecycle: lifecycle
      ? {
          currentQuestionState: cleanText(lifecycle.currentQuestionState, "", 80),
          shouldReplaceQuestion: lifecycle.shouldReplaceQuestion === true,
          stabilityRecommendation: cleanText(lifecycle.stabilityRecommendation, "", 80),
        }
      : null,
    reason: cleanText(record.reason, "", 500),
    target: cleanText(record.target, "", 160),
    uiMode: cleanText(record.uiMode, "", 80),
  }
}

function compactSellerFeedback(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const action = cleanText(record.action, "", 40)
    if (!["asked", "too_soon", "softer", "skip", "use_next"].includes(action)) return []

    return [{
      action,
      createdAt: cleanText(record.createdAt, "", 80),
      question: cleanText(record.question, "", 600),
      reason: cleanText(record.reason, "", 500),
      target: cleanText(record.target, "", 160),
    }]
  })
}

function compactTranscript(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(-16).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const text = cleanText(record.text, "", 1200)
    if (!text || record.isPartial === true) return []

    return [{
      audioSourceKind: cleanText(record.audioSourceKind, "", 80),
      endOfTurnConfidence: numberValue(record.endOfTurnConfidence),
      id: cleanText(record.id ?? record.clientId, "", 160),
      speaker: cleanText(record.speakerLabel ?? record.speaker, "Unknown", 80),
      speakerSource: cleanText(record.speakerSource, "", 80),
      time: cleanText(record.time, "", 40),
      text,
      wordConfidence: numberValue(record.wordConfidence),
    }]
  }).slice(-12)
}

function compactAssignedPlaybooks(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const relation = (item as Record<string, unknown>).playbooks
    const playbook = Array.isArray(relation) ? relation[0] : relation
    if (!playbook || typeof playbook !== "object" || Array.isArray(playbook)) return []
    const record = playbook as Record<string, unknown>
    const name = cleanText(record.name, "", 160)
    const slug = cleanText(record.slug, "", 160)

    return name || slug ? [{ name, slug }] : []
  })
}

function buildLiveStateContext({
  account,
  call,
  opportunity,
}: {
  account: AccountLiveStateRow
  call: CallLiveStateRow
  opportunity: OpportunityLiveStateRow
}) {
  return {
    account: {
      name: cleanText(account.name),
      website: cleanText(account.website),
      industry: cleanText(account.industry),
      employeeCount: cleanText(account.employee_count),
      region: cleanText(account.region),
      currency: cleanText(account.currency),
      currentTools: cleanText(account.current_tools),
      strategicInitiatives: cleanText(account.strategic_initiatives),
      competitors: cleanText(account.competitors),
      profileNotes: cleanText(account.notes),
      updatedAt: cleanText(account.updated_at),
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
      callType: cleanText(opportunity.call_type),
      coverageScore: numberValue(opportunity.coverage_score),
      missingCount: numberValue(opportunity.missing_count),
      weakCount: numberValue(opportunity.weak_count),
      updatedAt: cleanText(opportunity.updated_at),
    },
    call: {
      title: cleanText(call.title),
      callType: cleanText(call.call_type),
      status: cleanText(call.status),
      startedAt: cleanText(call.started_at),
      durationSeconds: numberValue(call.duration_seconds),
    },
    contextRules: [
      "Use this context only to classify the conversation flow, timing, mood, and whether the visible question should refresh.",
      "Do not infer methodology completion from account or opportunity context alone.",
      "Do not expose database identifiers, workspace identifiers, owner identifiers, or storage paths in the model input.",
    ],
  }
}

const liveStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "activeIntent",
    "activeIntentStatus",
    "buyerMood",
    "confidence",
    "conversationStage",
    "customerSignal",
    "naturalnessGuidance",
    "pace",
    "sentiment",
    "intentStatus",
    "questionTiming",
    "topicShiftConfidence",
    "shouldAskNow",
    "shouldRefreshQuestion",
    "refreshReason",
    "sellerMove",
    "uiMode",
  ],
  properties: {
    activeIntent: { type: "string" },
    activeIntentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
    buyerMood: { type: "string", enum: ["engaged", "skeptical", "confused", "rushed", "defensive", "neutral", "curious"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    conversationStage: { type: "string", enum: ["opening", "discovery", "pain", "impact", "decision", "commercial", "wrap-up"] },
    customerSignal: { type: "string" },
    naturalnessGuidance: { type: "string" },
    pace: { type: "string" },
    sentiment: { type: "string" },
    intentStatus: { type: "string", enum: ["confirmed", "answered", "asked", "weak", "missing"] },
    questionTiming: { type: "string", enum: ["now", "wait", "too_early", "follow_up_only"] },
    topicShiftConfidence: { type: "number", minimum: 0, maximum: 1 },
    shouldAskNow: { type: "boolean" },
    shouldRefreshQuestion: { type: "boolean" },
    refreshReason: { type: "string" },
    sellerMove: { type: "string", enum: ["ask", "listen", "acknowledge", "clarify", "soften", "go_deeper", "close_next_step"] },
    uiMode: { type: "string", enum: ["ask_now", "listen", "acknowledge", "clarify", "wrap_up", "park_and_follow_flow", "recover_before_close", "error"] },
  },
}

function requireRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw upstreamFailure("Live state returned an invalid shape.", "openai_invalid_live_state")
  }

  return value as LiveStateResult
}

export default async (request: Request, _context: Context) => {
  const requestStartedAt = Date.now()
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await readJson<LiveStatePayload>(request)
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")
    if (!payload.opportunityId) throw badRequest("opportunityId is required.", "opportunity_id_required")

    const { supabase, token, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId, supabase, { token })
    if (call.account_id !== payload.accountId) throw forbidden("Call does not belong to this account.")
    if (call.opportunity_id !== payload.opportunityId) throw forbidden("Call does not belong to this opportunity.")
    assertCallIsLive(call)

    assertRateLimit({
      key: `${user.id}:${call.id}`,
      limit: 180,
      name: "live state",
      windowMs: 60 * 1000,
    })

    const [
      { data: accountDetails, error: accountError },
      { data: opportunityDetails, error: opportunityError },
      { data: callDetails, error: callError },
      { data: callPlaybookRows, error: callPlaybookError },
    ] = await Promise.all([
      supabase
        .from("accounts")
        .select("name,website,industry,employee_count,region,currency,current_tools,strategic_initiatives,competitors,notes,updated_at")
        .eq("id", payload.accountId)
        .eq("workspace_id", call.workspace_id)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select("name,stage,amount,close_date,close_date_note,source,pain,decision_process,next_step,manual_notes,coverage_score,missing_count,weak_count,call_type,updated_at")
        .eq("id", payload.opportunityId)
        .eq("account_id", payload.accountId)
        .eq("workspace_id", call.workspace_id)
        .maybeSingle(),
      supabase
        .from("calls")
        .select("title,call_type,status,started_at,duration_seconds")
        .eq("id", call.id)
        .maybeSingle(),
      supabase
        .from("call_playbooks")
        .select("playbook_id,playbooks(name,slug)")
        .eq("call_id", call.id),
    ])

    if (accountError) throw new Error(accountError.message)
    if (opportunityError) throw new Error(opportunityError.message)
    if (callError) throw new Error(callError.message)
    if (callPlaybookError) throw new Error(callPlaybookError.message)
    if (!accountDetails || !opportunityDetails || !callDetails) {
      throw upstreamFailure("Live state needs another context check.", "live_state_context_missing")
    }

    const liveStateContext = buildLiveStateContext({
      account: accountDetails,
      call: callDetails,
      opportunity: opportunityDetails,
    })
    const currentGuidance = compactCurrentGuidance(payload.currentGuidance)
    const recentTranscript = compactTranscript(payload.transcript)
    const selectedPlaybooks = compactAssignedPlaybooks(callPlaybookRows)
    const sellerFeedback = compactSellerFeedback(payload.sellerFeedback)

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)
    const liveStateModel = getEnv("OPENAI_LIVE_STATE_MODEL", "gpt-5.4-nano")
    const modelStartedAt = Date.now()
    const result = requireRecord(
      await callOpenAiJson<LiveStateResult>({
        apiKey,
        maxOutputTokens: 500,
        model: liveStateModel,
        promptCacheKey: "salesframe-live-state-v2",
        reasoningEffort: "none",
        schema: liveStateSchema,
        schemaName: "salesframe_live_state",
        system:
          "You are SalesFrame's fast live-call flow-decision reader. Return only schema-valid JSON. Do not create a full next question or polished wording. Read liveStateContext, the latest meaningful final transcript turns, currentGuidance, and seller feedback, then classify conversation stage, buyer mood, sentiment, pace, active intent status, topic-shift confidence, and whether the displayed question should be refreshed. liveStateContext contains only seller-visible account, opportunity, and call context; use it for timing and relevance, but do not infer methodology completion from record context alone. The current question has presentation inertia: seller explanation, customer backchannels, silence, minor wording changes, and a periodic audit are not reasons to replace it. shouldRefreshQuestion must be true when the buyer answered the active intent, the seller asked a materially different question, the buyer clearly moved to another valuable topic, the current question has medium/high awkwardness risk, explicit feedback targets the card, or the call is entering wrap-up recovery. A partial, vague, deferred, interrupted, or deflected answer should usually become weak or parked rather than triggering repeated probing. If the current question still fits, return shouldRefreshQuestion false with a short refreshReason explaining why it should hold. If the conversation has moved on, use park_and_follow_flow; if the call is wrapping and one high-value gap should be recovered, use recover_before_close. Keep naturalnessGuidance and refreshReason to one short sentence each.",
        input: JSON.stringify({
          currentGuidance,
          flowContext: compactFlowContext(payload.refreshContext),
          liveStateContext,
          selectedPlaybooks,
          sellerFeedback,
          transcript: recentTranscript,
        }),
        timeoutMs: 4500,
        verbosity: "low",
      })
    )

    logSafeEvent("info", "live_state_ready", {
      functionName: "live-state",
      model: liveStateModel,
      modelLatencyMs: Date.now() - modelStartedAt,
      shouldRefreshQuestion: result.shouldRefreshQuestion,
      totalLatencyMs: Date.now() - requestStartedAt,
      transcriptTurnCount: recentTranscript.length,
      uiMode: result.uiMode,
    })

    return dataResponse({ state: result })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/live-state",
  method: ["POST"],
}
