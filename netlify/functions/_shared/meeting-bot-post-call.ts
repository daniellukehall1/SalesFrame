import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { AppError, logSafeEvent } from "./http"
import { asMeetingBotDb } from "./meeting-bot-store"
import type { MeetingBotSessionRow } from "./meeting-bot-types"
import { getDecryptedOpenAiKey } from "./openai-key"

export {
  createMeetingBotPostCallDispatch,
  dispatchMeetingBotPostCall,
  verifyMeetingBotPostCallDispatch,
  type MeetingBotPostCallDispatch,
} from "./meeting-bot-post-call-dispatch"

export type MeetingBotPostCallGenerationResult = {
  claimed: boolean
  output: MeetingBotPostCallOutput | null
}

export type MeetingBotPostCallOutput = {
  nextCallBrief: unknown
  postCallOutput: unknown
  result: unknown | null
}

export type MeetingBotPostCallGenerator = (options: {
  apiKey: string
  apiKeyUserId: string
  callId: string
  sourceMeetingBotSessionId: string
  supabase: SupabaseClient<Database>
}) => Promise<MeetingBotPostCallOutput>

function safePostCallErrorCode(error: unknown) {
  if (error instanceof AppError && /^[a-z0-9_.-]{1,120}$/.test(error.code)) return error.code
  if (error instanceof Error && /save an openai api key/i.test(error.message)) return "openai_key_missing"
  return "post_call_generation_failed"
}

async function claimMeetingBotPostCall({
  forceRetry,
  sessionId,
  supabase,
  workerId,
}: {
  forceRetry: boolean
  sessionId: string
  supabase: SupabaseClient<Database>
  workerId: string
}) {
  const { data, error } = await asMeetingBotDb(supabase).rpc("claim_meeting_bot_post_call", {
    force_retry: forceRetry,
    lease_seconds: 300,
    target_session_id: sessionId,
    worker_id: workerId.slice(0, 160),
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as MeetingBotSessionRow | null
}

async function authorizeClaimedMeetingBotPostCall({
  apiKeyUserId,
  session,
  supabase,
}: {
  apiKeyUserId?: string
  session: MeetingBotSessionRow
  supabase: SupabaseClient<Database>
}) {
  const db = asMeetingBotDb(supabase)
  const { data: call, error: callError } = await db
    .from("calls")
    .select("id,workspace_id,account_id,opportunity_id,capture_method")
    .eq("id", session.call_id)
    .eq("workspace_id", session.workspace_id)
    .eq("account_id", session.account_id)
    .eq("opportunity_id", session.opportunity_id)
    .maybeSingle()
  if (callError) throw new Error(callError.message)
  if (!call || call.capture_method !== "recall_meeting_bot") {
    throw new AppError(
      "meeting_bot_post_call_scope_mismatch",
      "Post-call processing could not verify this call.",
      409
    )
  }

  const keyUserId = apiKeyUserId ?? session.requested_by_user_id
  if (!keyUserId) {
    throw new AppError(
      "meeting_bot_post_call_requester_missing",
      "An authorised workspace member needs to retry this post-call brief.",
      409
    )
  }

  const { data: membership, error: membershipError } = await db
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", session.workspace_id)
    .eq("user_id", keyUserId)
    .maybeSingle()
  if (membershipError) throw new Error(membershipError.message)
  if (!membership) {
    throw new AppError(
      "meeting_bot_post_call_requester_unauthorized",
      "An authorised workspace member needs to retry this post-call brief.",
      409
    )
  }

  return keyUserId
}

async function getExistingMeetingBotPostCallOutput(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const db = asMeetingBotDb(supabase)
  const [{ data: postCallOutput, error: outputError }, { data: session, error: sessionError }] = await Promise.all([
    db
      .from("post_call_outputs")
      .select("*")
      .eq("source_meeting_bot_session_id", sessionId)
      .maybeSingle(),
    db
      .from("meeting_bot_sessions")
      .select("call_id")
      .eq("id", sessionId)
      .maybeSingle(),
  ])
  if (outputError) throw new Error(outputError.message)
  if (sessionError) throw new Error(sessionError.message)
  const { data: nextCallBrief, error: briefError } = session?.call_id
    ? await db
        .from("next_call_briefs")
        .select("*")
        .eq("previous_call_id", session.call_id)
        .eq("schema_version", 2)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null }
  if (briefError) throw new Error(briefError.message)
  if (!postCallOutput || !nextCallBrief) return null

  return {
    nextCallBrief,
    postCallOutput,
    result: null,
  } as MeetingBotPostCallOutput
}

async function finishMeetingBotPostCall({
  errorCode,
  sessionId,
  supabase,
  workerId,
}: {
  errorCode: string | null
  sessionId: string
  supabase: SupabaseClient<Database>
  workerId: string
}) {
  const completedAt = errorCode ? null : new Date().toISOString()
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({
      post_call_completed_at: completedAt,
      post_call_error_code: errorCode,
      post_call_locked_at: null,
      post_call_locked_by: null,
    })
    .eq("id", sessionId)
    .eq("post_call_locked_by", workerId.slice(0, 160))
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("Post-call processing lease was lost.")
}

export async function runMeetingBotPostCallGeneration({
  apiKeyUserId,
  forceRetry = false,
  generateOutputs,
  sessionId,
  supabase,
  workerId = `post-call:${randomUUID()}`,
}: {
  apiKeyUserId?: string
  forceRetry?: boolean
  generateOutputs: MeetingBotPostCallGenerator
  sessionId: string
  supabase: SupabaseClient<Database>
  workerId?: string
}): Promise<MeetingBotPostCallGenerationResult> {
  const safeWorkerId = workerId.slice(0, 160)
  const session = await claimMeetingBotPostCall({
    forceRetry,
    sessionId,
    supabase,
    workerId: safeWorkerId,
  })
  if (!session) {
    return {
      claimed: false,
      output: await getExistingMeetingBotPostCallOutput(supabase, sessionId),
    }
  }

  try {
    const keyUserId = await authorizeClaimedMeetingBotPostCall({
      apiKeyUserId,
      session,
      supabase,
    })
    const existingOutput = await getExistingMeetingBotPostCallOutput(supabase, session.id)
    if (existingOutput) {
      await finishMeetingBotPostCall({
        errorCode: null,
        sessionId: session.id,
        supabase,
        workerId: safeWorkerId,
      })
      logSafeEvent("info", "meeting_bot_post_call_completed")
      return { claimed: true, output: existingOutput }
    }
    const apiKey = await getDecryptedOpenAiKey(supabase, keyUserId, session.workspace_id)
    const output = await generateOutputs({
      apiKey,
      apiKeyUserId: keyUserId,
      callId: session.call_id,
      sourceMeetingBotSessionId: session.id,
      supabase,
    })
    await finishMeetingBotPostCall({
      errorCode: null,
      sessionId: session.id,
      supabase,
      workerId: safeWorkerId,
    })
    logSafeEvent("info", "meeting_bot_post_call_completed")
    return { claimed: true, output }
  } catch (error) {
    const errorCode = safePostCallErrorCode(error)
    await finishMeetingBotPostCall({
      errorCode,
      sessionId: session.id,
      supabase,
      workerId: safeWorkerId,
    }).catch(() => undefined)
    logSafeEvent("warn", "meeting_bot_post_call_failed", { code: errorCode })
    throw error
  }
}
