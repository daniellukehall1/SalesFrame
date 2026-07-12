import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { Readable } from "node:stream"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { decryptMeetingBotValue } from "./meeting-bot-crypto"
import {
  asMeetingBotDb,
  claimMeetingBotSessionProcessing,
  claimDueMeetingBotRecovery,
  claimDueProvisioning,
  claimDueTurnBuffers,
  claimMeetingBotWebhookEvent,
  getMeetingBotSession,
  getMeetingBotSessionByRecallBotId,
  getProvisioningRow,
  markProvisioningCompleted,
  markProvisioningFailed,
  markProvisioningReconciliationAbandoned,
  markProvisioningReconciling,
  markProvisioningRetry,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  updateMeetingBotSession,
} from "./meeting-bot-store"
import type {
  MeetingBotSessionRow,
  MeetingBotWebhookEventRow,
  RecallParticipant,
  RecallRealtimePayload,
  RecallStatusPayload,
} from "./meeting-bot-types"
import {
  arePersonNamesEquivalent,
  arePreferredNamesEquivalent,
  getMeetingBotTurnCommitAt,
  nameSimilarity,
  normalizeEmail,
  normalizePersonName,
  orderMeetingBotUtterances,
} from "./meeting-bot-validation"
import {
  createRecallBot,
  deleteRecallBotMedia,
  downloadRecallAudioToTempFile,
  downloadRecallTranscript,
  leaveRecallBot,
  listRecallBotsByCorrelationToken,
  listRecallMixedAudio,
  RecallApiError,
  retrieveRecallBot,
  retrieveRecallTranscript,
} from "./recall-client"
import { AppError, logSafeEvent } from "./http"
import { requireEnv } from "./env"

const PROVIDER_NAME = "deepgram_nova3"
const AUDIO_SOURCE_KIND = "meeting_bot"
const CAPTURE_PROVIDER = "recall_ai"
const webhookMaxBodyBytes = 700 * 1024
const contactFuzzyThreshold = 0.88
const contactFuzzyMargin = 0.1
const providerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const storageStreamLimitBytes = 128 * 1024 * 1024

type UntypedRow = Record<string, any>

export function assertRecallWebhookBodySize(request: Request, rawBody?: string) {
  const contentLength = Number(request.headers.get("content-length"))
  if (
    (Number.isFinite(contentLength) && contentLength > webhookMaxBodyBytes) ||
    (rawBody && Buffer.byteLength(rawBody) > webhookMaxBodyBytes)
  ) {
    throw new AppError(
      "recall_webhook_too_large",
      "The webhook payload exceeds the accepted size.",
      413
    )
  }
}

export function getRecallBotId(payload: RecallRealtimePayload | RecallStatusPayload) {
  return safeProviderId(payload.data?.bot?.id)
}

function safeProviderId(value: unknown) {
  return typeof value === "string" && providerIdPattern.test(value) ? value : null
}

function safeProviderCode(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9_.-]{1,120}$/.test(normalized) ? normalized : null
}

function getSafeErrorCode(event: string, subCode: string | null) {
  if (event === "bot.recording_permission_denied") return "recording_permission_denied"
  if (event === "transcript.failed") return "transcription_failed"
  if (event === "recording.failed") return "recording_failed"
  if (event !== "bot.fatal" && event !== "bot.call_ended" && event !== "bot.done") return null
  if (!subCode) return event === "bot.call_ended" ? "meeting_ended" : "bot_join_failed"
  if (subCode.includes("meeting_not_found")) return "meeting_not_found"
  if (subCode.includes("locked")) return "meeting_locked"
  if (subCode.includes("expired")) return "meeting_link_expired"
  if (subCode.includes("meeting_link_invalid")) return "meeting_link_invalid"
  if (subCode.includes("password") || subCode.includes("passcode")) return "meeting_password_incorrect"
  if (
    subCode.includes("sign_in") ||
    subCode.includes("signin") ||
    subCode.includes("registration")
  ) return "meeting_requires_sign_in"
  if (subCode.includes("waiting_room") || subCode.includes("lobby")) return "lobby_timeout"
  if (
    subCode.includes("denied") ||
    subCode.includes("not_admitted") ||
    subCode.includes("not_allowed")
  ) return "bot_denied"
  if (subCode.includes("meeting_ended") || subCode.includes("call_ended")) return "meeting_ended"
  return "bot_join_failed"
}

const meetingBotStatusRank: Record<MeetingBotSessionRow["status"], number> = {
  completed: 6,
  failed: 6,
  idle: 0,
  joining: 1,
  leaving: 4,
  processing: 5,
  provisioning: 0,
  recording: 3,
  waiting_room: 1,
}

function isRegressiveStatus(
  current: MeetingBotSessionRow["status"],
  candidate: MeetingBotSessionRow["status"]
) {
  return meetingBotStatusRank[candidate] < meetingBotStatusRank[current]
}

export async function processDueMeetingBotProvisioning({
  limit = 10,
  supabase,
  workerId = `provision:${randomUUID()}`,
}: {
  limit?: number
  supabase: SupabaseClient<Database>
  workerId?: string
}) {
  const jobs = await claimDueProvisioning(supabase, workerId, limit)

  for (const job of jobs) {
    try {
      const session = await getMeetingBotSession(supabase, job.session_id)
      if (session.ended_at) continue
      if (session.recall_bot_id) {
        const completed = await markProvisioningCompleted({
          recallBotId: session.recall_bot_id,
          sessionId: session.id,
          supabase,
        })
        if (completed.safe_error_code === "provider_state_reconciling_abandoned") {
          await requestMeetingBotLeave({
            endedReason: "client_disconnected",
            session: completed,
            supabase,
          })
        }
        continue
      }

      if (job.attempt_count > 1) {
        const existingBots = (await listRecallBotsByCorrelationToken(session.correlation_token)).results
          ?.filter((bot) => safeProviderId(bot.id)) ?? []
        if (existingBots.length === 1) {
          const completed = await markProvisioningCompleted({
            recallBotId: existingBots[0].id,
            sessionId: session.id,
            supabase,
          })
          if (completed.safe_error_code === "provider_state_reconciling_abandoned") {
            await requestMeetingBotLeave({
              endedReason: "client_disconnected",
              session: completed,
              supabase,
            })
          }
          continue
        }
        if (existingBots.length > 1) {
          const cleanup = await Promise.allSettled(
            existingBots.map((bot) => leaveRecallBot(bot.id))
          )
          if (cleanup.some((result) => result.status === "rejected")) {
            throw new RecallApiError({
              httpStatus: 503,
              safeCode: "provider_duplicate_cleanup_pending",
            })
          }
          throw new RecallApiError({ httpStatus: 409, safeCode: "provider_duplicate_bot" })
        }
      }

      const meetingUrl = decryptMeetingBotValue({
        authTag: job.encryption_auth_tag,
        ciphertext: job.encrypted_meeting_url,
        iv: job.encryption_iv,
      })
      const bot = await createRecallBot({
        correlationToken: session.correlation_token,
        meetingUrl,
      })
      const recallBotId = safeProviderId(bot.id)
      if (!recallBotId) {
        throw new RecallApiError({ httpStatus: 502, safeCode: "provider_response_invalid" })
      }

      const completed = await markProvisioningCompleted({ recallBotId, sessionId: session.id, supabase })
      if (completed.safe_error_code === "provider_state_reconciling_abandoned") {
        await requestMeetingBotLeave({
          endedReason: "client_disconnected",
          session: completed,
          supabase,
        })
      }
      logSafeEvent("info", "meeting_bot_provisioned", {
        platform: session.platform,
        region: session.region,
      })
    } catch (error) {
      const providerError = error instanceof RecallApiError
        ? error
        : new RecallApiError({ ambiguous: true, httpStatus: 503, safeCode: "provider_unavailable" })
      const expiresAt = Date.parse(job.expires_at)
      const retrySeconds = Math.max(30, providerError.retryAfterSeconds ?? 0)
      const nextAttemptAt = Date.now() + retrySeconds * 1000
      const canRetry =
        providerError.retryable &&
        job.attempt_count < job.max_attempts &&
        nextAttemptAt <= expiresAt

      if (canRetry) {
        await markProvisioningRetry({
          httpStatus: providerError.httpStatus,
          nextAttemptAt: new Date(nextAttemptAt).toISOString(),
          safeErrorCode: providerError.safeCode,
          sessionId: job.session_id,
          supabase,
        })
      } else if (providerError.ambiguous) {
        await markProvisioningReconciling({
          httpStatus: providerError.httpStatus,
          safeErrorCode: providerError.safeCode,
          sessionId: job.session_id,
          supabase,
        })
      } else {
        await markProvisioningFailed({
          httpStatus: providerError.httpStatus,
          safeErrorCode: providerError.safeCode,
          sessionId: job.session_id,
          supabase,
        })
      }
    }
  }

  return jobs.length
}

