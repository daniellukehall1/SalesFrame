export const meetingBotPlatforms = ["zoom", "google_meet", "microsoft_teams", "webex"] as const

export type MeetingBotPlatform = (typeof meetingBotPlatforms)[number]

export const meetingBotCaptureStatuses = [
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

export type MeetingBotCaptureStatus = (typeof meetingBotCaptureStatuses)[number]

export type MeetingBotCallCaptureStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "stopping"
  | "stopped"
  | "error"

export type MeetingBotParticipantSnapshot = {
  callSpeakerId: string | null
  correctionLocked: boolean
  displayName: string | null
  isSpeaking: boolean
  matchConfidence: number | null
  matchProvenance: string
  matchedContactId: string | null
  participantId: string
  party: "customer" | "seller" | "unknown"
  sessionId: string
  updatedAt: string
}

export type MeetingBotSessionSnapshot = {
  callId: string
  endedAt?: string | null
  errorCode?: string | null
  joinedAt?: string | null
  meetingPlatform?: MeetingBotPlatform | null
  participants?: MeetingBotParticipantSnapshot[]
  postCallErrorCode?: string | null
  postCallStatus?: "pending" | "running" | "completed" | "failed" | null
  providerStatus?: string | null
  providerSubcode?: string | null
  reconciliationStatus?: "pending" | "abandoned" | null
  recordingStartedAt?: string | null
  revision?: number
  sessionId: string
  scopeCleanupSafe?: boolean
  status: MeetingBotCaptureStatus
  updatedAt?: string | null
}

export type MeetingBotCreateRequest = {
  callId: string
  clientInstanceId: string
  clientRequestId: string
  meetingUrl: string
}

type MeetingBotClientRequest = {
  clientInstanceId: string
}

export type MeetingBotBrowserFallbackCaptureMethod = "browser_one_channel" | "browser_two_channel"

export type MeetingBotBrowserFallbackRequest = MeetingBotClientRequest & {
  captureMethod: MeetingBotBrowserFallbackCaptureMethod
}

export type MeetingBotBrowserFallbackResponse = {
  callId: string
  captureMethod: MeetingBotBrowserFallbackCaptureMethod
}

export type MeetingBotPresenceRequest = MeetingBotClientRequest & {
  visibilityState: "hidden" | "visible"
}

export type MeetingBotDisconnectRequest = MeetingBotClientRequest & {
  keepalive: true
  reason: "page_exit"
}

export type MeetingBotLeaveRequest = MeetingBotClientRequest & {
  endedReason?: MeetingBotEndedReason
}

export type MeetingBotParticipantAttributionRequest = {
  contactId: string | null
  party: MeetingBotParticipantSnapshot["party"]
}

export type MeetingBotEndedReason =
  | "seller_stopped"
  | "time_limit_reached"
  | "bot_removed"
  | "client_disconnected"
  | "meeting_ended"
  | "provider_failed"

export type MeetingBotClientApi = {
  create: (
    request: MeetingBotCreateRequest,
    options?: { signal?: AbortSignal }
  ) => Promise<MeetingBotSessionSnapshot>
  disconnect: (
    sessionId: string,
    request: MeetingBotDisconnectRequest
  ) => Promise<MeetingBotSessionSnapshot | void> | MeetingBotSessionSnapshot | void
  fallback: (
    sessionId: string,
    request: MeetingBotBrowserFallbackRequest,
    options?: { signal?: AbortSignal }
  ) => Promise<MeetingBotBrowserFallbackResponse>
  get: (
    sessionId: string,
    options?: { signal?: AbortSignal }
  ) => Promise<MeetingBotSessionSnapshot>
  heartbeat: (
    sessionId: string,
    request: MeetingBotPresenceRequest,
    options?: { signal?: AbortSignal }
  ) => Promise<MeetingBotSessionSnapshot | void>
  leave: (
    sessionId: string,
    request: MeetingBotLeaveRequest,
    options?: { signal?: AbortSignal }
  ) => Promise<MeetingBotSessionSnapshot>
}

export type MeetingBotStatusSubscriber = (
  sessionId: string,
  callbacks: {
    onError?: (error: unknown) => void
    onSnapshot: (snapshot: MeetingBotSessionSnapshot) => void
  }
) => (() => void) | void

export type MeetingUrlValidationErrorCode =
  | "empty"
  | "invalid"
  | "https_required"
  | "unsupported_platform"
  | "not_direct_meeting_url"

export type MeetingUrlValidationResult =
  | {
      normalizedUrl: string
      platform: MeetingBotPlatform
      valid: true
    }
  | {
      code: MeetingUrlValidationErrorCode
      message: string
      platform: MeetingBotPlatform | null
      valid: false
    }

export type MeetingBotStatusPresentation = {
  detail: string
  isTerminal: boolean
  title: string
  tone: "calm" | "positive" | "critical"
}

export type MeetingBotErrorPresentation = {
  canFallback: boolean
  canRetry: boolean
  code: string
  message: string
  title: string
}

export const MEETING_BOT_HEARTBEAT_INTERVAL_MS = 10_000
export const MEETING_BOT_POLL_INTERVAL_MS = 3_000
export const MEETING_BOT_RECONNECT_GRACE_MS = 30_000

const maximumMeetingUrlLength = 4_096

const platformLabels: Record<MeetingBotPlatform, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  webex: "Webex",
  zoom: "Zoom",
}

