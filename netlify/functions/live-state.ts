import type { Config, Context } from "@netlify/functions"

import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { authorizeAccount, authorizeCall, authorizeOpportunity, requireUser } from "./_shared/supabase"

type LiveStatePayload = {
  accountId?: string
  callId?: string
  currentGuidance?: unknown
  opportunityId?: string
  sellerFeedback?: unknown[]
  transcript?: unknown[]
}

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

    const { supabase, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId)
    const account = await authorizeAccount(user.id, payload.accountId)
    const opportunity = await authorizeOpportunity(user.id, payload.opportunityId)

    if (call.account_id !== account.id) throw forbidden("Call does not belong to this account.")
    if (call.opportunity_id !== opportunity.id) throw forbidden("Call does not belong to this opportunity.")
    if (opportunity.account_id !== account.id) throw forbidden("Opportunity does not belong to this account.")

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)
    const result = requireRecord(
      await callOpenAiJson<LiveStateResult>({
        apiKey,
        model: getEnv("OPENAI_LIVE_STATE_MODEL", "gpt-5.4-nano"),
        schema: liveStateSchema,
        schemaName: "salesframe_live_state",
        system:
          "You are SalesFrame's fast live-call flow-decision reader. Return only schema-valid JSON. Do not create a full next question or polished wording. Read the latest meaningful final transcript turns, currentGuidance, and seller feedback, then classify conversation stage, buyer mood, sentiment, pace, active intent status, topic-shift confidence, and whether the displayed question should be refreshed. shouldRefreshQuestion must be true when the buyer answered the active intent, the seller asked a different question, the conversation has materially moved on, the current question has medium/high awkwardness risk, or the call is entering wrap-up recovery. If the current question still fits, return shouldRefreshQuestion false with a short refreshReason explaining why it should hold. If the conversation has moved on, use park_and_follow_flow; if the call is wrapping and a high-value gap should be recovered, use recover_before_close. Keep naturalnessGuidance and refreshReason to one short sentence each.",
        input: JSON.stringify({
          account,
          call,
          currentGuidance: payload.currentGuidance ?? null,
          opportunity,
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
