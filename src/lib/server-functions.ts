import { createClient } from "@/lib/supabase/client"
import type {
  CsvImportColumnMapping,
  CsvImportRow,
  CsvImportRowDecision,
  CsvImportSummary,
} from "@/lib/csv-import"
import type { AccountEnrichmentProfileRow, AccountEnrichmentRunRow, AccountRow } from "@/lib/supabase/salesframe-data"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"
import type {
  MeetingBotClientApi,
  MeetingBotBrowserFallbackRequest,
  MeetingBotBrowserFallbackResponse,
  MeetingBotCreateRequest,
  MeetingBotDisconnectRequest,
  MeetingBotLeaveRequest,
  MeetingBotParticipantAttributionRequest,
  MeetingBotParticipantSnapshot,
  MeetingBotPresenceRequest,
  MeetingBotSessionSnapshot,
} from "@/lib/meeting-bot"

export type OpenAiKeyStatus = {
  connected: boolean
  fingerprint: string | null
  keyLastFour: string | null
  maskedKey: string | null
  savedAt: string | null
}

export type OpenAiHealthResponse = {
  model: string
  provider: "openai"
  ready: boolean
}

export type LiveGuidanceFunctionResponse = {
  guidance: unknown
}

export type LiveQuestionFunctionResponse = {
  guidance: unknown
}

export type DeepgramTranscriptionTokenResponse = {
  accessToken: string
  config: {
    eagerEotThreshold: number
    encoding: string
    eotThreshold: number
    eotTimeoutMs: number
    model: string
    sampleRate: number
  }
  expiresIn: number
  websocketUrl: string
}

export type DeepgramHealthResponse = {
  provider: "deepgram_flux"
  ready: boolean
}

export type SpeakerAttributionResponse = {
  attribution: {
    confidence: number
    needsReview: boolean
    reason: string
    speakerLabel: string
    source: string
  }
}

export type SellerDomainResearchResponse = {
  productContext: string
  sellerCompany: string
  sellerDomain: string
  sources: string[]
}

export type AccountEnrichmentResponse = {
  account: AccountRow
  appliedCoreUpdates: Record<string, string>
  profile: AccountEnrichmentProfileRow
  run: AccountEnrichmentRunRow
  suggestedCoreUpdates: Record<string, unknown>
}

export type ContactEnrichmentQueuedResponse = {
  contactId: string
  runId: string
  status: "queued" | "completed" | "ambiguous"
}

export type BulkImportRunStatus = {
  createdAt: string
  failureRows: CsvImportSummary["failures"]
  fileName: string | null
  id: string
  importType: string
  lastUpdatedAt: string
  progress: number
  rowCount: number
  rows: {
    created: number
    failed: number
    skipped: number
    updated: number
  }
  enrichment: {
    alreadyTracked: number
    completed: number
    failed: number
    paused: number
    queued: number
    retrying: number
    running: number
    skipped: number
    total: number
  }
}

export type BulkImportStatusResponse = {
  pausedMissingKeyCount: number
  runs: BulkImportRunStatus[]
}

export type WorkspaceSessionActivityType =
  | "app_load"
  | "workspace_load"
  | "workspace_switch"
  | "route_change"
  | "user_activity"
  | "data_save"
  | "file_upload"
  | "live_call_heartbeat"
  | "start_call_check"
  | "stay_signed_in"

export type WorkspaceSessionPolicy = {
  absolute_timeout_seconds: number
  created_at: string
  idle_timeout_seconds: number | null
  updated_at: string
  updated_by: string | null
  warning_after_seconds: number
  workspace_id: string
}

export type WorkspaceSessionStatusResponse = {
  absoluteDeadline: string
  expiresAt: string
  idleDeadline: string | null
  lastActivityAt: string
  now: string
  policy: {
    absoluteTimeoutSeconds: number
    idleTimeoutSeconds: number | null
    warningAfterSeconds: number
  }
  startedAt: string
  state: "active" | "warning" | "expired"
  warningAt: string | null
}

type FunctionRequestOptions = {
  body?: unknown
  keepalive?: boolean
  method?: "DELETE" | "GET" | "POST"
  signal?: AbortSignal
  timeoutMs?: number
}

const workspaceSessionRequestTimeoutMs = 15_000
let cachedFunctionAccessToken = ""

export class SalesFrameFunctionError extends Error {
  code?: string
  requestId?: string
  status: number
  traceId?: string