function isHost(hostname: string, root: string) {
  return hostname === root || hostname.endsWith(`.${root}`)
}

function getPlatformFromHostname(hostname: string): MeetingBotPlatform | null {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "")

  if (
    isHost(normalizedHostname, "zoom.us") ||
    isHost(normalizedHostname, "zoom.com") ||
    isHost(normalizedHostname, "zoomgov.com")
  ) {
    return "zoom"
  }

  if (normalizedHostname === "meet.google.com") return "google_meet"

  if (
    normalizedHostname === "teams.microsoft.com" ||
    normalizedHostname === "teams.live.com" ||
    normalizedHostname === "teams.microsoft.us" ||
    normalizedHostname === "teams.cloud.microsoft"
  ) {
    return "microsoft_teams"
  }

  if (
    isHost(normalizedHostname, "webex.com") ||
    isHost(normalizedHostname, "webexgov.us")
  ) {
    return "webex"
  }

  return null
}

function isDirectMeetingPath(url: URL, platform: MeetingBotPlatform) {
  const pathname = url.pathname.toLowerCase().replace(/\/{2,}/g, "/")

  switch (platform) {
    case "zoom":
      return /^\/(?:j|s|w)\/\d{6,}(?:\/|$)/.test(pathname) || /^\/wc\/\d{6,}\/join(?:\/|$)/.test(pathname)
    case "google_meet":
      return /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\/|$)/.test(pathname)
    case "microsoft_teams":
      return pathname.startsWith("/l/meetup-join/") || pathname.startsWith("/meet/")
    case "webex":
      return (
        pathname.includes("/meet/") ||
        pathname.includes("/join/") ||
        (pathname.endsWith("/j.php") && url.searchParams.has("MTID")) ||
        (pathname.includes("/webappng/sites/") && pathname.includes("/meeting/"))
      )
  }
}

function safelyParseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function detectMeetingBotPlatform(value: string): MeetingBotPlatform | null {
  const url = safelyParseUrl(value.trim())

  return url ? getPlatformFromHostname(url.hostname) : null
}

export function getMeetingBotPlatformLabel(platform: MeetingBotPlatform) {
  return platformLabels[platform]
}

