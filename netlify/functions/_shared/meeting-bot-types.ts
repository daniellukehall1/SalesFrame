export const meetingBotStatuses = [
  "idle",
  "provisioning",
  "joining",
  "waiting_room",
  "recording",
  "leaving",
  "processing",
  "completed",
  "failed",
] as const

export type MeetingBotStatus = (typeof meetingBotStatuses)[number]
export type MeetingPlatform = "google_meet" | "microsoft_teams" | "webex" | "zoom"

export type MeetingBotSessionRow = {
  account_id: string
  call_id: string
  client_instance_id: string
  client_request_id: string
  client_visibility: "hidden" | "visible"
  client_visibility_updated_at: string
  correlation_token: string
  created_at: string
  disconnect_grace_expires_at: string | null
  disconnect_requested_at: string | null
  ended_at: string | null
  id: string
  joined_at: string | null
  last_heartbeat_at: string | null
  media_transfer_status: string
  media_checksum_sha256: string | null
  media_size_bytes: number | null
  media_storage_path: string | null
  opportunity_id: string
  platform: MeetingPlatform
  post_call_attempts: number
  post_call_completed_at: string | null
  post_call_error_code: string | null
  post_call_locked_at: string | null
  post_call_locked_by: string | null
  post_call_requested_at: string | null
  processing_locked_at: string | null
  processing_locked_by: string | null
  provider_absence_confirmed_at: string | null
  provider_media_deleted_at: string | null
  provider_status: string | null
  provider_subcode: string | null
  recall_bot_id: string | null
  recall_recording_id: string | null
  recall_transcript_id: string | null
  recording_started_at: string | null
  region: string
  requested_by_user_id: string | null
  retention_expires_at: string | null
  safe_error_code: string | null
  started_at: string | null
  status: MeetingBotStatus
  transcript_artifact_sha256: string | null
  transcript_completed_at: string | null
  final_transcript_watermark_ms: number | null
  updated_at: string
  workspace_id: string
}

export type MeetingBotProvisioningRow = {
  attempt_count: number
  encrypted_meeting_url: string
  encryption_auth_tag: string
  encryption_iv: string
  expires_at: string
  last_http_status: number | null
  last_safe_error_code: string | null
  max_attempts: number
  next_attempt_at: string | null
  session_id: string
  status: string
  url_fingerprint: string
}

export type MeetingBotWebhookEventRow = {
  attempts: number
  event_type: string
  id: string
  max_attempts: number
  payload_auth_tag: string
  payload_ciphertext: string
  payload_iv: string
  recall_bot_id: string | null
  region: string
  session_id: string | null
  status: string
  webhook_id: string
}

export type RecallParticipant = {
  email?: string | null
  extra_data?: Record<string, unknown> | null
  id?: number | string | null
  is_host?: boolean
  name?: string | null
  platform?: string | null
}

export type RecallRealtimePayload = {
  data?: {
    bot?: { id?: string; metadata?: Record<string, unknown> }
    data?: {
      language_code?: string
      participant?: RecallParticipant
      timestamp?: { absolute?: string; relative?: number }
      words?: Array<{
        end_timestamp?: { relative?: number } | null
        start_timestamp?: { relative?: number }
        text?: string
      }>
    }
    participant_events?: { id?: string }
    recording?: { id?: string }
    transcript?: { id?: string }
  }
  event?: string
}

export type RecallStatusPayload = {
  data?: {
    bot?: { id?: string; metadata?: Record<string, unknown> }
    data?: { code?: string; sub_code?: string | null; updated_at?: string }
    recording?: { id?: string; metadata?: Record<string, unknown> }
    transcript?: { id?: string; metadata?: Record<string, unknown> }
  }
  event?: string
}

export type RecallBot = {
  id: string
  recordings?: Array<{
    id?: string
    media_shortcuts?: {
      transcript?: RecallTranscriptArtifact | null
    }
  }>
  status?: { code?: string; sub_code?: string | null }
}

export type RecallBotList = {
  results?: RecallBot[]
}

export type RecallMixedAudio = {
  data?: { download_url?: string }
  format?: string
  id?: string
  recording?: { id?: string }
  status?: { code?: string; sub_code?: string | null }
}