export async function runMeetingBotProvisioningWindow({
  sessionId,
  supabase,
}: {
  sessionId: string
  supabase: SupabaseClient<Database>
}) {
  const stopAt = Date.now() + 125_000

  while (Date.now() < stopAt) {
    await processDueMeetingBotProvisioning({
      limit: 10,
      supabase,
      workerId: `provision-window:${randomUUID()}`,
    })
    const job = await getProvisioningRow(supabase, sessionId)
    if (!job) return
    if (job.status === "failed") return
    if (job.status === "expired") {
      const session = await getMeetingBotSession(supabase, sessionId)
      if (
        session.status === "provisioning" &&
        !session.recall_bot_id &&
        !session.ended_at &&
        session.safe_error_code === "provider_state_reconciling"
      ) {
        await markProvisioningReconciliationAbandoned({ sessionId, supabase })
      }
      return
    }

    const nextAttemptAt = job.next_attempt_at ? Date.parse(job.next_attempt_at) : stopAt
    const waitMs = Math.max(250, Math.min(30_000, nextAttemptAt - Date.now()))
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  const session = await getMeetingBotSession(supabase, sessionId)
  if (session.status !== "provisioning" || session.recall_bot_id || session.ended_at) return
  const job = await getProvisioningRow(supabase, sessionId)
  if (job?.last_http_status === 429 || job?.last_http_status === 507) {
    await markProvisioningFailed({
      httpStatus: job.last_http_status,
      safeErrorCode: job.last_safe_error_code ?? "provider_capacity",
      sessionId,
      supabase,
    })
    return
  }
  await markProvisioningReconciliationAbandoned({ sessionId, supabase })
}

export async function processMeetingBotWebhookEvent({
  region,
  supabase,
  webhookId,
  workerId = `webhook:${randomUUID()}`,
}: {
  region: string
  supabase: SupabaseClient<Database>
  webhookId: string
  workerId?: string
}) {
  const event = await claimMeetingBotWebhookEvent({ region, supabase, webhookId, workerId })
  if (!event) return false

  try {
    const rawPayload = decryptMeetingBotValue({
      authTag: event.payload_auth_tag,
      ciphertext: event.payload_ciphertext,
      iv: event.payload_iv,
    })
    const payload = JSON.parse(rawPayload) as RecallRealtimePayload | RecallStatusPayload
    if (event.event_type === "transcript.data" || event.event_type.startsWith("participant_events.")) {
      await processRecallRealtimePayload(supabase, payload as RecallRealtimePayload, event.webhook_id)
    } else {
      await processRecallStatusPayload(supabase, payload as RecallStatusPayload)
    }
    await markWebhookEventProcessed(supabase, event.id)

    const turnDelayMs = event.event_type === "transcript.data"
      ? 3_100
      : event.event_type === "participant_events.speech_off"
        ? 700
        : 0
    if (turnDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, turnDelayMs))
      await processDueMeetingBotTurnBuffers({ limit: 10, supabase }).catch(() => undefined)
    } else if (event.event_type === "participant_events.speech_on") {
      await processDueMeetingBotTurnBuffers({ limit: 10, supabase }).catch(() => undefined)
    }
    return true
  } catch (error) {
    await markWebhookEventFailed({ event, safeErrorCode: getProcessingErrorCode(error), supabase })
    logSafeEvent("warn", "meeting_bot_webhook_processing_failed", {
      eventType: event.event_type,
    })
    return false
  }
}

function getProcessingErrorCode(error: unknown) {
  if (error instanceof SyntaxError) return "payload_invalid"
  if (error instanceof RecallApiError) return error.safeCode
  return "processing_failed"
}

async function processRecallStatusPayload(
  supabase: SupabaseClient<Database>,
  payload: RecallStatusPayload
) {
  const event = safeProviderCode(payload.event)
  const botId = getRecallBotId(payload)
  if (!event || !botId) throw new Error("Recall status payload was incomplete.")
  const session = await getMeetingBotSessionByRecallBotId(supabase, botId)
  if (!session) throw new Error("Recall bot session mapping was not found.")

  const providerCode = safeProviderCode(payload.data?.data?.code) ?? event.replace(/^bot\./, "")
  const providerSubcode = safeProviderCode(payload.data?.data?.sub_code)
  const occurredAt = parseProviderTimestamp(payload.data?.data?.updated_at)
  const values: Partial<MeetingBotSessionRow> = {
    provider_status: providerCode,
    provider_subcode: providerSubcode,
  }

  if (event === "bot.joining_call") values.status = "joining"
  if (event === "bot.in_waiting_room") values.status = "waiting_room"
  if (event === "bot.in_call_not_recording" || event === "bot.recording_permission_allowed") {
    values.joined_at = session.joined_at ?? occurredAt
    values.status = "joining"
  }
  if (event === "bot.in_call_recording") {
    values.joined_at = session.joined_at ?? occurredAt
    values.recording_started_at = session.recording_started_at ?? occurredAt
    values.safe_error_code = null
    values.status = "recording"
  }
  if (event === "bot.call_ended" || event === "bot.done") {
    values.ended_at = session.ended_at ?? occurredAt
    values.status = "processing"
    if (!session.recording_started_at) {
      values.safe_error_code = "provider_artifacts_reconciling"
    }
  }
  if (event === "bot.fatal" || event === "bot.recording_permission_denied") {
    values.ended_at = occurredAt
    if (!session.recording_started_at) values.media_transfer_status = "not_available"
    values.safe_error_code = getSafeErrorCode(event, providerSubcode)
    values.status = session.recording_started_at ? "processing" : "failed"
  }
  const recordingId = safeProviderId(payload.data?.recording?.id)
  const transcriptId = safeProviderId(payload.data?.transcript?.id)
  if (recordingId) values.recall_recording_id = recordingId
  if (transcriptId) values.recall_transcript_id = transcriptId
  if (event === "recording.done") {
    values.ended_at = session.ended_at ?? occurredAt
    values.media_transfer_status = "pending"
    values.status = "processing"
  }
  if (event === "recording.failed") {
    values.media_transfer_status = "failed"
    values.safe_error_code = "recording_failed"
  }
  if (event === "recording.deleted") values.provider_media_deleted_at = occurredAt
  if (event === "transcript.failed") values.safe_error_code = "transcription_failed"

  if (values.status && isRegressiveStatus(session.status, values.status)) {
    delete values.status
    delete values.provider_status
    delete values.provider_subcode
  }
  if (session.safe_error_code === "provider_state_reconciling_abandoned") {
    delete values.safe_error_code
  }

  let updated = await updateMeetingBotSession(supabase, session.id, values)

  if (
    (event === "bot.fatal" || event === "bot.recording_permission_denied") &&
    !updated.recording_started_at
  ) {
    await leaveRecallBot(botId).catch(() => undefined)
    let providerMediaDeletedAt: string | null = null
    try {
      await deleteRecallBotMedia(botId)
      providerMediaDeletedAt = new Date().toISOString()
    } catch {
      // Recovery retries provider cleanup without changing the actionable failed state.
    }
    updated = await updateMeetingBotSession(supabase, session.id, {
      media_transfer_status: providerMediaDeletedAt ? "not_available" : "failed",
      provider_media_deleted_at: providerMediaDeletedAt,
      safe_error_code: updated.safe_error_code,
      status: "failed",
    })
    await endCallForMeetingBot(supabase, session.id, "provider_failed")
    return
  }

  if (
    updated.safe_error_code === "provider_state_reconciling_abandoned" &&
    updated.recall_bot_id &&
    !updated.ended_at
  ) {
    await requestMeetingBotLeave({
      endedReason: "client_disconnected",
      session: updated,
      supabase,
    })
    return
  }

  if (
    (event === "bot.call_ended" || event === "bot.done" || event === "bot.fatal" || event === "recording.done") &&
    updated.recording_started_at
  ) {
    await flushMeetingBotTurnBuffers(supabase, session.id)
    await endCallForMeetingBot(
      supabase,
      session.id,
      event === "bot.fatal" ? "provider_failed" : "meeting_ended"
    )
  }

  if (event === "transcript.done") {
    updated = await finalizeMeetingBotTranscriptArtifact({
      completedAt: occurredAt,
      session: updated,
      supabase,
    })
  }

  if (
    event === "recording.done" ||
    event === "transcript.done" ||
    (event === "bot.done" && updated.recording_started_at)
  ) {
    const finalized = await finalizeMeetingBotAudio(supabase, updated)
    await dispatchMeetingBotPostCallIfReady(finalized)
  }
}

async function dispatchMeetingBotPostCallIfReady(session: MeetingBotSessionRow) {
  const activePostCallLease =
    session.post_call_locked_at &&
    !Number.isNaN(Date.parse(session.post_call_locked_at)) &&
    Date.parse(session.post_call_locked_at) > Date.now() - 5 * 60 * 1000
  if (
    session.media_transfer_status !== "verified" ||
    !session.provider_media_deleted_at ||
    !session.post_call_requested_at ||
    !session.transcript_completed_at ||
    session.final_transcript_watermark_ms === null ||
    !session.transcript_artifact_sha256 ||
    session.post_call_completed_at ||
    session.post_call_error_code ||
    activePostCallLease
  ) {
    return false
  }

  try {
    const { dispatchMeetingBotPostCall } = await import("./meeting-bot-post-call")
    await dispatchMeetingBotPostCall(session.id)
    return true
  } catch {
    logSafeEvent("warn", "meeting_bot_post_call_dispatch_deferred")
    return false
  }
}

function parseProviderTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : new Date().toISOString()
}

async function processRecallRealtimePayload(
  supabase: SupabaseClient<Database>,
  payload: RecallRealtimePayload,
  webhookId: string
) {
  const event = safeProviderCode(payload.event)
  const botId = getRecallBotId(payload)
  const participant = payload.data?.data?.participant
  const participantId = participant
    ? getProviderParticipantId("validation", participant)
    : null
  if (!event || !botId || !participant || !participantId) {
    throw new Error("Recall realtime payload was incomplete.")
  }

  const session = await getMeetingBotSessionByRecallBotId(supabase, botId)
  if (!session) throw new Error("Recall bot session mapping was not found.")
  const occurredAt = parseProviderTimestamp(payload.data?.data?.timestamp?.absolute)
  const storedParticipant = await upsertMeetingBotParticipant(
    supabase,
    session,
    participant,
    event,
    occurredAt
  )

  if (event === "participant_events.speech_on") {
    await commitOtherParticipantBuffers(supabase, session.id, storedParticipant.id)
  }
  if (event === "participant_events.speech_off") {
    await scheduleParticipantBufferCommit(supabase, session.id, storedParticipant.id, 600)
  }
  if (event === "transcript.data") {
    if (session.transcript_artifact_sha256) return
    await appendTranscriptUtterance({
      participant: storedParticipant,
      payload,
      session,
      supabase,
      webhookId,
    })
  }
}

async function upsertMeetingBotParticipant(
  supabase: SupabaseClient<Database>,
  session: MeetingBotSessionRow,
  participant: RecallParticipant,
  event: string,
  occurredAt: string
) {
  const db = asMeetingBotDb(supabase)
  const providerParticipantId = getProviderParticipantId(session.id, participant)
  if (!providerParticipantId) throw new Error("Recall participant identifier was missing.")
  const { data: existing, error: existingError } = await db
    .from("meeting_bot_participants")
    .select("*")
    .eq("session_id", session.id)
    .eq("provider_participant_id", providerParticipantId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)

  const hybridParentId = getHybridParentParticipantId(participant)
  const { data: hybridParent, error: hybridParentError } = hybridParentId
    ? await db
        .from("meeting_bot_participants")
        .select("call_speaker_id,display_name,match_confidence,match_provenance,matched_contact_id,party")
        .eq("session_id", session.id)
        .eq("provider_participant_id", hybridParentId)
        .maybeSingle()
    : { data: null, error: null }
  if (hybridParentError) throw new Error(hybridParentError.message)

  const now = occurredAt
  const match = existing?.correction_locked
    ? {
        contactId: existing.matched_contact_id as string | null,
        confidence: existing.match_confidence as number | null,
        party: existing.party as string,
        provenance: existing.match_provenance as string | null,
      }
    : hybridParent
      ? {
          contactId: hybridParent.matched_contact_id as string | null,
          confidence: hybridParent.match_confidence as number | null,
          party: hybridParent.party as string,
          provenance: hybridParent.match_provenance as string | null,
        }
      : await matchParticipant(supabase, session, participant)

  const speaker = hybridParent?.call_speaker_id
    ? { id: hybridParent.call_speaker_id as string }
    : await ensureRecallSpeaker(
        supabase,
        session.call_id,
        providerParticipantId,
        participant,
        match.party
      )
  const eventValues = event === "participant_events.leave"
    ? { is_speaking: false, left_at: now }
    : event === "participant_events.speech_on"
      ? { is_speaking: true, last_spoke_at: now, speech_ended_at: null, speech_started_at: now }
      : event === "participant_events.speech_off"
        ? { is_speaking: false, last_spoke_at: now, speech_ended_at: now }
        : { joined_at: existing?.joined_at ?? now }

  const values = {
    account_id: session.account_id,
    call_id: session.call_id,
    call_speaker_id: speaker.id,
    correction_locked: existing?.correction_locked ?? false,
    display_name: hybridParent?.display_name ?? cleanParticipantDisplayName(participant),
    is_host: Boolean(participant.is_host),
    match_confidence: match.confidence,
    match_provenance: match.provenance ?? "none",
    matched_at: match.provenance ? now : null,
    matched_contact_id: match.contactId,
    opportunity_id: session.opportunity_id,
    party: match.party,
    platform: cleanProviderText(participant.platform) ?? session.platform,
    provider_participant_id: providerParticipantId,
    session_id: session.id,
    workspace_id: session.workspace_id,
    ...eventValues,
  }

  const { data, error } = await db
    .from("meeting_bot_participants")
    .upsert(values, { onConflict: "session_id,provider_participant_id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  if (match.contactId && match.party === "customer") {
    const { data: existingCallContact, error: callContactReadError } = await db
      .from("call_contacts")
      .select("id")
      .eq("call_id", session.call_id)
      .eq("contact_id", match.contactId)
      .maybeSingle()
    if (callContactReadError) throw new Error(callContactReadError.message)
    const { error: callContactError } = existingCallContact
      ? await db
          .from("call_contacts")
          .update({ attendance_status: "attended" })
          .eq("id", existingCallContact.id)
      : await db.from("call_contacts").insert({
          account_id: session.account_id,
          attendance_status: "attended",
          call_id: session.call_id,
          contact_id: match.contactId,
          created_by_user_id: session.requested_by_user_id,
          is_primary: false,
          opportunity_id: session.opportunity_id,
          workspace_id: session.workspace_id,
        })
    if (callContactError) throw new Error(callContactError.message)
  }

  if (!hybridParentId) {
    await bridgeHybridParticipants({
      participant: data as UntypedRow,
      providerParticipantId,
      session,
      supabase,
    })
  }

  return data as UntypedRow
}

function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return null
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, "")
  return name ? name.slice(0, 200) : null
}

function cleanParticipantDisplayName(participant: RecallParticipant) {
  const name = cleanDisplayName(participant.name)
  if (participant.id === null && name && /^\d+-\d+$/.test(name)) return null
  return name
}

function getProviderParticipantId(sessionId: string, participant: RecallParticipant) {
  if (typeof participant.id === "number" && Number.isSafeInteger(participant.id) && participant.id >= 0) {
    return String(participant.id)
  }
  if (typeof participant.id === "string" && participant.id.trim()) {
    return participant.id.trim().slice(0, 128)
  }
  const anonymousKey = cleanDisplayName(participant.name)
  if (!anonymousKey) return null
  const hybridParts = anonymousKey.match(/^(\d+)-(\d+)$/)
  const hybridPrefix = hybridParts ? `anonymous-${hybridParts[1]}-${hybridParts[2]}` : "anonymous"
  return `${hybridPrefix}-${createHash("sha256")
    .update(`${sessionId}\u0000${anonymousKey}`)
    .digest("hex")
    .slice(0, 32)}`
}

function getHybridParentParticipantId(participant: RecallParticipant) {
  if (participant.id !== null && participant.id !== undefined) return null
  return cleanDisplayName(participant.name)?.match(/^(\d+)-\d+$/)?.[1] ?? null
}

async function bridgeHybridParticipants({
  participant,
  providerParticipantId,
  session,
  supabase,
}: {
  participant: UntypedRow
  providerParticipantId: string
  session: MeetingBotSessionRow
  supabase: SupabaseClient<Database>
}) {
  if (!/^\d+$/.test(providerParticipantId)) return
  const db = asMeetingBotDb(supabase)
  const { data: anonymousRows, error: anonymousError } = await db
    .from("meeting_bot_participants")
    .select("id,call_speaker_id")
    .eq("session_id", session.id)
    .eq("correction_locked", false)
    .like("provider_participant_id", `anonymous-${providerParticipantId}-%`)
  if (anonymousError) throw new Error(anonymousError.message)
  if (!anonymousRows?.length) return

  const { error: updateError } = await db
    .from("meeting_bot_participants")
    .update({
      call_speaker_id: participant.call_speaker_id,
      display_name: participant.display_name,
      match_confidence: participant.match_confidence,
      match_provenance: participant.match_provenance,
      matched_contact_id: participant.matched_contact_id,
      party: participant.party,
    })
    .eq("session_id", session.id)
    .eq("correction_locked", false)
    .like("provider_participant_id", `anonymous-${providerParticipantId}-%`)
  if (updateError) throw new Error(updateError.message)

  for (const anonymous of anonymousRows as UntypedRow[]) {
    if (!anonymous.call_speaker_id || anonymous.call_speaker_id === participant.call_speaker_id) continue
    const { error: segmentError } = await db
      .from("transcript_segments")
      .update({ speaker_id: participant.call_speaker_id, speaker_needs_review: participant.party === "unknown" })
      .eq("provider_session_id", session.id)
      .eq("speaker_id", anonymous.call_speaker_id)
    if (segmentError) throw new Error(segmentError.message)
  }
}