  constructor(message: string, options: { code?: string; requestId?: string; status: number; traceId?: string }) {
    super(message)
    this.name = "SalesFrameFunctionError"
    this.code = options.code
    this.requestId = options.requestId
    this.status = options.status
    this.traceId = options.traceId
  }
}

export type CsvImportRequestPayload = {
  decisions: CsvImportRowDecision[]
  defaultCurrency: string
  enrichmentEnabled?: boolean
  fileName?: string
  mapping: CsvImportColumnMapping
  rows: CsvImportRow[]
  workspaceId: string
}

type FunctionEnvelope<T> =
  | { data: T }
  | {
      error: {
        clientRequestId?: string
        code?: string
        message?: string
        requestId?: string
        traceId?: string
      }
    }

async function readFunctionPayload<T>(response: Response): Promise<FunctionEnvelope<T> | T | null> {
  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text) as FunctionEnvelope<T> | T
  } catch {
    if (!response.ok) {
      return {
        error: {
          message: text.slice(0, 240) || "SalesFrame needs another moment with that request. Try again shortly.",
        },
      }
    }

    return text as T
  }
}

function getFunctionErrorMessage(payload: unknown) {
  const fallback = "SalesFrame needs another moment with that request. Try again shortly."

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const code = (payload.error as { code?: unknown }).code
    if (code === "account_enrichment_storage_missing") {
      return "Account enrichment is still getting ready for this workspace. Your account is saved, and you can try Enrich account again in a moment."
    }

    const message = (payload.error as { message?: unknown }).message

    if (typeof message === "string" && message.trim()) {
      return getUserFacingErrorMessage(message, fallback)
    }
  }

  return fallback
}

function getFunctionErrorDetails(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const error = payload.error as { clientRequestId?: unknown; code?: unknown; requestId?: unknown; traceId?: unknown }

    return {
      code: typeof error.code === "string" ? error.code : undefined,
      requestId:
        typeof error.requestId === "string"
          ? error.requestId
          : typeof error.clientRequestId === "string"
            ? error.clientRequestId
            : undefined,
      traceId: typeof error.traceId === "string" ? error.traceId : undefined,
    }
  }

  return {}
}

export function getErrorReference(error: unknown) {
  if (error instanceof SalesFrameFunctionError) {
    return error.traceId || error.requestId || ""
  }

  return ""
}

export function appendErrorReference(message: string, error: unknown) {
  const reference = getErrorReference(error)

  return reference ? `${message} Reference: ${reference}.` : message
}

async function callFunction<T>(path: string, options: FunctionRequestOptions = {}): Promise<T> {
  let accessToken = options.keepalive ? cachedFunctionAccessToken : ""
  if (!accessToken) {
    const supabase = createClient()
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) throw new Error(error.message)
    if (!session?.access_token) throw new Error("Sign in before using this feature.")
    accessToken = session.access_token
    cachedFunctionAccessToken = accessToken
  }

  const controller = new AbortController()
  const clientRequestId = createClientRequestId()
  let timedOut = false
  let timeoutId: number | undefined

  const abortFromCaller = () => controller.abort()

  if (options.signal?.aborted) {
    controller.abort()
  } else if (options.signal) {
    options.signal.addEventListener("abort", abortFromCaller, { once: true })
  }

  if (options.timeoutMs && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, options.timeoutMs)
  }

  let response: Response
  let payload: FunctionEnvelope<T> | T | null

  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-SalesFrame-Client-Request-Id": clientRequestId,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive,
      signal: controller.signal,
    })
    payload = await readFunctionPayload<T>(response)
  } catch (caughtError) {
    if (timedOut) {
      throw new SalesFrameFunctionError("SalesFrame timed out while waiting for this request.", {
        code: "client_request_timeout",
        requestId: clientRequestId,
        status: 408,
      })
    }

    throw caughtError
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
    options.signal?.removeEventListener("abort", abortFromCaller)
  }

  if (!response.ok) {
    throw new SalesFrameFunctionError(getFunctionErrorMessage(payload), {
      ...getFunctionErrorDetails(payload),
      status: response.status,
    })
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T
  }

  return payload as T
}

function createClientRequestId() {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12)

  return `sf_${Date.now().toString(36)}_${randomPart}`
}