export function validateMeetingBotUrl(value: string): MeetingUrlValidationResult {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return {
      code: "empty",
      message: "Enter the meeting link SalesFrame should join.",
      platform: null,
      valid: false,
    }
  }

  if (trimmedValue.length > maximumMeetingUrlLength) {
    return {
      code: "invalid",
      message: "That meeting link is too long. Copy the direct link from the meeting invitation.",
      platform: null,
      valid: false,
    }
  }

  const url = safelyParseUrl(trimmedValue)

  if (!url || !url.hostname) {
    return {
      code: "invalid",
      message: "Enter a complete meeting link, including https://.",
      platform: null,
      valid: false,
    }
  }

  const platform = getPlatformFromHostname(url.hostname)

  if (url.protocol !== "https:") {
    return {
      code: "https_required",
      message: "Use the secure https:// meeting link from the invitation.",
      platform,
      valid: false,
    }
  }

  if (url.username || url.password || (url.port && url.port !== "443")) {
    return {
      code: "invalid",
      message: "Use the direct secure meeting link from the invitation.",
      platform,
      valid: false,
    }
  }

  if (!platform) {
    return {
      code: "unsupported_platform",
      message: "Use a Zoom, Google Meet, Microsoft Teams, or Webex meeting link.",
      platform: null,
      valid: false,
    }
  }

  if (!isDirectMeetingPath(url, platform)) {
    return {
      code: "not_direct_meeting_url",
      message: `Copy the direct ${platformLabels[platform]} meeting link rather than a calendar or redirect link.`,
      platform,
      valid: false,
    }
  }

  url.hash = ""

  return {
    normalizedUrl: url.toString(),
    platform,
    valid: true,
  }
}

export function normalizeRecallMeetingBotStatus(providerStatus: string | null | undefined): MeetingBotCaptureStatus {
  const status = (providerStatus ?? "")
    .trim()
    .toLowerCase()
    .replace(/^bot\./, "")
    .replace(/[ -]+/g, "_")

  if (!status) return "idle"

  if (["queued", "provisioning", "ready"].includes(status)) return "provisioning"
  if (["joining_call", "joining", "in_call_not_recording", "recording_permission_allowed"].includes(status)) {
    return "joining"
  }
  if (["in_waiting_room", "waiting_room"].includes(status)) return "waiting_room"
  if (["in_call_recording", "recording"].includes(status)) return "recording"
  if (["leaving_call", "leaving"].includes(status)) return "leaving"
  if (["call_ended", "media_processing", "processing"].includes(status)) return "processing"
  if (["done", "completed"].includes(status)) return "completed"
  if (
    [
      "fatal",
      "failed",
      "error",
      "recording_permission_denied",
      "recording_permission_timed_out",
    ].includes(status)
  ) {
    return "failed"
  }

  return "failed"
}

export function mapMeetingBotToCallCaptureStatus(
  status: MeetingBotCaptureStatus
): MeetingBotCallCaptureStatus {
  switch (status) {
    case "idle":
      return "idle"
    case "provisioning":
    case "joining":
    case "waiting_room":
      return "connecting"
    case "recording":
      return "recording"
    case "leaving":
    case "processing":
      return "stopping"
    case "completed":
      return "stopped"
    case "failed":
      return "error"
  }
}