function cleanProviderText(value: unknown) {
  if (typeof value !== "string") return null
  const text = value.trim().toLowerCase()
  return /^[a-z0-9_.-]{1,80}$/.test(text) ? text : null
}

async function matchParticipant(
  supabase: SupabaseClient<Database>,
  session: MeetingBotSessionRow,
  participant: RecallParticipant
) {
  const hasDirectParticipantId =
    (typeof participant.id === "number" && Number.isSafeInteger(participant.id) && participant.id >= 0) ||
    (typeof participant.id === "string" && Boolean(participant.id.trim()))
  if (!hasDirectParticipantId) {
    return { contactId: null, confidence: null, party: "unknown", provenance: null }
  }
  const participantEmail = normalizeEmail(participant.email)
  const participantName = normalizePersonName(participant.name)
  const { data: sellerData } = session.requested_by_user_id
    ? await supabase.auth.admin.getUserById(session.requested_by_user_id)
    : { data: { user: null } }
  const seller = sellerData?.user
  const sellerNames = [seller?.user_metadata?.full_name, seller?.user_metadata?.name]
    .map(normalizePersonName)
    .filter(Boolean)
  if (
    (participantEmail && normalizeEmail(seller?.email) === participantEmail) ||
    (participantName && sellerNames.includes(participantName))
  ) {
    return { contactId: null, confidence: 1, party: "seller", provenance: participantEmail ? "automatic_email" : "automatic_exact_name" }
  }

  const db = asMeetingBotDb(supabase)
  const [
    { data: contacts, error: contactsError },
    { data: selected, error: selectedError },
    { data: linked, error: linkedError },
  ] = await Promise.all([
    db
      .from("contacts")
      .select("id,full_name,preferred_name,work_email,archived_at")
      .eq("workspace_id", session.workspace_id)
      .eq("account_id", session.account_id)
      .is("archived_at", null),
    db.from("call_contacts").select("contact_id").eq("call_id", session.call_id),
    db.from("opportunity_contacts").select("contact_id").eq("opportunity_id", session.opportunity_id),
  ])
  if (contactsError) throw new Error(contactsError.message)
  if (selectedError) throw new Error(selectedError.message)
  if (linkedError) throw new Error(linkedError.message)
  const selectedIds = new Set<string>((selected ?? []).map((row: UntypedRow) => row.contact_id))
  const linkedIds = new Set<string>((linked ?? []).map((row: UntypedRow) => row.contact_id))
  const candidates = (contacts ?? []).map((contact: UntypedRow) => ({
    ...contact,
    priority: selectedIds.has(contact.id) ? 2 : linkedIds.has(contact.id) ? 1 : 0,
  }))

  if (participantEmail) {
    const emailMatch = candidates.find((contact: UntypedRow) => normalizeEmail(contact.work_email) === participantEmail)
    if (emailMatch) return { contactId: emailMatch.id, confidence: 1, party: "customer", provenance: "automatic_email" }
  }

  if (participantName) {
    const exactMatches = candidates.filter((contact: UntypedRow) =>
      [contact.full_name, contact.preferred_name].some((name) =>
        arePersonNamesEquivalent(participantName, name)
      )
    )
    if (exactMatches.length === 1) {
      return { contactId: exactMatches[0].id, confidence: 1, party: "customer", provenance: "automatic_exact_name" }
    }

    const participantFirst = participantName.split(" ")[0]
    const firstNameMatches = candidates.filter((contact: UntypedRow) => {
      if (contact.priority === 0) return false
      const names = [contact.full_name, contact.preferred_name].map(normalizePersonName).filter(Boolean)
      return names.some((name) => arePreferredNamesEquivalent(name, participantFirst))
    })
    if (firstNameMatches.length === 1) {
      return { contactId: firstNameMatches[0].id, confidence: 0.9, party: "customer", provenance: "automatic_exact_name" }
    }

    const scored = candidates
      .map((contact: UntypedRow) => ({
        contact,
        score: Math.max(
          nameSimilarity(participantName, contact.full_name),
          nameSimilarity(participantName, contact.preferred_name)
        ),
      }))
      .sort((left: UntypedRow, right: UntypedRow) => right.score - left.score || right.contact.priority - left.contact.priority)
    if (
      scored[0]?.score >= contactFuzzyThreshold &&
      scored[0].score - (scored[1]?.score ?? 0) >= contactFuzzyMargin
    ) {
      return { contactId: scored[0].contact.id, confidence: scored[0].score, party: "customer", provenance: "automatic_fuzzy_name" }
    }
  }

  return { contactId: null, confidence: null, party: "unknown", provenance: null }
}

