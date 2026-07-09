import type { Config, Context } from "@netlify/functions"

import type { Database } from "../../src/lib/supabase/database.types"
import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeAccount, authorizeCall, authorizeOpportunity, requireUser } from "./_shared/supabase"

type LiveStatePayload = {
  accountId?: string
  callId?: string
  currentGuidance?: unknown
  opportunityId?: string
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

function cleanText(value: unknown, defaultValue = "") {
  return typeof value === "string" && value.trim() ? value.trim() : defaultValue
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
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
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await readJson<LiveStatePayload>(request)
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")
    if (!payload.opportunityId) throw badRequest("opportunityId is required.", "opportunity_id_required")

    const { supabase, token, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId, supabase, { token })
    const account = await authorizeAccount(user.id, payload.accountId, supabase, { token })
    const opportunity = await authorizeOpportunity(user.id, payload.opportunityId, supabase, { token })

    if (call.account_id !== account.id) throw forbidden("Call does not belong to this account.")
    if (call.opportunity_id !== opportunity.id) throw forbidden("Call does not belong to this opportunity.")
    if (opportunity.account_id !== account.id) throw forbidden("Opportunity does not belong to this account.")

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
    ] = await Promise.all([
      supabase
        .from("accounts")
        .select("name,website,industry,employee_count,region,currency,current_tools,strategic_initiatives,competitors,notes,updated_at")
        .eq("id", account.id)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select("name,stage,amount,close_date,close_date_note,source,pain,decision_process,next_step,manual_notes,coverage_score,missing_count,weak_count,call_type,updated_at")
        .eq("id", opportunity.id)
        .maybeSingle(),
      supabase
        .from("calls")
        .select("title,call_type,status,started_at,duration_seconds")
        .eq("id", call.id)
        .maybeSingle(),
    ])

    if (accountError) throw new Error(accountError.message)
    if (opportunityError) throw new Error(opportunityError.message)
    if (callError) throw new Error(callError.message)
    if (!accountDetails || !opportunityDetails || !callDetails) {
      throw upstreamFailure("Live state needs another context check.", "live_state_context_missing")
    }

    const liveStateContext = buildLiveStateContext({
      account: accountDetails,
      call: callDetails,
      opportunity: opportunityDetails,
    })

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)
    const result = requireRecord(
      await callOpenAiJson<LiveStateResult>({
        apiKey,
        model: getEnv("OPENAI_LIVE_STATE_MODEL", "gpt-5.4-nano"),
        schema: liveStateSchema,
        schemaName: "salesframe_live_state",
        system:
          "You are SalesFrame's fast live-call flow-decision reader. Return only schema-valid JSON. Do not create a full next question or polished wording. Read liveStateContext, the latest meaningful final transcript turns, currentGuidance, and seller feedback, then classify conversation stage, buyer mood, sentiment, pace, active intent status, topic-shift confidence, and whether the displayed question should be refreshed. liveStateContext contains only seller-visible account, opportunity, and call context; use it for timing and relevance, but do not infer methodology completion from record context alone. shouldRefreshQuestion must be true when the buyer answered the active intent, the seller asked a different question, the conversation has materially moved on, the current question has medium/high awkwardness risk, or the call is entering wrap-up recovery. If the current question still fits, return shouldRefreshQuestion false with a short refreshReason explaining why it should hold. If the conversation has moved on, use park_and_follow_flow; if the call is wrapping and a high-value gap should be recovered, use recover_before_close. Keep naturalnessGuidance and refreshReason to one short sentence each.",
        input: JSON.stringify({
          currentGuidance: payload.currentGuidance ?? null,
          liveStateContext,
          sellerFeedback: payload.sellerFeedback ?? [],
          transcript: Array.isArray(payload.transcript) ? payload.transcript.slice(-12) : [],
        }),
      })
    )

    return dataResponse({ state: result })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/live-state",
  method: ["POST"],
}