export function getOpenAiKeyStatus(workspaceId: string) {
  return callFunction<OpenAiKeyStatus>(`/api/openai/key?workspaceId=${encodeURIComponent(workspaceId)}`)
}

export function saveOpenAiKey(apiKey: string, workspaceId: string) {
  return callFunction<OpenAiKeyStatus>("/api/openai/key", {
    method: "POST",
    body: { apiKey, workspaceId },
  })
}

export function deleteOpenAiKey(workspaceId: string) {
  return callFunction<{ connected: false }>(`/api/openai/key?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  })
}

export function createDeepgramTranscriptionToken(
  callId: string,
  options: { sourceKind?: string } = {}
) {
  return callFunction<DeepgramTranscriptionTokenResponse>("/api/deepgram/token", {
    method: "POST",
    body: { callId, ...options },
    timeoutMs: 8000,
  })
}

export function checkDeepgramTranscriptionHealth() {
  return callFunction<DeepgramHealthResponse>("/api/deepgram/health", {
    timeoutMs: 8000,
  })
}

export function checkOpenAiWorkspaceHealth(workspaceId: string) {
  return callFunction<OpenAiHealthResponse>(`/api/openai/health?workspaceId=${encodeURIComponent(workspaceId)}`, {
    timeoutMs: 10000,
  })
}

export function requestCustomerResearch(body: Record<string, unknown>) {
  return callFunction<unknown>("/api/openai/customer-research", {
    method: "POST",
    body,
  })
}

export function requestSellerDomainResearch(body: {
  apiKey?: string
  domain: string
  workspaceId?: string
}) {
  return callFunction<SellerDomainResearchResponse>("/api/openai/seller-domain-research", {
    method: "POST",
    body,
  })
}

export function requestAccountEnrichment(accountId: string) {
  return callFunction<AccountEnrichmentResponse>("/api/openai/account-enrichment", {
    method: "POST",
    body: { accountId },
  })
}

export function requestContactEnrichment(contactId: string) {
  return callFunction<ContactEnrichmentQueuedResponse>("/api/openai/contact-enrichment", {
    method: "POST",
    body: { contactId },
  })
}

export function requestPostCallOutputs(callId: string) {
  return callFunction<unknown>("/api/openai/post-call-outputs", {
    method: "POST",
    body: { callId },
  })
}

export function createMeetingBot(
  body: MeetingBotCreateRequest,
  options: { signal?: AbortSignal } = {}
) {
  return callFunction<MeetingBotSessionSnapshot>("/api/meeting-bots", {
    method: "POST",
    body,
    signal: options.signal,
    timeoutMs: 20_000,
  })
}

export function getMeetingBotSession(sessionId: string, options: { signal?: AbortSignal } = {}) {
  return callFunction<MeetingBotSessionSnapshot>(`/api/meeting-bots/${encodeURIComponent(sessionId)}`, {
    signal: options.signal,
    timeoutMs: 12_000,
  })
}

export function getMeetingBotSessionForCall(callId: string, options: { signal?: AbortSignal } = {}) {
  return callFunction<MeetingBotSessionSnapshot>(`/api/meeting-bots?callId=${encodeURIComponent(callId)}`, {
    signal: options.signal,
    timeoutMs: 12_000,
  })
}

export function heartbeatMeetingBot(
  sessionId: string,
  body: MeetingBotPresenceRequest,
  options: { signal?: AbortSignal } = {}
) {
  return callFunction<MeetingBotSessionSnapshot>(`/api/meeting-bots/${encodeURIComponent(sessionId)}/heartbeat`, {
    method: "POST",
    body,
    signal: options.signal,
    timeoutMs: 10_000,
  })
}

export function disconnectMeetingBot(sessionId: string, body: MeetingBotDisconnectRequest) {
  return callFunction<MeetingBotSessionSnapshot>(`/api/meeting-bots/${encodeURIComponent(sessionId)}/disconnect`, {
    method: "POST",
    body,
    keepalive: true,
  })
}

export function transitionMeetingBotToBrowserCapture(
  sessionId: string,
  body: MeetingBotBrowserFallbackRequest,
  options: { signal?: AbortSignal } = {}
) {
  return callFunction<MeetingBotBrowserFallbackResponse>(
    `/api/meeting-bots/${encodeURIComponent(sessionId)}/fallback`,
    {
      method: "POST",
      body,
      signal: options.signal,
      timeoutMs: 12_000,
    }
  )
}

export function leaveMeetingBot(
  sessionId: string,
  body: MeetingBotLeaveRequest,
  options: { signal?: AbortSignal } = {}
) {
  return callFunction<MeetingBotSessionSnapshot>(`/api/meeting-bots/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    body,
    signal: options.signal,
    timeoutMs: 20_000,
  })
}

