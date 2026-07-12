import type { Config, Context } from "@netlify/functions"

import { encryptMeetingBotValue, fingerprintMeetingUrl } from "./_shared/meeting-bot-crypto"
import { requestMeetingBotLeave } from "./_shared/meeting-bot-processing"
import {
  createMeetingBotSession,
  correctMeetingBotParticipantAttribution,
  disconnectMeetingBotSession,
  getLatestMeetingBotSessionForCall,
  getMeetingBotSession,
  heartbeatMeetingBotSession,
  listMeetingBotParticipants,
  reconnectMeetingBotSession,
  transitionMeetingBotCallToBrowserCapture,
} from "./_shared/meeting-bot-store"
import { toMeetingBotPublicParticipant, toMeetingBotPublicSession } from "./_shared/meeting-bot-types"
import {
  assertUuid,
  MeetingUrlValidationError,
  parseMeetingUrl,
} from "./_shared/meeting-bot-validation"
import { dispatchRecallWork } from "./_shared/recall-work-dispatch"
import {
  getMeetingBotCapacityLimits,
  getRecallRegion,
  requireMeetingBotEnabled,
} from "./_shared/recall-client"
import {
  AppError,
  badRequest,
  dataResponse,
  errorResponse,
  methodNotAllowed,
  readJson,
} from "./_shared/http"
import { assertCallIsLive, authorizeCall, authorizeContact, requireUser } from "./_shared/supabase"

type CreateMeetingBotPayload = {
  callId?: unknown
  clientInstanceId?: unknown
  clientRequestId?: unknown
  meetingUrl?: unknown
}

type MeetingBotControlPayload = {
  clientInstanceId?: unknown
  endedReason?: unknown
  keepalive?: unknown
  reason?: unknown
  visibilityState?: unknown
}

type ParticipantAttributionPayload = {
  contactId?: unknown
  party?: unknown
}

type BrowserFallbackPayload = {
  captureMethod?: unknown
  clientInstanceId?: unknown
}

function validationError(error: unknown) {
  if (error instanceof MeetingUrlValidationError) {
    return new AppError(error.code, error.message, 400)
  }
  return error
}

async function getPublicSession(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  session: Awaited<ReturnType<typeof getMeetingBotSession>>
) {
  const participants = await listMeetingBotParticipants(supabase, session.id)
  return toMeetingBotPublicSession(session, participants)
}

async function authorizeSession(request: Request, sessionId: string) {
  const { supabase, token, user } = await requireUser(request)
  const session = await getMeetingBotSession(supabase, sessionId)
  const call = await authorizeCall(user.id, session.call_id, supabase, { token })
  if (call.workspace_id !== session.workspace_id) {
    throw new AppError("meeting_bot_scope_mismatch", "Meeting bot session was not found.", 404)
  }

  return { session, supabase, token, user }
}

async function handleCreate(request: Request, context: Context) {
  requireMeetingBotEnabled()
  const { supabase, token, user } = await requireUser(request)
  const payload = await readJson<CreateMeetingBotPayload>(request)
  const callId = assertUuid(payload.callId, "callId")
  const clientRequestId = assertUuid(payload.clientRequestId, "clientRequestId")
  const clientInstanceId = assertUuid(payload.clientInstanceId, "clientInstanceId")
  const { platform, url } = parseMeetingUrl(payload.meetingUrl)
  const call = await authorizeCall(user.id, callId, supabase, { token })
  assertCallIsLive(call, {
    code: "meeting_bot_call_not_active",
    message: "This call is no longer active. Start a new call before sending a meeting bot.",
  })

  const encryptedUrl = encryptMeetingBotValue(url)
  const session = await createMeetingBotSession({
    authTag: encryptedUrl.authTag,
    callId,
    capacityLimits: getMeetingBotCapacityLimits(),
    ciphertext: encryptedUrl.ciphertext,
    clientInstanceId,
    clientRequestId,
    fingerprint: fingerprintMeetingUrl(url),
    iv: encryptedUrl.iv,
    platform,
    region: getRecallRegion(),
    supabase,
    userId: user.id,
  })

  context.waitUntil(
    dispatchRecallWork({ kind: "provision_session", sessionId: session.id }).catch(() => undefined)
  )

  return dataResponse(await getPublicSession(supabase, session), 202)
}