export function getMeetingBotStatusPresentation(
  snapshotOrStatus: MeetingBotSessionSnapshot | MeetingBotCaptureStatus
): MeetingBotStatusPresentation {
  const snapshot = typeof snapshotOrStatus === "string" ? null : snapshotOrStatus
  const status = typeof snapshotOrStatus === "string" ? snapshotOrStatus : snapshotOrStatus.status
  const providerStatus = snapshot?.providerStatus?.trim().toLowerCase().replace(/^bot\./, "")

  if (status === "joining" && providerStatus === "in_call_not_recording") {
    return {
      detail: "SalesFrame is in the meeting and will begin once recording is available.",
      isTerminal: false,
      title: "Waiting for recording permission",
      tone: "calm",
    }
  }

  const presentations: Record<MeetingBotCaptureStatus, MeetingBotStatusPresentation> = {
    completed: {
      detail: "The transcript and audio are ready for SalesFrame to finish processing.",
      isTerminal: true,
      title: "Call ready",
      tone: "positive",
    },
    failed: {
      detail: "SalesFrame could not complete the meeting-bot connection.",
      isTerminal: true,
      title: "Meeting bot could not join",
      tone: "critical",
    },
    idle: {
      detail: "Paste the direct meeting link when you are ready.",
      isTerminal: false,
      title: "Meeting bot ready",
      tone: "calm",
    },
    joining: {
      detail: "SalesFrame is connecting to the meeting now.",
      isTerminal: false,
      title: "Sending SalesFrame to the meeting",
      tone: "calm",
    },
    leaving: {
      detail: "SalesFrame is leaving safely and saving the call.",
      isTerminal: false,
      title: "Finishing the call",
      tone: "calm",
    },
    processing: {
      detail: "SalesFrame is securely preparing the audio and transcript.",
      isTerminal: false,
      title: "Finishing the call",
      tone: "calm",
    },
    provisioning: {
      detail: "This can take a moment. You can stay on this screen.",
      isTerminal: false,
      title: "Still preparing your meeting bot",
      tone: "calm",
    },
    recording: {
      detail: "The meeting is being transcribed for live coaching.",
      isTerminal: false,
      title: "SalesFrame is listening",
      tone: "positive",
    },
    waiting_room: {
      detail: "Ask the host to admit SalesFrame when it appears in the lobby.",
      isTerminal: false,
      title: "Waiting to be admitted",
      tone: "calm",
    },
  }

  return presentations[status]
}

function normalizeErrorCode(error: unknown) {
  if (typeof error === "string") return error.trim().toLowerCase()

  if (error && typeof error === "object") {
    const errorRecord = error as { code?: unknown; errorCode?: unknown; providerSubcode?: unknown }
    const code = errorRecord.code ?? errorRecord.errorCode ?? errorRecord.providerSubcode
    if (typeof code === "string") return code.trim().toLowerCase()
  }

  return "unknown"
}