async function ensureRecallSpeaker(
  supabase: SupabaseClient<Database>,
  callId: string,
  providerParticipantId: string,
  participant: RecallParticipant,
  party: string
) {
  const db = asMeetingBotDb(supabase)
  const label = `Recall ${providerParticipantId.slice(0, 120)}`
  const role = party === "seller" ? "seller" : party === "customer" ? "customer" : "unknown"
  const { data, error } = await db
    .from("call_speakers")
    .upsert(
      { call_id: callId, display_name: cleanParticipantDisplayName(participant), label, role },
      { onConflict: "call_id,label" }
    )
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

async function appendTranscriptUtterance({
  participant,
  payload,
  session,
  supabase,
  webhookId,
}: {
  participant: UntypedRow
  payload: RecallRealtimePayload
  session: MeetingBotSessionRow
  supabase: SupabaseClient<Database>
  webhookId: string
}) {
  const words = payload.data?.data?.words ?? []
  const text = words.map((word) => typeof word.text === "string" ? word.text.trim() : "").filter(Boolean).join(" ").trim()
  if (!text) return
  const startSeconds = words[0]?.start_timestamp?.relative
  const endSeconds = words.at(-1)?.end_timestamp?.relative ?? words.at(-1)?.start_timestamp?.relative
  const startMs = Number.isFinite(startSeconds) ? Math.max(0, Math.round(Number(startSeconds) * 1000)) : null
  const endMs = Number.isFinite(endSeconds) ? Math.max(startMs ?? 0, Math.round(Number(endSeconds) * 1000)) : startMs
  const participantId = String(participant.id)
  const db = asMeetingBotDb(supabase)
  const transcriptId = safeProviderId(payload.data?.transcript?.id) ?? session.id
  const providerEventId = createHash("sha256")
    .update([
      transcriptId,
      participant.provider_participant_id ?? participantId,
      startMs ?? "unknown",
      endMs ?? "unknown",
      startMs === null && endMs === null ? webhookId : text,
    ].join("\u0000"))
    .digest("hex")
  const utterance = { endMs, eventId: providerEventId, startMs, text }
  const getCommitAfter = () => {
    return new Date(getMeetingBotTurnCommitAt(participant.speech_ended_at)).toISOString()
  }

  await commitOtherParticipantBuffers(supabase, session.id, participantId)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: existing, error: readError } = await db
      .from("meeting_bot_turn_buffers")
      .select("*")
      .eq("session_id", session.id)
      .eq("participant_id", participantId)
      .eq("status", "open")
      .maybeSingle()
    if (readError) throw new Error(readError.message)

    if (!existing) {
      const { error: insertError } = await db.from("meeting_bot_turn_buffers").insert({
        account_id: session.account_id,
        buffered_text: text,
        call_id: session.call_id,
        commit_after: getCommitAfter(),
        end_ms: endMs,
        last_utterance_at: new Date().toISOString(),
        opportunity_id: session.opportunity_id,
        participant_id: participantId,
        provider_event_ids: [providerEventId],
        session_id: session.id,
        start_ms: startMs,
        status: "open",
        utterances: [utterance],
        version: 1,
        workspace_id: session.workspace_id,
      })
      if (!insertError) return
      if (insertError.code !== "23505") throw new Error(insertError.message)
      continue
    }

    const eventIds = Array.isArray(existing.provider_event_ids) ? existing.provider_event_ids : []
    if (eventIds.includes(providerEventId)) return
    const separatedAfter = startMs !== null && existing.end_ms !== null && startMs - existing.end_ms > 1_200
    const separatedBefore = endMs !== null && existing.start_ms !== null && existing.start_ms - endMs > 1_200
    if (separatedAfter || separatedBefore) {
      await db
        .from("meeting_bot_turn_buffers")
        .update({ commit_after: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("version", existing.version)
      await processDueMeetingBotTurnBuffers({ limit: 1, supabase })
      continue
    }

    const existingUtterances = Array.isArray(existing.utterances) && existing.utterances.length
      ? existing.utterances
      : [{
          endMs: existing.end_ms,
          eventId: eventIds[0] ?? createHash("sha256").update(existing.buffered_text).digest("hex"),
          startMs: existing.start_ms,
          text: existing.buffered_text,
        }]
    const utterances = orderMeetingBotUtterances([...existingUtterances, utterance])
    const orderedEventIds = utterances.map((item) => item.eventId)
    const orderedText = utterances.map((item) => item.text).filter(Boolean).join(" ").trim()
    const starts = utterances.map((item) => item.startMs).filter(Number.isFinite).map(Number)
    const ends = utterances.map((item) => item.endMs).filter(Number.isFinite).map(Number)
    const { data: updated, error: updateError } = await db
      .from("meeting_bot_turn_buffers")
      .update({
        buffered_text: orderedText,
        commit_after: getCommitAfter(),
        end_ms: ends.length ? Math.max(...ends) : existing.end_ms,
        last_utterance_at: new Date().toISOString(),
        provider_event_ids: orderedEventIds,
        speech_ended_at: participant.speech_ended_at ?? existing.speech_ended_at,
        start_ms: starts.length ? Math.min(...starts) : existing.start_ms,
        utterances,
        version: existing.version + 1,
      })
      .eq("id", existing.id)
      .eq("version", existing.version)
      .select("id")
      .maybeSingle()
    if (updateError) throw new Error(updateError.message)
    if (updated) return
  }

  throw new Error("Transcript turn buffer changed too quickly.")
}

async function commitOtherParticipantBuffers(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  participantId: string
) {
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_turn_buffers")
    .update({ commit_after: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "open")
    .neq("participant_id", participantId)
  if (error) throw new Error(error.message)
}

async function scheduleParticipantBufferCommit(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  participantId: string,
  delayMs: number
) {
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_turn_buffers")
    .update({
      commit_after: new Date(Date.now() + delayMs).toISOString(),
      speech_ended_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("status", "open")
  if (error) throw new Error(error.message)
}

async function flushMeetingBotTurnBuffers(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { error } = await asMeetingBotDb(supabase)
    .from("meeting_bot_turn_buffers")
    .update({ commit_after: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "open")
  if (error) throw new Error(error.message)
  await processDueMeetingBotTurnBuffers({ supabase })
}

async function finalizeMeetingBotTranscriptArtifact({
  completedAt,
  session: sessionValue,
  supabase,
}: {
  completedAt: string
  session: MeetingBotSessionRow
  supabase: SupabaseClient<Database>
}) {
  let session = sessionValue
  if (session.transcript_artifact_sha256) return session
  let transcriptId = session.recall_transcript_id
  let artifact = transcriptId ? await retrieveRecallTranscript(transcriptId) : null
  if (!artifact && session.recall_bot_id) {
    const bot = await retrieveRecallBot(session.recall_bot_id)
    const shortcut = bot.recordings
      ?.map((recording) => recording.media_shortcuts?.transcript)
      .find((transcript) => transcript?.data?.download_url)
    const shortcutId = safeProviderId(shortcut?.id)
    if (shortcut && shortcutId) {
      artifact = shortcut
      transcriptId = shortcutId
      session = await updateMeetingBotSession(supabase, session.id, {
        recall_transcript_id: shortcutId,
      })
    }
  }
  if (!artifact || !transcriptId) {
    throw new RecallApiError({ httpStatus: 503, safeCode: "transcript_artifact_not_ready" })
  }
  if (artifact.status?.code && artifact.status.code !== "done") {
    throw new RecallApiError({ httpStatus: 503, safeCode: "transcript_artifact_not_ready" })
  }
  const downloadUrl = artifact.data?.download_url
  if (!downloadUrl) {
    throw new RecallApiError({ httpStatus: 503, safeCode: "transcript_artifact_not_ready" })
  }

  const canonical = await downloadRecallTranscript(downloadUrl)
  const utterances = canonical.utterances
    .map((utterance, index) => ({
      index,
      participant: utterance?.participant,
      startMs: getRecallArtifactUtteranceStartMs(utterance?.words),
      words: sanitizeRecallArtifactWords(utterance?.words),
    }))
    .sort((left, right) =>
      left.startMs - right.startMs ||
      left.index - right.index
    )

  for (const utterance of utterances) {
    if (!utterance.participant || !utterance.words.length) continue
    const providerParticipantId = getProviderParticipantId(session.id, utterance.participant)
    if (!providerParticipantId) {
      throw new RecallApiError({ httpStatus: 502, safeCode: "transcript_artifact_invalid" })
    }
    const participant = await upsertMeetingBotParticipant(
      supabase,
      session,
      utterance.participant,
      "participant_events.update",
      completedAt
    )
    const payload: RecallRealtimePayload = {
      data: {
        bot: { id: session.recall_bot_id ?? undefined },
        data: {
          language_code: "en",
          participant: utterance.participant,
          words: utterance.words,
        },
        transcript: { id: transcriptId },
      },
      event: "transcript.data",
    }
    await appendTranscriptUtterance({
      participant,
      payload,
      session,
      supabase,
      webhookId: `artifact-${canonical.checksum}-${utterance.index}`,
    })
  }

  await flushMeetingBotTurnBuffers(supabase, session.id)
  const db = asMeetingBotDb(supabase)
  const { count, error: bufferError } = await db
    .from("meeting_bot_turn_buffers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .in("status", ["open", "committing"])
  if (bufferError) throw new Error(bufferError.message)
  if ((count ?? 0) > 0) {
    throw new RecallApiError({ httpStatus: 503, safeCode: "transcript_turn_flush_pending" })
  }

  const { data: finalSegment, error: segmentError } = await db
    .from("transcript_segments")
    .select("end_ms")
    .eq("call_id", session.call_id)
    .eq("capture_provider", CAPTURE_PROVIDER)
    .eq("transcription_provider", PROVIDER_NAME)
    .order("end_ms", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (segmentError) throw new Error(segmentError.message)
  const watermarkMs = Number.isFinite(finalSegment?.end_ms)
    ? Math.max(0, Math.round(Number(finalSegment.end_ms)))
    : 0
  const completionTimestamp = session.transcript_completed_at ?? clampTranscriptCompletionTime(
    completedAt,
    session.started_at
  )
  const { data, error } = await db
    .from("meeting_bot_sessions")
    .update({
      final_transcript_watermark_ms: watermarkMs,
      safe_error_code: null,
      transcript_artifact_sha256: canonical.checksum,
      transcript_completed_at: completionTimestamp,
    })
    .eq("id", session.id)
    .is("transcript_artifact_sha256", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data as MeetingBotSessionRow
  session = await getMeetingBotSession(supabase, session.id)
  if (session.transcript_artifact_sha256 !== canonical.checksum) {
    throw new Error("The canonical transcript receipt did not match the stored artifact.")
  }
  return session
}

function sanitizeRecallArtifactWords(words: unknown) {
  if (!Array.isArray(words)) return []
  return words.flatMap((word) => {
    if (!word || typeof word !== "object") return []
    const candidate = word as {
      end_timestamp?: { relative?: unknown } | null
      start_timestamp?: { relative?: unknown }
      text?: unknown
    }
    const text = typeof candidate.text === "string" ? candidate.text.trim().slice(0, 2_000) : ""
    if (!text) return []
    const start = Number(candidate.start_timestamp?.relative)
    const end = Number(candidate.end_timestamp?.relative)
    return [{
      end_timestamp: Number.isFinite(end) && end >= 0 ? { relative: end } : null,
      start_timestamp: Number.isFinite(start) && start >= 0 ? { relative: start } : undefined,
      text,
    }]
  })
}

function getRecallArtifactUtteranceStartMs(words: unknown) {
  if (!Array.isArray(words)) return Number.MAX_SAFE_INTEGER
  const start = Number((words[0] as { start_timestamp?: { relative?: unknown } } | undefined)
    ?.start_timestamp?.relative)
  return Number.isFinite(start) && start >= 0
    ? Math.round(start * 1_000)
    : Number.MAX_SAFE_INTEGER
}

function clampTranscriptCompletionTime(completedAt: string, startedAt: string | null) {
  const completionMs = Date.parse(completedAt)
  const startedMs = Date.parse(startedAt ?? "")
  const safeMs = Number.isNaN(completionMs) ? Date.now() : completionMs
  return new Date(Number.isNaN(startedMs) ? safeMs : Math.max(safeMs, startedMs)).toISOString()
}

export async function processDueMeetingBotTurnBuffers({
  limit = 25,
  supabase,
  workerId = `turn:${randomUUID()}`,
}: {
  limit?: number
  supabase: SupabaseClient<Database>
  workerId?: string
}) {
  const buffers = await claimDueTurnBuffers(supabase, workerId, limit)
  const db = asMeetingBotDb(supabase)

  for (const buffer of buffers) {
    try {
      if (!buffer.buffered_text?.trim()) {
        await db.from("meeting_bot_turn_buffers").update({
          processing_locked_at: null,
          processing_locked_by: null,
          status: "discarded",
        }).eq("id", buffer.id)
        continue
      }
      const { data: participant, error: participantError } = await db
        .from("meeting_bot_participants")
        .select("call_speaker_id,party,match_confidence,provider_participant_id")
        .eq("id", buffer.participant_id)
        .eq("session_id", buffer.session_id)
        .maybeSingle()
      if (participantError) throw new Error(participantError.message)
      const providerEventId = createHash("sha256")
        .update((buffer.provider_event_ids ?? []).join("|"))
        .digest("hex")
      const providerTurnIndex = getRecallTurnOrder(buffer.start_ms, buffer.end_ms, providerEventId)
      const party = participant?.party === "seller" ? "Seller" : participant?.party === "customer" ? "Customer" : "Unknown"
      const { data: segment, error: segmentError } = await db
        .from("transcript_segments")
        .upsert(
          {
            audio_source_kind: AUDIO_SOURCE_KIND,
            call_id: buffer.call_id,
            capture_provider: CAPTURE_PROVIDER,
            diarization_speaker: participant?.provider_participant_id ?? null,
            end_ms: buffer.end_ms,
            is_final: true,
            language_detected: "en",
            provider_event_id: providerEventId,
            provider_session_id: buffer.session_id,
            provider_turn_index: providerTurnIndex,
            quality_flags: {
              committedTurn: true,
              diarization: "separate_streams_when_available",
            },
            speaker_attribution: party,
            speaker_confidence: participant?.match_confidence ?? (party === "Unknown" ? 0 : 1),
            speaker_id: participant?.call_speaker_id ?? null,
            speaker_needs_review: party === "Unknown",
            speaker_source: "recall_perfect_diarization",
            start_ms: buffer.start_ms,
            text: buffer.buffered_text.trim(),
            transcription_delay: "finalized",
            transcription_provider: PROVIDER_NAME,
            turn_sequence: providerTurnIndex,
          },
          { onConflict: "call_id,audio_source_kind,transcription_provider,provider_event_id" }
        )
        .select("id")
        .single()
      if (segmentError) throw new Error(segmentError.message)

      const { error: bufferError } = await db
        .from("meeting_bot_turn_buffers")
        .update({
          committed_at: new Date().toISOString(),
          committed_transcript_segment_id: segment.id,
          processing_locked_at: null,
          processing_locked_by: null,
          status: "committed",
        })
        .eq("id", buffer.id)
      if (bufferError) throw new Error(bufferError.message)
    } catch {
      await db
        .from("meeting_bot_turn_buffers")
        .update({ processing_locked_at: null, processing_locked_by: null, status: "committing" })
        .eq("id", buffer.id)
    }
  }

  return buffers.length
}

function getRecallTurnOrder(startMs: unknown, endMs: unknown, providerEventId: string) {
  const baseMs = Number.isFinite(startMs)
    ? Math.max(0, Math.round(Number(startMs)))
    : Number.isFinite(endMs)
      ? Math.max(0, Math.round(Number(endMs)))
      : 0
  const tieBreaker = Number.parseInt(providerEventId.slice(0, 4), 16) % 100
  return Math.min(2_147_483_647, baseMs * 100 + tieBreaker + 1)
}

export async function requestMeetingBotLeave({
  endedReason = "bot_removed",
  expectedClientLease,
  session,
  supabase,
}: {
  endedReason?: string
  expectedClientLease?: {
    clientInstanceId: string
    lastHeartbeatAt: string | null
    status: MeetingBotSessionRow["status"]
  }
  session: MeetingBotSessionRow
  supabase: SupabaseClient<Database>
}) {
  const safeEndedReason = new Set([
    "bot_removed",
    "client_disconnected",
    "meeting_ended",
    "provider_failed",
    "seller_stopped",
  ]).has(endedReason) ? endedReason : "bot_removed"
  if (session.ended_at || session.status === "completed" || session.status === "failed") {
    if (session.recall_bot_id && !session.provider_media_deleted_at) {
      await leaveRecallBot(session.recall_bot_id)
      if (!session.recording_started_at) {
        await deleteRecallBotMedia(session.recall_bot_id)
        session = await updateMeetingBotSession(supabase, session.id, {
          media_transfer_status: "not_available",
          processing_locked_at: null,
          processing_locked_by: null,
          provider_media_deleted_at: new Date().toISOString(),
          status: "failed",
        })
      }
    }
    await endCallForMeetingBot(supabase, session.id, safeEndedReason)
    return session
  }

  if (
    !session.recall_bot_id &&
    session.status === "provisioning"
  ) {
    const now = new Date().toISOString()
    let abandonQuery = asMeetingBotDb(supabase)
      .from("meeting_bot_sessions")
      .update({
        disconnect_grace_expires_at: now,
        disconnect_requested_at: now,
        processing_locked_at: null,
        processing_locked_by: null,
        safe_error_code: "provider_state_reconciling_abandoned",
      })
      .eq("id", session.id)
      .eq("status", "provisioning")
      .is("recall_bot_id", null)
      .is("ended_at", null)
    if (expectedClientLease) {
      abandonQuery = abandonQuery
        .eq("client_instance_id", expectedClientLease.clientInstanceId)
        .eq("status", expectedClientLease.status)
      abandonQuery = expectedClientLease.lastHeartbeatAt
        ? abandonQuery.eq("last_heartbeat_at", expectedClientLease.lastHeartbeatAt)
        : abandonQuery.is("last_heartbeat_at", null)
    }
    const { data, error } = await abandonQuery.select("*").maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data as MeetingBotSessionRow
    return getMeetingBotSession(supabase, session.id)
  }

  const now = new Date().toISOString()
  if (expectedClientLease) {
    let leaveQuery = asMeetingBotDb(supabase)
      .from("meeting_bot_sessions")
      .update({
        provider_status: session.recall_bot_id ? "leaving_call" : "cancelled_before_join",
        status: session.recall_bot_id ? "leaving" : "failed",
        ...(session.recall_bot_id ? {} : { ended_at: now, safe_error_code: "bot_cancelled" }),
      })
      .eq("id", session.id)
      .eq("client_instance_id", expectedClientLease.clientInstanceId)
      .eq("status", expectedClientLease.status)
      .is("ended_at", null)
    leaveQuery = expectedClientLease.lastHeartbeatAt
      ? leaveQuery.eq("last_heartbeat_at", expectedClientLease.lastHeartbeatAt)
      : leaveQuery.is("last_heartbeat_at", null)
    const { data, error } = await leaveQuery.select("*")
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      return updateMeetingBotSession(supabase, session.id, {
        processing_locked_at: null,
        processing_locked_by: null,
      })
    }
    session = data as MeetingBotSessionRow
  }
  if (session.recall_bot_id) await leaveRecallBot(session.recall_bot_id)

  const updated = await updateMeetingBotSession(supabase, session.id, {
    disconnect_grace_expires_at: null,
    disconnect_requested_at: null,
    processing_locked_at: null,
    processing_locked_by: null,
    provider_status: session.recall_bot_id ? "leaving_call" : "cancelled_before_join",
    status: session.recall_bot_id ? "leaving" : "failed",
    ...(session.recall_bot_id ? {} : { ended_at: now, safe_error_code: "bot_cancelled" }),
  })
  await endCallForMeetingBot(supabase, session.id, safeEndedReason)

  if (!session.recall_bot_id) {
    const { error } = await asMeetingBotDb(supabase)
      .from("meeting_bot_provisioning_private")
      .delete()
      .eq("session_id", session.id)
    if (error) throw new Error(error.message)
  }

  return updated
}

async function endCallForMeetingBot(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  endedReason: string
) {
  const session = await getMeetingBotSession(supabase, sessionId)
  const endedAt = session.ended_at ?? new Date().toISOString()
  const startedAt = session.recording_started_at ?? session.started_at
  const durationSeconds = startedAt
    ? Math.max(0, Math.min(7200, Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)))
    : 0
  const { error } = await asMeetingBotDb(supabase)
    .from("calls")
    .update({
      duration_seconds: durationSeconds,
      ended_at: endedAt,
      ended_reason: endedReason,
      recording_status: session.recording_started_at ? "processing" : "failed",
      status: "processing",
    })
    .eq("id", session.call_id)
    .eq("workspace_id", session.workspace_id)
    .is("ended_at", null)
  if (error) throw new Error(error.message)
}

export async function finalizeMeetingBotAudio(
  supabase: SupabaseClient<Database>,
  sessionValue: MeetingBotSessionRow,
  options: { alreadyClaimed?: boolean } = {}
) {
  let session = sessionValue
  if (!session.recall_bot_id) return session
  if (!options.alreadyClaimed) {
    const claimed = await claimMeetingBotSessionProcessing({
      sessionId: session.id,
      supabase,
      workerId: `media:${randomUUID()}`,
    })
    if (!claimed) return getMeetingBotSession(supabase, session.id)
    session = claimed
  }
  if (!session.recall_bot_id) return session
  const recallBotId = session.recall_bot_id
  const expectedPath = `${session.workspace_id}/${session.call_id}/recall-${session.id}.mp3`
  if (
    !session.transcript_completed_at ||
    session.final_transcript_watermark_ms === null ||
    !session.transcript_artifact_sha256
  ) {
    return updateMeetingBotSession(supabase, session.id, {
      media_transfer_status: "pending",
      processing_locked_at: null,
      processing_locked_by: null,
      safe_error_code: "transcript_finalization_pending",
      status: "processing",
    })
  }
  if (session.provider_media_deleted_at) {
    const { data: call, error } = await asMeetingBotDb(supabase)
      .from("calls")
      .select("recording_storage_path")
      .eq("id", session.call_id)
      .eq("workspace_id", session.workspace_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const receipt = call?.recording_storage_path === expectedPath
      ? await getStoredMeetingBotMediaReceipt(expectedPath)
      : null
    const mediaWasVerified = Boolean(receipt)
    return updateMeetingBotSession(supabase, session.id, {
      ended_at: session.ended_at ?? new Date().toISOString(),
      media_transfer_status: mediaWasVerified ? "verified" : "not_available",
      media_checksum_sha256: receipt?.checksum ?? null,
      media_size_bytes: receipt?.sizeBytes ?? null,
      media_storage_path: receipt ? expectedPath : null,
      post_call_requested_at: mediaWasVerified
        ? session.post_call_requested_at ?? new Date().toISOString()
        : null,
      processing_locked_at: null,
      processing_locked_by: null,
      safe_error_code: mediaWasVerified ? null : "provider_media_deleted_before_transfer",
      status: "completed",
    })
  }
  if (session.media_transfer_status === "verified") {
    try {
      await deleteRecallBotMedia(recallBotId)
    } catch {
      return updateMeetingBotSession(supabase, session.id, {
        processing_locked_at: null,
        processing_locked_by: null,
        safe_error_code: "provider_media_deletion_pending",
        status: "processing",
      })
    }
    return updateMeetingBotSession(supabase, session.id, {
      processing_locked_at: null,
      processing_locked_by: null,
      provider_media_deleted_at: new Date().toISOString(),
      safe_error_code: null,
      status: "completed",
    })
  }
  try {
    session = await updateMeetingBotSession(supabase, session.id, {
      media_transfer_status: "downloading",
      processing_locked_at: new Date().toISOString(),
      processing_locked_by: `media:${randomUUID()}`,
      status: "processing",
    })
    let recordingId = session.recall_recording_id
    if (!recordingId) {
      const bot = await retrieveRecallBot(recallBotId)
      recordingId = bot.recordings?.find((recording) => recording.id)?.id ?? null
    }
    if (!recordingId) throw new RecallApiError({ httpStatus: 503, safeCode: "media_not_ready" })

    const audioList = await listRecallMixedAudio(recordingId)
    const audio = (audioList.results ?? []).filter((item) =>
      item.status?.code === "done" && item.format?.toLowerCase() === "mp3" && item.data?.download_url
    ).at(-1)
    if (!audio?.data?.download_url) {
      throw new RecallApiError({ httpStatus: 503, safeCode: "media_not_ready" })
    }
    const downloaded = await downloadRecallAudioToTempFile(audio.data.download_url)
    const checksum = downloaded.checksum
    const path = expectedPath
    const db = asMeetingBotDb(supabase)
    try {
      session = await updateMeetingBotSession(supabase, session.id, {
        media_transfer_status: "uploading",
      })
      await uploadMeetingBotRecordingFromFile({
        checksum,
        filePath: downloaded.path,
        objectPath: path,
        sizeBytes: downloaded.sizeBytes,
      })
      const verification = await getStoredMeetingBotMediaReceipt(path)
      if (
        !verification ||
        verification.sizeBytes !== downloaded.sizeBytes ||
        verification.checksum !== checksum
      ) {
        await supabase.storage.from("call-recordings").remove([path])
        throw new Error("Uploaded recording did not pass integrity verification.")
      }

      const { data: linkedCall, error: linkError } = await db
        .from("calls")
        .update({
          recording_error: null,
          recording_mime_type: "audio/mpeg",
          recording_ready_at: new Date().toISOString(),
          recording_size_bytes: downloaded.sizeBytes,
          recording_status: "ready",
          recording_storage_path: path,
        })
        .eq("id", session.call_id)
        .eq("workspace_id", session.workspace_id)
        .or(`recording_storage_path.is.null,recording_storage_path.eq.${path}`)
        .select("id,recording_storage_path")
        .maybeSingle()
      if (linkError) throw new Error(linkError.message)
      if (!linkedCall || linkedCall.recording_storage_path !== path) {
        await supabase.storage.from("call-recordings").remove([path])
        throw new Error("Call already has a different recording.")
      }

      const verifiedSession = await updateMeetingBotSession(supabase, session.id, {
        media_transfer_status: "verified",
        media_checksum_sha256: checksum,
        media_size_bytes: downloaded.sizeBytes,
        media_storage_path: path,
        post_call_error_code: null,
        post_call_requested_at: session.post_call_requested_at ?? new Date().toISOString(),
        processing_locked_at: null,
        processing_locked_by: null,
        recall_recording_id: recordingId,
        safe_error_code: null,
        ended_at: session.ended_at ?? new Date().toISOString(),
        status: "processing",
      })
      try {
        await deleteRecallBotMedia(recallBotId)
      } catch {
        return updateMeetingBotSession(supabase, session.id, {
          media_transfer_status: "verified",
          processing_locked_at: null,
          processing_locked_by: null,
          safe_error_code: "provider_media_deletion_pending",
          status: "processing",
        })
      }
      return updateMeetingBotSession(supabase, verifiedSession.id, {
        provider_media_deleted_at: new Date().toISOString(),
        safe_error_code: null,
        status: "completed",
      })
    } finally {
      await downloaded.cleanup()
    }
  } catch (error) {
    return updateMeetingBotSession(supabase, session.id, {
      media_transfer_status: "failed",
      processing_locked_at: null,
      processing_locked_by: null,
      safe_error_code: getProcessingErrorCode(error),
      status: "processing",
    })
  }
}

async function uploadMeetingBotRecordingFromFile({
  checksum,
  filePath,
  objectPath,
  sizeBytes,
}: {
  checksum: string
  filePath: string
  objectPath: string
  sizeBytes: number
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1_000)
  try {
    const uploadRequest = {
      body: createReadStream(filePath),
      duplex: "half",
      headers: {
        ...getSupabaseStorageHeaders(),
        "Cache-Control": "3600",
        "Content-Length": String(sizeBytes),
        "Content-Type": "audio/mpeg",
        "x-upsert": "false",
      },
      method: "POST",
      redirect: "error",
      signal: controller.signal,
    } as unknown as RequestInit
    const response = await fetch(getSupabaseStorageObjectUrl(objectPath, false), uploadRequest)
    if (response.ok) return

    const existing = await getStoredMeetingBotMediaReceipt(objectPath)
    if (existing?.checksum === checksum && existing.sizeBytes === sizeBytes) return
    throw new Error("Recording storage rejected the upload.")
  } finally {
    clearTimeout(timeout)
  }
}

async function getStoredMeetingBotMediaReceipt(path: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1_000)
  try {
    const response = await fetch(getSupabaseStorageObjectUrl(path, true), {
      headers: getSupabaseStorageHeaders(),
      redirect: "error",
      signal: controller.signal,
    })
    if (response.status === 404) return null
    if (!response.ok || !response.body) {
      throw new Error("Stored recording could not be read for verification.")
    }
    const contentLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > storageStreamLimitBytes) {
      throw new Error("Stored recording exceeds the verification limit.")
    }
    const hash = createHash("sha256")
    let sizeBytes = 0
    for await (const chunk of Readable.fromWeb(response.body as any)) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      sizeBytes += bytes.length
      if (sizeBytes > storageStreamLimitBytes) {
        controller.abort()
        throw new Error("Stored recording exceeds the verification limit.")
      }
      hash.update(bytes)
    }
    if (sizeBytes === 0) return null
    return { checksum: hash.digest("hex"), sizeBytes }
  } finally {
    clearTimeout(timeout)
  }
}

function getSupabaseStorageHeaders() {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  }
}

function getSupabaseStorageObjectUrl(path: string, authenticated: boolean) {
  const baseUrl = new URL(requireEnv("VITE_SUPABASE_URL"))
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) {
    throw new Error("Supabase storage origin is invalid.")
  }
  const objectPath = path.split("/").map(encodeURIComponent).join("/")
  const prefix = authenticated ? "object/authenticated" : "object"
  return new URL(`/storage/v1/${prefix}/call-recordings/${objectPath}`, baseUrl.origin)
}

export async function recoverMeetingBotSessions({
  limit = 25,
  supabase,
  workerId = `recovery:${randomUUID()}`,
}: {
  limit?: number
  supabase: SupabaseClient<Database>
  workerId?: string
}) {
  const sessions = await claimDueMeetingBotRecovery(supabase, workerId, limit)
  const now = Date.now()

  for (const claimedSession of sessions) {
    let session = claimedSession
    try {
      session = await getMeetingBotSession(supabase, claimedSession.id)
      if (
        session.status === "failed" &&
        !session.recording_started_at &&
        session.recall_bot_id &&
        !session.provider_media_deleted_at
      ) {
        await leaveRecallBot(session.recall_bot_id)
        await deleteRecallBotMedia(session.recall_bot_id)
        await updateMeetingBotSession(supabase, session.id, {
          media_transfer_status: "not_available",
          processing_locked_at: null,
          processing_locked_by: null,
          provider_media_deleted_at: new Date().toISOString(),
          status: "failed",
        })
        continue
      }
      if (
        session.status === "provisioning" &&
        !session.recall_bot_id &&
        (session.safe_error_code === "provider_state_reconciling" ||
          session.safe_error_code === "provider_state_reconciling_abandoned")
      ) {
        const bots = (await listRecallBotsByCorrelationToken(session.correlation_token)).results
          ?.filter((bot) => safeProviderId(bot.id)) ?? []
        if (bots.length === 1) {
          const abandoned = session.safe_error_code === "provider_state_reconciling_abandoned"
          const mapped = await markProvisioningCompleted({
            recallBotId: bots[0].id,
            sessionId: session.id,
            supabase,
          })
          if (abandoned) {
            await requestMeetingBotLeave({
              endedReason: "client_disconnected",
              session: mapped,
              supabase,
            })
          } else {
            await updateMeetingBotSession(supabase, mapped.id, {
              processing_locked_at: null,
              processing_locked_by: null,
            })
          }
          continue
        }
        if (bots.length > 1) {
          await Promise.allSettled(bots.map((bot) => leaveRecallBot(bot.id)))
          await updateMeetingBotSession(supabase, session.id, {
            processing_locked_at: null,
            processing_locked_by: null,
            provider_subcode: "provider_duplicate_bot",
            safe_error_code: "provider_state_reconciling_abandoned",
          })
          continue
        }
        if (Date.parse(session.created_at) <= now - 10 * 60 * 1000) {
          await updateMeetingBotSession(supabase, session.id, {
            ended_at: new Date().toISOString(),
            processing_locked_at: null,
            processing_locked_by: null,
            provider_absence_confirmed_at: new Date().toISOString(),
            provider_subcode: session.provider_subcode ?? "provider_reconciliation_empty",
            safe_error_code:
              session.safe_error_code === "provider_state_reconciling_abandoned"
                ? "bot_cancelled"
                : "retries_exhausted",
            status: "failed",
          })
        } else {
          await updateMeetingBotSession(supabase, session.id, {
            processing_locked_at: null,
            processing_locked_by: null,
          })
        }
        continue
      }
      if (
        session.recall_bot_id &&
        !session.provider_media_deleted_at &&
        (session.safe_error_code === "provider_state_reconciling_abandoned" ||
          session.safe_error_code === "provider_artifacts_reconciling") &&
        session.ended_at &&
        Date.parse(session.ended_at) <= now - 2 * 60 * 1000
      ) {
        const bot = await retrieveRecallBot(session.recall_bot_id)
        const recordingId = bot.recordings?.map((recording) => safeProviderId(recording.id)).find(Boolean) ?? null
        if (recordingId) {
          session = await updateMeetingBotSession(supabase, session.id, {
            media_transfer_status: "pending",
            processing_locked_at: null,
            processing_locked_by: null,
            recall_recording_id: recordingId,
            recording_started_at: session.recording_started_at ?? session.joined_at ?? session.started_at,
            safe_error_code: "transcript_finalization_pending",
            status: "processing",
          })
          await endCallForMeetingBot(supabase, session.id, "meeting_ended")
          continue
        }
        if (bot.status?.code === "done" || bot.status?.code === "fatal") {
          await deleteRecallBotMedia(session.recall_bot_id)
          const failed = await updateMeetingBotSession(supabase, session.id, {
            media_transfer_status: "not_available",
            processing_locked_at: null,
            processing_locked_by: null,
            provider_media_deleted_at: new Date().toISOString(),
            safe_error_code:
              session.safe_error_code === "provider_state_reconciling_abandoned"
                ? "bot_cancelled"
                : "bot_join_failed",
            status: "failed",
          })
          await endCallForMeetingBot(
            supabase,
            failed.id,
            session.safe_error_code === "provider_state_reconciling_abandoned"
              ? "client_disconnected"
              : "bot_join_failed"
          )
          continue
        }
      }
      if (
        session.recall_bot_id &&
        session.recording_started_at &&
        !session.transcript_artifact_sha256
      ) {
        try {
          session = await finalizeMeetingBotTranscriptArtifact({
            completedAt: session.ended_at ?? new Date().toISOString(),
            session,
            supabase,
          })
        } catch {
          await updateMeetingBotSession(supabase, session.id, {
            processing_locked_at: null,
            processing_locked_by: null,
            safe_error_code: "transcript_finalization_pending",
          })
          continue
        }
      }
      if (
        session.media_transfer_status === "verified" &&
        session.provider_media_deleted_at &&
        session.post_call_requested_at &&
        !session.post_call_completed_at &&
        !session.post_call_error_code
      ) {
        await dispatchMeetingBotPostCallIfReady(session)
        await updateMeetingBotSession(supabase, session.id, {
          processing_locked_at: null,
          processing_locked_by: null,
        })
        continue
      }
      const disconnectExpired =
        session.disconnect_grace_expires_at &&
        Date.parse(session.disconnect_grace_expires_at) <= now
      const heartbeatStale =
        !session.ended_at &&
        session.client_visibility === "visible" &&
        session.last_heartbeat_at &&
        Date.parse(session.last_heartbeat_at) <= now - 60 * 1000
      if (disconnectExpired || heartbeatStale || session.status === "leaving") {
        await requestMeetingBotLeave({
          endedReason: disconnectExpired || heartbeatStale ? "client_disconnected" : "bot_removed",
          expectedClientLease: disconnectExpired || heartbeatStale
            ? {
                clientInstanceId: session.client_instance_id,
                lastHeartbeatAt: session.last_heartbeat_at,
                status: session.status,
              }
            : undefined,
          session,
          supabase,
        })
        continue
      }
      if (
        Date.parse(session.retention_expires_at ?? "") <= now &&
        session.provider_media_deleted_at === null &&
        session.recall_bot_id
      ) {
        const expectedPath = `${session.workspace_id}/${session.call_id}/recall-${session.id}.mp3`
        const { data: call, error: callError } = await asMeetingBotDb(supabase)
          .from("calls")
          .select("recording_storage_path")
          .eq("id", session.call_id)
          .eq("workspace_id", session.workspace_id)
          .maybeSingle()
        if (callError) throw new Error(callError.message)
        const receipt = session.media_transfer_status === "verified" && session.media_checksum_sha256
          ? {
              checksum: session.media_checksum_sha256,
              sizeBytes: session.media_size_bytes,
            }
          : call?.recording_storage_path === expectedPath
            ? await getStoredMeetingBotMediaReceipt(expectedPath)
            : null
        const mediaWasVerified = Boolean(receipt)
        const transcriptWasFinalized = Boolean(
          session.transcript_completed_at &&
          session.final_transcript_watermark_ms !== null &&
          session.transcript_artifact_sha256
        )
        if (!mediaWasVerified) {
          const orphanPath = expectedPath
          await supabase.storage.from("call-recordings").remove([orphanPath])
        }
        await deleteRecallBotMedia(session.recall_bot_id)
        const retained = await updateMeetingBotSession(supabase, session.id, {
          ended_at: session.ended_at ?? new Date().toISOString(),
          media_transfer_status: mediaWasVerified ? "verified" : "failed",
          media_checksum_sha256: receipt?.checksum ?? null,
          media_size_bytes: receipt?.sizeBytes ?? null,
          media_storage_path: receipt ? expectedPath : null,
          post_call_requested_at: mediaWasVerified && transcriptWasFinalized
            ? session.post_call_requested_at ?? new Date().toISOString()
            : null,
          processing_locked_at: null,
          processing_locked_by: null,
          provider_media_deleted_at: new Date().toISOString(),
          safe_error_code: !mediaWasVerified
            ? "media_retention_expired"
            : transcriptWasFinalized
              ? null
              : "transcript_finalization_incomplete",
          status: "completed",
        })
        await dispatchMeetingBotPostCallIfReady(retained)
        continue
      }
      if (
        session.media_transfer_status === "verified" &&
        !session.provider_media_deleted_at &&
        session.recall_bot_id &&
        session.transcript_completed_at &&
        session.final_transcript_watermark_ms !== null &&
        session.transcript_artifact_sha256
      ) {
        await deleteRecallBotMedia(session.recall_bot_id)
        const deleted = await updateMeetingBotSession(supabase, session.id, {
          processing_locked_at: null,
          processing_locked_by: null,
          provider_media_deleted_at: new Date().toISOString(),
          safe_error_code: null,
          status: "completed",
        })
        await dispatchMeetingBotPostCallIfReady(deleted)
        continue
      }
      if (["pending", "failed", "downloading", "uploading"].includes(session.media_transfer_status) && session.recall_bot_id) {
        const finalized = await finalizeMeetingBotAudio(supabase, session, { alreadyClaimed: true })
        await dispatchMeetingBotPostCallIfReady(finalized)
        continue
      }
      await updateMeetingBotSession(supabase, session.id, {
        processing_locked_at: null,
        processing_locked_by: null,
      })
    } catch {
      await updateMeetingBotSession(supabase, session.id, {
        processing_locked_at: null,
        processing_locked_by: null,
      }).catch(() => undefined)
    }
  }

  await processDueMeetingBotTurnBuffers({ limit, supabase, workerId: `turn-recovery:${randomUUID()}` })
  return sessions.length
}