async function handleGetCollection(request: Request) {
  const callId = assertUuid(new URL(request.url).searchParams.get("callId"), "callId")
  const { supabase, token, user } = await requireUser(request)
  await authorizeCall(user.id, callId, supabase, { token })
  const session = await getLatestMeetingBotSessionForCall(supabase, callId)

  return dataResponse(await getPublicSession(supabase, session))
}

async function handleGet(request: Request, sessionId: string) {
  const { session, supabase } = await authorizeSession(request, sessionId)
  return dataResponse(await getPublicSession(supabase, session))
}

async function handleHeartbeat(request: Request, sessionId: string) {
  const { session, supabase, user } = await authorizeSession(request, sessionId)
  const payload = await readJson<MeetingBotControlPayload>(request)
  const clientInstanceId = assertUuid(payload.clientInstanceId, "clientInstanceId")
  if (payload.visibilityState !== "visible" && payload.visibilityState !== "hidden") {
    throw badRequest("Visibility state was not recognized.", "meeting_bot_visibility_invalid")
  }
  const updated =
    session.client_instance_id === clientInstanceId
      ? await heartbeatMeetingBotSession({
          clientInstanceId,
          sessionId,
          supabase,
          visibilityState: payload.visibilityState,
        })
      : payload.visibilityState === "visible"
        ? await reconnectMeetingBotSession({
            clientInstanceId,
            sessionId,
            supabase,
            userId: user.id,
          })
        : await heartbeatMeetingBotSession({
            clientInstanceId,
            sessionId,
            supabase,
            visibilityState: payload.visibilityState,
          })

  return dataResponse(await getPublicSession(supabase, updated))
}

async function handleDisconnect(request: Request, sessionId: string) {
  const { supabase } = await authorizeSession(request, sessionId)
  const payload = await readJson<MeetingBotControlPayload>(request)
  const clientInstanceId = assertUuid(payload.clientInstanceId, "clientInstanceId")
  if (payload.keepalive !== true || payload.reason !== "page_exit") {
    throw badRequest("Disconnect request was not recognized.", "meeting_bot_disconnect_invalid")
  }
  const updated = await disconnectMeetingBotSession({ clientInstanceId, sessionId, supabase })

  return dataResponse(await getPublicSession(supabase, updated))
}

async function handleDelete(request: Request, sessionId: string) {
  const { session, supabase } = await authorizeSession(request, sessionId)
  const payload = await readJson<MeetingBotControlPayload>(request)
  const clientInstanceId = assertUuid(payload.clientInstanceId, "clientInstanceId")
  if (session.client_instance_id !== clientInstanceId) {
    throw new AppError(
      "meeting_bot_instance_changed",
      "This meeting bot is controlled by another active SalesFrame tab.",
      409
    )
  }
  const endedReason = typeof payload.endedReason === "string" ? payload.endedReason : "bot_removed"
  const updated = await requestMeetingBotLeave({ endedReason, session, supabase })

  return dataResponse(await getPublicSession(supabase, updated))
}