export function getMeetingBotErrorPresentation(error: unknown): MeetingBotErrorPresentation {
  const code = normalizeErrorCode(error)

  const errorMap: Record<string, Omit<MeetingBotErrorPresentation, "code">> = {
    bot_denied: {
      canFallback: true,
      canRetry: true,
      message: "The host did not admit SalesFrame. Ask them to admit the bot, then try again.",
      title: "SalesFrame was not admitted",
    },
    bot_join_failed: {
      canFallback: true,
      canRetry: true,
      message: "Check that the meeting is open, then try the meeting bot again.",
      title: "SalesFrame could not join",
    },
    feature_disabled: {
      canFallback: true,
      canRetry: false,
      message: "Meeting bot is temporarily unavailable. You can continue with one- or two-channel capture.",
      title: "Meeting bot is unavailable",
    },
    meeting_bot_disabled: {
      canFallback: true,
      canRetry: false,
      message: "Meeting bot is temporarily unavailable. You can continue with one- or two-channel capture.",
      title: "Meeting bot is unavailable",
    },
    meeting_bot_setup_incomplete: {
      canFallback: true,
      canRetry: false,
      message: "Meeting bot is still being prepared. You can continue with one- or two-channel capture.",
      title: "Meeting bot is unavailable",
    },
    meeting_bot_temporarily_unavailable: {
      canFallback: true,
      canRetry: false,
      message: "Meeting bot is temporarily unavailable. You can continue with one- or two-channel capture.",
      title: "Meeting bot is unavailable",
    },
    meeting_bot_already_active: {
      canFallback: false,
      canRetry: false,
      message: "SalesFrame is already joining or recording this call.",
      title: "Meeting bot is already active",
    },
    invalid_meeting_url: {
      canFallback: false,
      canRetry: false,
      message: "Copy the direct meeting link from the invitation and try again.",
      title: "Check the meeting link",
    },
    lobby_timeout: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame was not admitted within the waiting period. Ask the host to admit it, then try again.",
      title: "SalesFrame stayed in the lobby",
    },
    meeting_ended: {
      canFallback: true,
      canRetry: false,
      message: "This meeting appears to have ended. Use a current meeting link to continue.",
      title: "The meeting has ended",
    },
    meeting_link_expired: {
      canFallback: true,
      canRetry: false,
      message: "Use the latest link from the meeting invitation.",
      title: "The meeting link has expired",
    },
    meeting_link_invalid: {
      canFallback: false,
      canRetry: false,
      message: "Copy the direct meeting link from the invitation and try again.",
      title: "Check the meeting link",
    },
    meeting_locked: {
      canFallback: true,
      canRetry: false,
      message: "This meeting is locked. Ask the host to unlock it, or use browser capture for this call.",
      title: "The meeting is locked",
    },
    meeting_not_found: {
      canFallback: true,
      canRetry: false,
      message: "Check that the meeting has started and that the link is current.",
      title: "Meeting not found",
    },
    meeting_password_incorrect: {
      canFallback: true,
      canRetry: false,
      message: "Use the full meeting link with the correct passcode included.",
      title: "The meeting passcode did not work",
    },
    meeting_requires_sign_in: {
      canFallback: true,
      canRetry: false,
      message: "This meeting only allows signed-in participants. Use browser capture for this call.",
      title: "This meeting requires sign-in",
    },
    recording_permission_denied: {
      canFallback: true,
      canRetry: true,
      message: "The meeting did not allow SalesFrame to record. Ask the host to allow recording, then try again.",
      title: "Recording was not allowed",
    },
    provider_capacity: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not secure a meeting bot within two minutes. Try again or use browser capture.",
      title: "Meeting bots are busy",
    },
    provider_timeout: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not secure a meeting bot within two minutes. Try again or use browser capture.",
      title: "Meeting bot needs another try",
    },
    provider_unavailable: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not secure a meeting bot within two minutes. Try again or use browser capture.",
      title: "Meeting bot needs another try",
    },
    provider_unreachable: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not secure a meeting bot within two minutes. Try again or use browser capture.",
      title: "Meeting bot needs another try",
    },
    provider_state_reconciling: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not confirm the join within two minutes. Try again or use browser capture; any late bot will be removed safely.",
      title: "Meeting bot needs another try",
    },
    provider_state_reconciling_abandoned: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not confirm the join within two minutes. Try again or use browser capture; any late bot will be removed safely.",
      title: "Meeting bot needs another try",
    },
    retries_exhausted: {
      canFallback: true,
      canRetry: true,
      message: "SalesFrame could not secure a bot within two minutes. Try again or use browser capture.",
      title: "Meeting bot needs another try",
    },
    too_many_bots: {
      canFallback: true,
      canRetry: true,
      message: "Meeting bots are busy right now. Try again or use browser capture for this call.",
      title: "Meeting bots are at capacity",
    },
  }

  const presentation = errorMap[code] ?? {
    canFallback: true,
    canRetry: true,
    message: "Try the meeting bot again, or continue with one- or two-channel capture.",
    title: "Meeting bot needs another moment",
  }

  return { code, ...presentation }
}

export function isMeetingBotSessionLive(status: MeetingBotCaptureStatus) {
  return ["provisioning", "joining", "waiting_room", "recording"].includes(status)
}

export function isMeetingBotSessionPending(status: MeetingBotCaptureStatus) {
  return isMeetingBotSessionLive(status) || ["leaving", "processing"].includes(status)
}

