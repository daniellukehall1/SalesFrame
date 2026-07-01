import { createClient } from "@/lib/supabase/client"
import type {
  CsvImportColumnMapping,
  CsvImportRow,
  CsvImportRowDecision,
  CsvImportSummary,
} from "@/lib/csv-import"
import type { AccountEnrichmentProfileRow, AccountEnrichmentRunRow, AccountRow } from "@/lib/supabase/salesframe-data"

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

type FunctionRequestOptions = {
  body?: unknown
  method?: "DELETE" | "GET" | "POST"
}

export type CsvImportRequestPayload = {
  decisions: CsvImportRowDecision[]
  defaultCurrency: string
  mapping: CsvImportColumnMapping
  rows: CsvImportRow[]
  workspaceId: string
}

type FunctionEnvelope<T> =
  | { data: T }
  | {
      error: {
        code?: string
        message?: string
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
          message: text.slice(0, 240) || "Request failed.",
        },
      }
    }

    return text as T
  }
}

function getFunctionErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const code = (payload.error as { code?: unknown }).code
    if (code === "account_enrichment_storage_missing") {
      return "Account enrichment is being prepared for this workspace. You can keep using the account record and try enrichment again shortly."
    }

    const message = (payload.error as { message?: unknown }).message

    if (typeof message === "string" && message.trim()) return message
  }

  return "Request failed."
}

async function callFunction<T>(path: string, options: FunctionRequestOptions = {}): Promise<T> {
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw new Error(error.message)
  if (!session?.access_token) throw new Error("Sign in before using this feature.")

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await readFunctionPayload<T>(response)

  if (!response.ok) {
    throw new Error(getFunctionErrorMessage(payload))
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T
  }

  return payload as T
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
    throw new Error(getFunctionErrorMessage(payload))
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

export function requestLiveGuidance(body: Record<string, unknown>) {
  return callFunction<LiveGuidanceFunctionResponse>("/api/openai/live-guidance", {
    method: "POST",
    body,
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