export function correctMeetingBotParticipantAttribution(
  sessionId: string,
  participantId: string,
  body: MeetingBotParticipantAttributionRequest,
  options: { signal?: AbortSignal } = {}
) {
  return callFunction<MeetingBotParticipantSnapshot>(
    `/api/meeting-bots/${encodeURIComponent(sessionId)}/participants/${encodeURIComponent(participantId)}/attribution`,
    {
      method: "POST",
      body,
      signal: options.signal,
      timeoutMs: 12_000,
    }
  )
}

export const meetingBotClientApi: MeetingBotClientApi = {
  create: createMeetingBot,
  disconnect: disconnectMeetingBot,
  fallback: transitionMeetingBotToBrowserCapture,
  get: getMeetingBotSession,
  heartbeat: heartbeatMeetingBot,
  leave: leaveMeetingBot,
}

export function requestLiveGuidance(
  body: Record<string, unknown>,
  options: Pick<FunctionRequestOptions, "signal" | "timeoutMs"> = {}
) {
  return callFunction<LiveGuidanceFunctionResponse>("/api/openai/live-guidance", {
    method: "POST",
    body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 25000,
  })
}

export function requestLiveQuestion(
  body: Record<string, unknown>,
  options: Pick<FunctionRequestOptions, "signal" | "timeoutMs"> = {}
) {
  return callFunction<LiveQuestionFunctionResponse>("/api/openai/live-question", {
    method: "POST",
    body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 12000,
  })
}

export function requestLiveState(
  body: Record<string, unknown>,
  options: Pick<FunctionRequestOptions, "signal" | "timeoutMs"> = {}
) {
  return callFunction<unknown>("/api/openai/live-state", {
    method: "POST",
    body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 6000,
  })
}

export function requestSpeakerAttribution(body: Record<string, unknown>) {
  return callFunction<SpeakerAttributionResponse>("/api/openai/speaker-attribution", {
    method: "POST",
    body,
  })
}

export function requestAccountCsvImport(body: CsvImportRequestPayload) {
  return callFunction<CsvImportSummary>("/api/import/accounts", {
    method: "POST",
    body,
  })
}

export function requestOpportunityCsvImport(body: CsvImportRequestPayload) {
  return callFunction<CsvImportSummary>("/api/import/opportunities", {
    method: "POST",
    body,
  })
}

export function getBulkImportStatus(workspaceId: string) {
  return callFunction<BulkImportStatusResponse>(`/api/import/enrichment-status?workspaceId=${encodeURIComponent(workspaceId)}`)
}

export function retryFailedBulkEnrichment(workspaceId: string) {
  return callFunction<BulkImportStatusResponse>("/api/import/enrichment-status", {
    method: "POST",
    body: { action: "retry_failed", workspaceId },
  })
}

export function recordWorkspaceSessionActivity(body: {
  activeCallId?: string | null
  activityType?: WorkspaceSessionActivityType
  workspaceId: string
}) {
  return callFunction<WorkspaceSessionStatusResponse>("/api/session/activity", {
    method: "POST",
    body,
    timeoutMs: workspaceSessionRequestTimeoutMs,
  })
}

export function getWorkspaceSessionStatus(workspaceId: string) {
  return callFunction<WorkspaceSessionStatusResponse>(
    `/api/session/status?workspaceId=${encodeURIComponent(workspaceId)}`,
    { timeoutMs: workspaceSessionRequestTimeoutMs }
  )
}

export function getWorkspaceSessionPolicy(workspaceId: string) {
  return callFunction<WorkspaceSessionPolicy>(
    `/api/session/policy?workspaceId=${encodeURIComponent(workspaceId)}`,
    { timeoutMs: workspaceSessionRequestTimeoutMs }
  )
}

export function saveWorkspaceSessionPolicy(workspaceId: string, idleTimeoutSeconds: number | null) {
  return callFunction<WorkspaceSessionPolicy>("/api/session/policy", {
    method: "POST",
    body: { idleTimeoutSeconds, workspaceId },
    timeoutMs: workspaceSessionRequestTimeoutMs,
  })
}