async function handleParticipantAttribution(
  request: Request,
  sessionId: string,
  participantId: string
) {
  const { session, supabase, token, user } = await authorizeSession(request, sessionId)
  const payload = await readJson<ParticipantAttributionPayload>(request)
  if (payload.party !== "seller" && payload.party !== "customer" && payload.party !== "unknown") {
    throw badRequest("Choose who this participant is.", "meeting_bot_participant_party_invalid")
  }
  const contactId = payload.contactId === null || payload.contactId === undefined
    ? null
    : assertUuid(payload.contactId, "contactId")
  if (contactId && payload.party !== "customer") {
    throw badRequest(
      "A contact can only be linked to a customer participant.",
      "meeting_bot_participant_contact_invalid"
    )
  }
  if (contactId) {
    const contact = await authorizeContact(user.id, contactId, supabase, { token })
    if (contact.workspace_id !== session.workspace_id || contact.account_id !== session.account_id) {
      throw new AppError("meeting_bot_contact_scope_mismatch", "Contact was not found for this account.", 404)
    }
    if (contact.archived_at) {
      throw new AppError("meeting_bot_contact_archived", "Choose an active contact for this participant.", 409)
    }
  }
  const participant = await correctMeetingBotParticipantAttribution({
    contactId,
    participantId,
    party: payload.party,
    sessionId,
    supabase,
    userId: user.id,
  })

  return dataResponse(toMeetingBotPublicParticipant(participant))
}

async function handleBrowserFallback(request: Request, sessionId: string) {
  const { session, supabase, user } = await authorizeSession(request, sessionId)
  if (session.requested_by_user_id && session.requested_by_user_id !== user.id) {
    throw new AppError(
      "meeting_bot_fallback_owner_mismatch",
      "The seller who started this meeting bot must choose the fallback.",
      403
    )
  }
  const payload = await readJson<BrowserFallbackPayload>(request)
  const clientInstanceId = assertUuid(payload.clientInstanceId, "clientInstanceId")
  if (session.client_instance_id !== clientInstanceId) {
    throw new AppError(
      "meeting_bot_instance_changed",
      "This meeting bot is controlled by another active SalesFrame tab.",
      409
    )
  }
  if (payload.captureMethod !== "browser_one_channel" && payload.captureMethod !== "browser_two_channel") {
    throw badRequest("Choose one- or two-channel browser capture.", "meeting_bot_fallback_invalid")
  }
  const call = await transitionMeetingBotCallToBrowserCapture({
    callId: session.call_id,
    captureMethod: payload.captureMethod,
    sessionId,
    supabase,
  })
  return dataResponse({ callId: call.id, captureMethod: call.capture_method })
}

export default async (request: Request, context: Context) => {
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/"
    const sessionIdValue = context.params.sessionId
    const sessionId = sessionIdValue ? assertUuid(sessionIdValue, "sessionId") : null
    const participantIdValue = context.params.participantId
    const participantId = participantIdValue ? assertUuid(participantIdValue, "participantId") : null

    if (pathname === "/api/meeting-bots") {
      if (request.method === "POST") return await handleCreate(request, context)
      if (request.method === "GET") return await handleGetCollection(request)
      throw methodNotAllowed()
    }

    if (!sessionId) throw badRequest("sessionId is required.", "session_id_required")
    if (pathname.endsWith("/fallback")) {
      if (request.method !== "POST") throw methodNotAllowed()
      return await handleBrowserFallback(request, sessionId)
    }
    if (pathname.endsWith("/attribution")) {
      if (request.method !== "POST" || !participantId) throw methodNotAllowed()
      return await handleParticipantAttribution(request, sessionId, participantId)
    }
    if (pathname.endsWith("/heartbeat")) {
      if (request.method !== "POST") throw methodNotAllowed()
      return await handleHeartbeat(request, sessionId)
    }
    if (pathname.endsWith("/disconnect")) {
      if (request.method !== "POST") throw methodNotAllowed()
      return await handleDisconnect(request, sessionId)
    }
    if (request.method === "GET") return await handleGet(request, sessionId)
    if (request.method === "DELETE") return await handleDelete(request, sessionId)
    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(validationError(error), undefined, {
      context,
      functionName: "meeting-bots",
      request,
    })
  }
}

export const config: Config = {
  path: [
    "/api/meeting-bots",
    "/api/meeting-bots/:sessionId",
    "/api/meeting-bots/:sessionId/heartbeat",
    "/api/meeting-bots/:sessionId/disconnect",
    "/api/meeting-bots/:sessionId/fallback",
    "/api/meeting-bots/:sessionId/participants/:participantId/attribution",
  ],
  method: ["GET", "POST", "DELETE"],
}