export function shouldAcceptMeetingBotSnapshot(
  current: MeetingBotSessionSnapshot | null,
  incoming: MeetingBotSessionSnapshot
) {
  if (!current) return true
  if (current.sessionId !== incoming.sessionId) return true
  if ((current.status === "completed" || current.status === "failed") && current.status !== incoming.status) {
    return false
  }

  if (typeof current.revision === "number" && typeof incoming.revision === "number") {
    return incoming.revision > current.revision
  }

  const currentUpdatedAt = current.updatedAt ? Date.parse(current.updatedAt) : Number.NaN
  const incomingUpdatedAt = incoming.updatedAt ? Date.parse(incoming.updatedAt) : Number.NaN

  if (Number.isFinite(currentUpdatedAt) && Number.isFinite(incomingUpdatedAt)) {
    return incomingUpdatedAt > currentUpdatedAt
  }

  return true
}

function createMeetingBotUuid() {
  const cryptoApi = typeof globalThis !== "undefined"
    ? globalThis.crypto as Partial<Crypto> | undefined
    : undefined
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

export function createMeetingBotClientInstanceId() {
  return createMeetingBotUuid()
}

export function createMeetingBotClientRequestId() {
  return createMeetingBotUuid()
}

type MeetingBotPresenceEnvironment = {
  addEventListener: (type: string, listener: () => void) => void
  clearInterval: (intervalId: unknown) => void
  getVisibilityState: () => string
  removeEventListener: (type: string, listener: () => void) => void
  setInterval: (callback: () => void, intervalMs: number) => unknown
}

type MeetingBotPresenceControllerOptions = {
  disconnect: (session: MeetingBotSessionSnapshot) => Promise<unknown> | unknown
  environment: MeetingBotPresenceEnvironment
  getSession: () => MeetingBotSessionSnapshot | null
  heartbeat: (
    session: MeetingBotSessionSnapshot,
    visibilityState: MeetingBotPresenceRequest["visibilityState"]
  ) => Promise<unknown> | unknown
  heartbeatIntervalMs?: number
}

function ignorePresenceResult(result: Promise<unknown> | unknown) {
  if (result && typeof result === "object" && "then" in result) {
    void Promise.resolve(result).catch(() => undefined)
  }
}

export function createMeetingBotPresenceController({
  disconnect,
  environment,
  getSession,
  heartbeat,
  heartbeatIntervalMs = MEETING_BOT_HEARTBEAT_INTERVAL_MS,
}: MeetingBotPresenceControllerOptions) {
  let disconnectSent = false

  const heartbeatNow = () => {
    const session = getSession()
    if (disconnectSent || !session || !isMeetingBotSessionLive(session.status)) return
    const visibilityState = environment.getVisibilityState() === "visible" ? "visible" : "hidden"
    ignorePresenceResult(heartbeat(session, visibilityState))
  }

  const disconnectNow = () => {
    const session = getSession()
    if (disconnectSent || !session || !isMeetingBotSessionLive(session.status)) return
    disconnectSent = true
    ignorePresenceResult(disconnect(session))
  }

  const handlePageShow = () => {
    disconnectSent = false
    heartbeatNow()
  }

  const handleVisibilityChange = () => {
    heartbeatNow()
  }

  environment.addEventListener("beforeunload", disconnectNow)
  environment.addEventListener("pagehide", disconnectNow)
  environment.addEventListener("pageshow", handlePageShow)
  environment.addEventListener("visibilitychange", handleVisibilityChange)

  const intervalId = environment.setInterval(heartbeatNow, heartbeatIntervalMs)
  heartbeatNow()

  return () => {
    environment.clearInterval(intervalId)
    environment.removeEventListener("beforeunload", disconnectNow)
    environment.removeEventListener("pagehide", disconnectNow)
    environment.removeEventListener("pageshow", handlePageShow)
    environment.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}

export function getBrowserMeetingBotPresenceEnvironment(): MeetingBotPresenceEnvironment | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null

  return {
    addEventListener: (type, listener) => window.addEventListener(type, listener),
    clearInterval: (intervalId) => window.clearInterval(intervalId as number),
    getVisibilityState: () => document.visibilityState,
    removeEventListener: (type, listener) => window.removeEventListener(type, listener),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
  }
}
