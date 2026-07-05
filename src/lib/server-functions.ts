import { createClient } from "@/lib/supabase/client"
import type {
  CsvImportColumnMapping,
  CsvImportRow,
  CsvImportRowDecision,
  CsvImportSummary,
} from "@/lib/csv-import"
import type { AccountEnrichmentProfileRow, AccountEnrichmentRunRow, AccountRow } from "@/lib/supabase/salesframe-data"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"

export type OpenAiKeyStatus = {
  connected: boolean
  fingerprint: string | null
  keyLastFour: string | null
  maskedKey: string | null
  savedAt: string | null
}

export type LiveGuidanceFunctionResponse = {
  guidance: unknown
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

export type CallDiarizationResponse = {
  chunkStartedAtMs: number
  segments: {
    endMs: number
    speaker: string
    startMs: number
    text: string
  }[]
  sourceHint: string
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

type FunctionRequestOptions = {
  body?: unknown
  method?: "DELETE" | "GET" | "POST"
  signal?: AbortSignal
  timeoutMs?: number
}

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
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw new Error(error.message)
  if (!session?.access_token) throw new Error("Sign in before using this feature.")

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
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "X-SalesFrame-Client-Request-Id": clientRequestId,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
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

async function callMultipartFunction<T>(path: string, formData: FormData): Promise<T> {
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw new Error(error.message)
  if (!session?.access_token) throw new Error("Sign in before using this feature.")

  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  })
  const payload = await readFunctionPayload<T>(response)

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

export function createRealtimeTranscriptionSession(
  callId: string,
  options: { sourceKind?: string; transcriptionDelay?: string } = {}
) {
  return callFunction<unknown>("/api/openai/realtime-transcription", {
    method: "POST",
    body: { callId, ...options },
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

export function requestPostCallOutputs(callId: string) {
  return callFunction<unknown>("/api/openai/post-call-outputs", {
    method: "POST",
    body: { callId },
  })
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

export function requestLiveState(body: Record<string, unknown>) {
  return callFunction<unknown>("/api/openai/live-state", {
    method: "POST",
    body,
  })
}

export function requestSpeakerAttribution(body: Record<string, unknown>) {
  return callFunction<SpeakerAttributionResponse>("/api/openai/speaker-attribution", {
    method: "POST",
    body,
  })
}

export function requestCallDiarization({
  audio,
  callId,
  chunkStartedAtMs,
  sourceHint,
}: {
  audio: Blob
  callId: string
  chunkStartedAtMs: number
  sourceHint: string
}) {
  const formData = new FormData()
  formData.set("callId", callId)
  formData.set("chunkStartedAtMs", String(Math.max(0, Math.round(chunkStartedAtMs))))
  formData.set("sourceHint", sourceHint)
  formData.set("audio", audio, `salesframe-${callId}-${Date.now()}.webm`)

  return callMultipartFunction<CallDiarizationResponse>("/api/openai/call-diarization", formData)
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