export type RecallMixedAudioList = {
  results?: RecallMixedAudio[]
}

export type RecallTranscriptArtifact = {
  data?: { download_url?: string }
  id?: string
  status?: { code?: string; sub_code?: string | null }
}

export type RecallTranscriptUtterance = {
  language_code?: string
  participant?: RecallParticipant
  words?: Array<{
    end_timestamp?: { relative?: number } | null
    start_timestamp?: { relative?: number }
    text?: string
  }>
}

export type MeetingBotPublicSession = {
  callId: string
  endedAt: string | null
  errorCode: string | null
  joinedAt: string | null
  meetingPlatform: MeetingPlatform
  providerStatus: string | null
  providerSubcode: string | null
  reconciliationStatus: "pending" | "abandoned" | null
  participants: ReturnType<typeof toMeetingBotPublicParticipant>[]
  postCallErrorCode: string | null
  postCallStatus: "pending" | "running" | "completed" | "failed" | null
  recordingStartedAt: string | null
  revision: number
  sessionId: string
  scopeCleanupSafe: boolean
  status: MeetingBotStatus
  updatedAt: string
}

export type MeetingBotParticipantRow = {
  call_speaker_id: string | null
  correction_locked: boolean
  display_name: string | null
  id: string
  is_speaking: boolean
  match_confidence: number | null
  match_provenance: string
  matched_contact_id: string | null
  party: "customer" | "seller" | "unknown"
  provider_participant_id: string
  session_id: string
  updated_at: string
}

export function toMeetingBotPublicParticipant(participant: MeetingBotParticipantRow) {
  return {
    callSpeakerId: participant.call_speaker_id,
    correctionLocked: participant.correction_locked,
    displayName: participant.display_name,
    isSpeaking: participant.is_speaking,
    matchConfidence: participant.match_confidence,
    matchProvenance: participant.match_provenance,
    matchedContactId: participant.matched_contact_id,
    participantId: participant.id,
    party: participant.party,
    sessionId: participant.session_id,
    updatedAt: participant.updated_at,
  }
}

export function toMeetingBotPublicSession(
  session: MeetingBotSessionRow,
  participants: MeetingBotParticipantRow[] = []
): MeetingBotPublicSession {
  const postCallStatus = session.post_call_completed_at
    ? "completed"
    : session.post_call_error_code
      ? "failed"
      : session.post_call_locked_at
        ? "running"
        : session.post_call_requested_at
          ? "pending"
          : null
  const postCallErrorCode =
    session.post_call_error_code && /^[a-z0-9_.-]{1,120}$/.test(session.post_call_error_code)
      ? session.post_call_error_code
      : session.post_call_error_code
        ? "post_call_generation_failed"
        : null
  const reconciliationStatus = session.safe_error_code === "provider_state_reconciling"
    ? "pending"
    : session.safe_error_code === "provider_state_reconciling_abandoned"
      ? "abandoned"
      : null
  const publicStatus: MeetingBotStatus = reconciliationStatus === "abandoned"
    ? "failed"
    : session.status
  const revision = Math.max(
    Date.parse(session.updated_at) || 0,
    ...participants.map((participant) => Date.parse(participant.updated_at) || 0)
  )

  return {
    callId: session.call_id,
    endedAt: session.ended_at,
    errorCode: session.safe_error_code,
    joinedAt: session.joined_at,
    meetingPlatform: session.platform,
    providerStatus: session.provider_status,
    providerSubcode: session.provider_subcode,
    reconciliationStatus,
    participants: participants.map(toMeetingBotPublicParticipant),
    postCallErrorCode,
    postCallStatus,
    recordingStartedAt: session.recording_started_at,
    revision,
    sessionId: session.id,
    scopeCleanupSafe: Boolean(
      session.status === "failed" &&
      (
        (session.recall_bot_id && session.provider_media_deleted_at) ||
        (
          !session.recall_bot_id &&
          (
            session.provider_absence_confirmed_at ||
            ["meeting_link_invalid", "meeting_not_found", "provider_auth_failed", "provider_capacity"].includes(
              session.safe_error_code ?? ""
            )
          )
        )
      ) &&
      !reconciliationStatus
    ),
    status: publicStatus,
    updatedAt: session.updated_at,
  }
}
