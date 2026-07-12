import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { AppError, notFound, tooManyRequests } from "./http"
import type {
  MeetingBotProvisioningRow,
  MeetingBotParticipantRow,
  MeetingBotSessionRow,
  MeetingBotWebhookEventRow,
  MeetingPlatform,
} from "./meeting-bot-types"

// Recall tables are isolated behind this module so application code remains
// compile-safe while generated Supabase types are refreshed after migration.
type MeetingBotDb = {
  from: (relation: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>
}

export function asMeetingBotDb(supabase: SupabaseClient<Database>) {
  return supabase as unknown as MeetingBotDb
}

function requireRpcRow<T>(data: T | T[] | null, error: { code?: string; message: string } | null): T {
  if (error) {
    if (error.code === "P0001" && /global|workspace|user|concurr/i.test(error.message)) {
      throw tooManyRequests("Meeting bot capacity is full right now. Try again shortly.")
    }
    if (error.code === "23505") {
      throw new AppError("meeting_bot_already_active", "This call already has a meeting bot.", 409)
    }
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("Meeting bot storage did not return a row.")

  return row
}

export async function createMeetingBotSession({
  authTag,
  callId,
  capacityLimits,
  ciphertext,
  clientInstanceId,
  clientRequestId,
  fingerprint,
  iv,
  platform,
  region,
  supabase,
  userId,
}: {
  authTag: string
  callId: string
  capacityLimits: {
    global: number
    perUser: number
    perWorkspace: number
    rateWindowMinutes: number
    reservedBotMinutes: number
    userDailyBotLimit: number
    userDailyMinuteLimit: number
    userRollingCreationLimit: number
    workspaceDailyBotLimit: number
    workspaceDailyMinuteLimit: number
    workspaceRollingCreationLimit: number
  }
  ciphertext: string
  clientInstanceId: string
  clientRequestId: string
  fingerprint: string
  iv: string
  platform: MeetingPlatform
  region: string
  supabase: SupabaseClient<Database>
  userId: string
}) {
  const response = await asMeetingBotDb(supabase).rpc("create_meeting_bot_session", {
    target_call_id: callId,
    target_client_instance_id: clientInstanceId,
    target_client_request_id: clientRequestId,
    target_global_limit: capacityLimits.global,
    target_platform: platform,
    target_rate_window_minutes: capacityLimits.rateWindowMinutes,
    target_region: region,
    target_reserved_bot_minutes: capacityLimits.reservedBotMinutes,
    target_user_limit: capacityLimits.perUser,
    target_user_daily_bot_limit: capacityLimits.userDailyBotLimit,
    target_user_daily_minute_limit: capacityLimits.userDailyMinuteLimit,
    target_user_rolling_creation_limit: capacityLimits.userRollingCreationLimit,
    target_url_auth_tag: authTag,
    target_url_ciphertext: ciphertext,
    target_url_fingerprint: fingerprint,
    target_url_iv: iv,
    target_workspace_limit: capacityLimits.perWorkspace,
    target_workspace_daily_bot_limit: capacityLimits.workspaceDailyBotLimit,
    target_workspace_daily_minute_limit: capacityLimits.workspaceDailyMinuteLimit,
    target_workspace_rolling_creation_limit: capacityLimits.workspaceRollingCreationLimit,
    target_user_id: userId,
  })

  return requireRpcRow<MeetingBotSessionRow>(response.data, response.error)
}

export async function getMeetingBotSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw notFound("Meeting bot session was not found.")

  return data as MeetingBotSessionRow
}

export async function getLatestMeetingBotSessionForCall(
  supabase: SupabaseClient<Database>,
  callId: string
) {
  const data = await findLatestMeetingBotSessionForCall(supabase, callId)
  if (!data) throw notFound("Meeting bot session was not found.")

  return data
}

export async function findLatestMeetingBotSessionForCall(
  supabase: SupabaseClient<Database>,
  callId: string
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as MeetingBotSessionRow | null
}

export async function listMeetingBotParticipants(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_participants")
    .select("id,session_id,call_speaker_id,display_name,party,matched_contact_id,match_provenance,match_confidence,correction_locked,is_speaking,updated_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)

  return (data ?? []) as MeetingBotParticipantRow[]
}

export async function getMeetingBotSessionByRecallBotId(
  supabase: SupabaseClient<Database>,
  recallBotId: string
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .select("*")
    .eq("recall_bot_id", recallBotId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as MeetingBotSessionRow | null
}

export async function recoverMeetingBotSessionMapping({
  correlationToken,
  recallBotId,
  supabase,
}: {
  correlationToken: string
  recallBotId: string
  supabase: SupabaseClient<Database>
}) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({
      provider_status: "joining_call",
      recall_bot_id: recallBotId,
      status: "joining",
    })
    .eq("correlation_token", correlationToken)
    .is("recall_bot_id", null)
    .eq("status", "provisioning")
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)

  let mapped = data as MeetingBotSessionRow | null
  if (!mapped) {
    const { data: existing, error: existingError } = await asMeetingBotDb(supabase)
      .from("meeting_bot_sessions")
      .select("*")
      .eq("recall_bot_id", recallBotId)
      .eq("correlation_token", correlationToken)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    mapped = existing as MeetingBotSessionRow | null
  }

  if (mapped && !(await deleteProvisioningPrivateRow(asMeetingBotDb(supabase), mapped.id))) {
    throw new Error("Meeting bot provisioning data could not be cleared.")
  }

  return mapped
}

export async function updateMeetingBotSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  values: Partial<MeetingBotSessionRow>
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update(values)
    .eq("id", sessionId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return data as MeetingBotSessionRow
}

export async function claimMeetingBotSessionProcessing({
  sessionId,
  supabase,
  workerId,
}: {
  sessionId: string
  supabase: SupabaseClient<Database>
  workerId: string
}) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({
      processing_locked_at: new Date().toISOString(),
      processing_locked_by: workerId.slice(0, 160),
    })
    .eq("id", sessionId)
    .is("processing_locked_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)

  return data as MeetingBotSessionRow | null
}

export async function heartbeatMeetingBotSession({
  clientInstanceId,
  sessionId,
  supabase,
  visibilityState,
}: {
  clientInstanceId: string
  sessionId: string
  supabase: SupabaseClient<Database>
  visibilityState: "hidden" | "visible"
}) {
  const now = new Date().toISOString()
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({
      client_visibility: visibilityState,
      client_visibility_updated_at: now,
      disconnect_grace_expires_at: null,
      disconnect_requested_at: null,
      last_heartbeat_at: now,
    })
    .eq("id", sessionId)
    .eq("client_instance_id", clientInstanceId)
    .is("ended_at", null)
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new AppError("meeting_bot_instance_changed", "This meeting bot is controlled by another active SalesFrame tab.", 409)

  return data as MeetingBotSessionRow
}

export async function reconnectMeetingBotSession({
  clientInstanceId,
  sessionId,
  supabase,
  userId,
}: {
  clientInstanceId: string
  sessionId: string
  supabase: SupabaseClient<Database>
  userId: string
}) {
  const { data, error } = await asMeetingBotDb(supabase).rpc(
    "reconnect_meeting_bot_session",
    {
      target_client_instance_id: clientInstanceId,
      target_session_id: sessionId,
      target_user_id: userId,
    }
  )
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    throw new AppError(
      "meeting_bot_instance_changed",
      "This meeting bot is controlled by another active SalesFrame tab.",
      409
    )
  }
  return row as MeetingBotSessionRow
}

export async function disconnectMeetingBotSession({
  clientInstanceId,
  sessionId,
  supabase,
}: {
  clientInstanceId: string
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const now = new Date()
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({
      disconnect_grace_expires_at: new Date(now.getTime() + 30_000).toISOString(),
      disconnect_requested_at: now.toISOString(),
    })
    .eq("id", sessionId)
    .eq("client_instance_id", clientInstanceId)
    .is("ended_at", null)
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new AppError("meeting_bot_instance_changed", "This meeting bot is controlled by another active SalesFrame tab.", 409)

  return data as MeetingBotSessionRow
}

export async function getProvisioningRow(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_provisioning_private")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as MeetingBotProvisioningRow | null
}

export async function claimDueProvisioning(
  supabase: SupabaseClient<Database>,
  workerId: string,
  limit = 10
) {
  const { data, error } = await asMeetingBotDb(supabase).rpc("claim_due_meeting_bot_provisioning", {
    batch_limit: limit,
    lease_seconds: 90,
    worker_id: workerId,
  })
  if (error) throw new Error(error.message)

  return (data ?? []) as MeetingBotProvisioningRow[]
}

export async function markProvisioningRetry({
  httpStatus,
  nextAttemptAt,
  safeErrorCode,
  sessionId,
  supabase,
}: {
  httpStatus: number
  nextAttemptAt: string
  safeErrorCode: string
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const db = asMeetingBotDb(supabase)
  const { error } = await db
    .from("meeting_bot_provisioning_private")
    .update({
      last_http_status: httpStatus,
      last_safe_error_code: safeErrorCode,
      locked_at: null,
      locked_by: null,
      next_attempt_at: nextAttemptAt,
      status: "queued",
    })
    .eq("session_id", sessionId)
  if (error) throw new Error(error.message)

  await updateMeetingBotSession(supabase, sessionId, {
    provider_subcode: safeErrorCode,
    safe_error_code: null,
    status: "provisioning",
  })
}

export async function markProvisioningFailed({
  httpStatus,
  safeErrorCode,
  sessionId,
  supabase,
}: {
  httpStatus: number
  safeErrorCode: string
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const db = asMeetingBotDb(supabase)
  const now = new Date().toISOString()
  const { error } = await db
    .from("meeting_bot_provisioning_private")
    .update({
      last_http_status: httpStatus,
      last_safe_error_code: safeErrorCode,
      locked_at: null,
      locked_by: null,
      next_attempt_at: null,
      status: "failed",
    })
    .eq("session_id", sessionId)
  if (error) throw new Error(error.message)

  await updateMeetingBotSession(supabase, sessionId, {
    ended_at: now,
    provider_subcode: safeErrorCode,
    safe_error_code: safeErrorCode,
    status: "failed",
  })
  await deleteProvisioningPrivateRow(db, sessionId)
}

export async function markProvisioningReconciling({
  httpStatus,
  safeErrorCode,
  sessionId,
  supabase,
}: {
  httpStatus: number
  safeErrorCode: string
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const db = asMeetingBotDb(supabase)
  const { error } = await db
    .from("meeting_bot_provisioning_private")
    .update({
      last_http_status: httpStatus,
      last_safe_error_code: safeErrorCode,
      locked_at: null,
      locked_by: null,
      next_attempt_at: null,
      status: "expired",
    })
    .eq("session_id", sessionId)
  if (error) throw new Error(error.message)

  return updateMeetingBotSession(supabase, sessionId, {
    provider_subcode: safeErrorCode,
    safe_error_code: "provider_state_reconciling",
    status: "provisioning",
  })
}

export async function markProvisioningReconciliationAbandoned({
  sessionId,
  supabase,
}: {
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_sessions")
    .update({ safe_error_code: "provider_state_reconciling_abandoned" })
    .eq("id", sessionId)
    .eq("status", "provisioning")
    .is("recall_bot_id", null)
    .is("ended_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as MeetingBotSessionRow | null
}

export async function markProvisioningCompleted({
  recallBotId,
  sessionId,
  supabase,
}: {
  recallBotId: string
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const current = await getMeetingBotSession(supabase, sessionId)
  if (current.recall_bot_id && current.recall_bot_id !== recallBotId) {
    throw new AppError(
      "provider_duplicate_bot",
      "Meeting bot provisioning needs another try.",
      409
    )
  }

  let session = current
  if (!current.recall_bot_id || current.status === "provisioning") {
    let updateQuery = asMeetingBotDb(supabase)
      .from("meeting_bot_sessions")
      .update({
        provider_status: "joining_call",
        provider_subcode: null,
        recall_bot_id: recallBotId,
        safe_error_code:
          current.safe_error_code === "provider_state_reconciling_abandoned"
            ? current.safe_error_code
            : null,
        started_at: current.started_at ?? new Date().toISOString(),
        status: "joining",
      })
      .eq("id", sessionId)
      .eq("status", "provisioning")
    updateQuery = current.recall_bot_id
      ? updateQuery.eq("recall_bot_id", recallBotId)
      : updateQuery.is("recall_bot_id", null)
    const { data, error } = await updateQuery.select("*")
      .maybeSingle()
    if (error) throw new Error(error.message)
    session = data
      ? data as MeetingBotSessionRow
      : await getMeetingBotSession(supabase, sessionId)
    if (session.recall_bot_id !== recallBotId) {
      throw new AppError(
        "provider_duplicate_bot",
        "Meeting bot provisioning needs another try.",
        409
      )
    }
  }
  if (!(await deleteProvisioningPrivateRow(asMeetingBotDb(supabase), sessionId))) {
    throw new Error("Meeting bot provisioning data could not be cleared.")
  }

  return session
}

async function deleteProvisioningPrivateRow(db: MeetingBotDb, sessionId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await db
      .from("meeting_bot_provisioning_private")
      .delete()
      .eq("session_id", sessionId)
    if (!error) return true
    await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
  }

  return false
}

export async function expireMeetingBotPrivatePayloads(supabase: SupabaseClient<Database>) {
  const { error } = await asMeetingBotDb(supabase).rpc("expire_meeting_bot_private_data", {
    batch_limit: 100,
  })
  if (error) throw new Error(error.message)
}

export async function insertMeetingBotWebhookEvent({
  eventTimestamp,
  eventType,
  payload,
  payloadHash,
  recallBotId,
  region,
  sessionId,
  supabase,
  webhookId,
}: {
  eventTimestamp: string
  eventType: string
  payload: { authTag: string; ciphertext: string; iv: string }
  payloadHash: string
  recallBotId: string | null
  region: string
  sessionId: string | null
  supabase: SupabaseClient<Database>
  webhookId: string
}) {
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_webhook_events")
    .insert({
      event_timestamp: eventTimestamp,
      event_type: eventType,
      payload_auth_tag: payload.authTag,
      payload_ciphertext: payload.ciphertext,
      payload_hash: payloadHash,
      payload_iv: payload.iv,
      recall_bot_id: recallBotId,
      region,
      session_id: sessionId,
      webhook_id: webhookId,
    })

  if (error?.code === "23505") return false
  if (error) throw new Error(error.message)
  return true
}

export async function claimMeetingBotWebhookEvent({
  region,
  supabase,
  webhookId,
  workerId,
}: {
  region: string
  supabase: SupabaseClient<Database>
  webhookId: string
  workerId: string
}) {
  const { data, error } = await asMeetingBotDb(supabase).rpc("claim_meeting_bot_webhook_event", {
    lease_seconds: 90,
    target_region: region,
    target_webhook_id: webhookId,
    worker_id: workerId,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data

  return row as MeetingBotWebhookEventRow | null
}

export async function markWebhookEventProcessed(
  supabase: SupabaseClient<Database>,
  eventId: string
) {
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_webhook_events")
    .update({
      last_safe_error_code: null,
      locked_at: null,
      locked_by: null,
      payload_auth_tag: null,
      payload_ciphertext: null,
      payload_iv: null,
      processed_at: new Date().toISOString(),
      status: "processed",
    })
    .eq("id", eventId)
  if (error) throw new Error(error.message)
}

export async function markWebhookEventFailed({
  event,
  safeErrorCode,
  supabase,
}: {
  event: MeetingBotWebhookEventRow
  safeErrorCode: string
  supabase: SupabaseClient<Database>
}) {
  const exhausted = event.attempts >= event.max_attempts
  const retryDelaySeconds = Math.min(300, 2 ** Math.min(event.attempts, 8))
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_webhook_events")
    .update({
      last_safe_error_code: safeErrorCode,
      locked_at: null,
      locked_by: null,
      next_attempt_at: exhausted
        ? null
        : new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
      status: exhausted ? "failed" : "queued",
    })
    .eq("id", event.id)
  if (error) throw new Error(error.message)
}

export async function listDueMeetingBotWebhookIds(
  supabase: SupabaseClient<Database>,
  limit = 50
) {
  const { data, error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_webhook_events")
    .select("region,webhook_id")
    .in("status", ["received", "queued", "processing", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []) as Array<{ region: string; webhook_id: string }>
}

export async function claimDueMeetingBotRecovery(
  supabase: SupabaseClient<Database>,
  workerId: string,
  limit = 25
) {
  const { data, error } = await asMeetingBotDb(supabase).rpc("claim_due_meeting_bot_recovery", {
    batch_limit: limit,
    lease_seconds: 90,
    worker_id: workerId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as MeetingBotSessionRow[]
}

export async function claimDueTurnBuffers(
  supabase: SupabaseClient<Database>,
  workerId: string,
  limit = 25
) {
  const { data, error } = await asMeetingBotDb(supabase).rpc("claim_due_meeting_bot_turn_buffers", {
    batch_limit: limit,
    lease_seconds: 30,
    worker_id: workerId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, any>>
}

export async function correctMeetingBotParticipantAttribution({
  contactId,
  participantId,
  party,
  sessionId,
  supabase,
  userId,
}: {
  contactId: string | null
  participantId: string
  party: "customer" | "seller" | "unknown"
  sessionId: string
  supabase: SupabaseClient<Database>
  userId: string
}) {
  const { data, error } = await asMeetingBotDb(supabase).rpc(
    "correct_meeting_bot_participant_attribution",
    {
      target_contact_id: contactId,
      target_participant_id: participantId,
      target_party: party,
      target_session_id: sessionId,
      target_user_id: userId,
    }
  )
  const row = Array.isArray(data) ? data[0] : data
  if (error) throw new Error(error.message)
  if (!row) throw notFound("Meeting participant was not found.")

  return row as MeetingBotParticipantRow
}

export async function transitionMeetingBotCallToBrowserCapture({
  callId,
  captureMethod,
  sessionId,
  supabase,
}: {
  callId: string
  captureMethod: "browser_one_channel" | "browser_two_channel"
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const { data, error } = await asMeetingBotDb(supabase).rpc(
    "transition_meeting_bot_call_to_browser_capture",
    {
      target_call_id: callId,
      target_capture_method: captureMethod,
      target_session_id: sessionId,
    }
  )
  const row = Array.isArray(data) ? data[0] : data
  if (error) throw new Error(error.message)
  if (!row) throw notFound("Call was not found.")
  return row
}
