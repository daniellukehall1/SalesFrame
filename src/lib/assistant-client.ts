import type {
  AssistantActionProposal,
  AssistantMessage,
  AssistantMessageReference,
  AssistantStreamEvent,
  AssistantThreadCollection,
  AssistantThreadMessages,
  AssistantThreadSummary,
  AssistantTurnRequest,
  AssistantWorkspacePreference,
} from "@/lib/assistant-types"

export type AssistantTransport = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  stream: (
    path: string,
    init: RequestInit,
    onEvent: (event: AssistantStreamEvent) => void
  ) => Promise<void>
}

export const ASSISTANT_STREAM_INACTIVITY_TIMEOUT_MS = 48_000
export const ASSISTANT_STREAM_TOTAL_TIMEOUT_MS = 55_000

export class AssistantStreamError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "AssistantStreamError"
    this.code = code
  }
}

type AssistantStreamReadOptions = {
  inactivityTimeoutMs?: number
  signal?: AbortSignal
  totalTimeoutMs?: number
}

export function createAssistantClient(transport: AssistantTransport) {
  return {
    listThreads: async (workspaceId: string, options: { includeArchived?: boolean } = {}) => {
      const query = new URLSearchParams({ workspaceId })
      if (options.includeArchived) query.set("includeArchived", "true")
      const response = await transport.request<AssistantThreadsWireResponse>(`/api/assistant/threads?${query}`)
      return normalizeThreadCollection(response)
    },
    createThread: async (workspaceId: string, title?: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>("/api/assistant/threads", {
        body: JSON.stringify({ workspaceId, ...(title?.trim() ? { title: title.trim() } : {}) }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      return normalizeThread(response.thread)
    },
    ensureDefaultThread: async (workspaceId: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>("/api/assistant/threads", {
        body: JSON.stringify({ ensureDefault: true, workspaceId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      return normalizeThread(response.thread)
    },
    getThread: async (threadId: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>(
        `/api/assistant/threads/${encodeURIComponent(threadId)}`
      )
      return normalizeThread(response.thread)
    },
    updateThread: async (
      threadId: string,
      patch: { title?: string; archived?: boolean }
    ) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>(
        `/api/assistant/threads/${encodeURIComponent(threadId)}`,
        {
          body: JSON.stringify(patch),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }
      )
      return normalizeThread(response.thread)
    },
    archiveThread: async (threadId: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>(
        `/api/assistant/threads/${encodeURIComponent(threadId)}`,
        {
          body: JSON.stringify({ archived: true }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }
      )
      return normalizeThread(response.thread)
    },
    restoreThread: async (threadId: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>(
        `/api/assistant/threads/${encodeURIComponent(threadId)}`,
        {
          body: JSON.stringify({ archived: false }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }
      )
      return normalizeThread(response.thread)
    },
    deleteThread: (threadId: string) =>
      transport.request<void>(`/api/assistant/threads/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
      }),
    listMessages: async (threadId: string, limit = 50) => {
      const query = new URLSearchParams({ limit: String(limit) })
      const response = await transport.request<AssistantMessagesWireResponse>(
        `/api/assistant/threads/${encodeURIComponent(threadId)}/messages?${query}`
      )
      return normalizeThreadMessages(response)
    },
    sendTurn: (
      payload: AssistantTurnRequest,
      onEvent: (event: AssistantStreamEvent) => void,
      signal?: AbortSignal
    ) =>
      transport.stream(
        "/api/assistant/turns",
        {
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal,
        },
        onEvent
      ),
    confirmProposal: <T>(proposalId: string, signal?: AbortSignal) =>
      transport.request<T>(`/api/assistant/actions/${encodeURIComponent(proposalId)}/confirm`, {
        method: "POST",
        signal,
      }),
    cancelProposal: (proposalId: string, signal?: AbortSignal) =>
      transport.request<void>(`/api/assistant/actions/${encodeURIComponent(proposalId)}`, {
        method: "DELETE",
        signal,
      }),
  }
}

type AssistantThreadWire = {
  id: string
  title: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

type AssistantWorkspacePreferenceWire = {
  interfaceMode?: string
  activeThreadId?: string | null
  lastStandardPath?: string
}

type AssistantThreadsWireResponse = {
  threads: AssistantThreadWire[]
  preference?: AssistantWorkspacePreferenceWire | null
}

type AssistantMessageWire = {
  id: string
  role: "user" | "assistant" | "action" | "status"
  content: string
  ordinal: number
  createdAt: string
  references?: AssistantReferenceWire[]
}

type AssistantReferenceWire = {
  id: string
  kind: AssistantMessageReference["kind"]
  label: string
  description?: string
  route?: string
}

type AssistantProposalWire = {
  id: string
  capabilityId: string
  preview?: { title?: string; fields?: Array<{ label?: string; value?: string }> }
  summary?: string
  fields?: Array<{ label?: string; value?: string }>
  risk: "standard" | "costed" | "destructive"
  status?: "pending" | "completed" | "cancelled" | "expired" | "failed"
  expiresAt: string
  safeErrorMessage?: string
}

type AssistantMessagesWireResponse = {
  messages: AssistantMessageWire[]
  proposals?: AssistantProposalWire[]
}

const assistantReferenceKinds = new Set<AssistantMessageReference["kind"]>([
  "account",
  "opportunity",
  "contact",
  "call",
  "transcript",
  "methodology",
  "brief",
])

function normalizeThreadCollection(response: AssistantThreadsWireResponse): AssistantThreadCollection {
  return {
    threads: response.threads.map(normalizeThread),
    preference: normalizePreference(response.preference),
  }
}

function normalizeThread(thread: AssistantThreadWire): AssistantThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    archived: Boolean(thread.archivedAt),
    archivedAtIso: thread.archivedAt,
    createdAtIso: thread.createdAt,
    updatedAtIso: thread.updatedAt,
  }
}

function normalizePreference(
  preference: AssistantWorkspacePreferenceWire | null | undefined
): AssistantWorkspacePreference | null {
  if (!preference) return null
  return {
    interfaceMode: preference.interfaceMode === "conversation" ? "conversation" : "workspace",
    activeThreadId: typeof preference.activeThreadId === "string" ? preference.activeThreadId : null,
    lastStandardPath: typeof preference.lastStandardPath === "string" && isSafeAssistantPath(preference.lastStandardPath)
      ? preference.lastStandardPath
      : "/app",
  }
}

function isSafeAssistantPath(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001F\u007F]/.test(value)
  )
}

function normalizeThreadMessages(response: AssistantMessagesWireResponse): AssistantThreadMessages {
  return {
    messages: response.messages.map((message): AssistantMessage => ({
      id: message.id,
      role: message.role === "action" ? "status" : message.role,
      text: message.content,
      createdAtIso: message.createdAt,
      references: message.references?.map((reference) => ({
        id: reference.id,
        kind: reference.kind,
        label: reference.label,
        description: reference.description,
        route: reference.route,
      })),
    })),
    proposals: (response.proposals ?? [])
      .filter((proposal) => !proposal.status || proposal.status === "pending")
      .map(normalizeProposal),
  }
}

function normalizeProposal(proposal: AssistantProposalWire): AssistantActionProposal {
  const rawFields = proposal.preview?.fields ?? proposal.fields ?? []
  return {
    id: proposal.id,
    capabilityId: proposal.capabilityId,
    summary: proposal.preview?.title ?? proposal.summary ?? "Review this change",
    fields: rawFields.flatMap((field) =>
      typeof field.label === "string" && typeof field.value === "string"
        ? [{ label: field.label, value: field.value }]
        : []
    ),
    risk: proposal.risk,
    expiresAt: proposal.expiresAt,
    state: proposal.status === "failed" ? "failed" : "ready",
    errorMessage: proposal.safeErrorMessage,
  }
}

export async function readAssistantEventStream(
  response: Response,
  onEvent: (event: AssistantStreamEvent) => void,
  options: AssistantStreamReadOptions = {}
) {
  if (!response.ok) throw new Error("SalesFrame could not start this conversation.")
  if (!response.body) throw new Error("SalesFrame could not read this conversation.")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const inactivityTimeoutMs = normalizeStreamTimeout(
    options.inactivityTimeoutMs,
    ASSISTANT_STREAM_INACTIVITY_TIMEOUT_MS
  )
  const totalTimeoutMs = normalizeStreamTimeout(
    options.totalTimeoutMs,
    ASSISTANT_STREAM_TOTAL_TIMEOUT_MS
  )
  const deadlineAt = Date.now() + totalTimeoutMs
  let buffer = ""
  let terminalEvent: "complete" | "error" | null = null

  const dispatchEvent = (event: AssistantStreamEvent) => {
    if (terminalEvent) {
      throw new AssistantStreamError(
        "assistant_stream_protocol_error",
        "SalesFrame received an unexpected conversation update."
      )
    }
    onEvent(event)
    if (event.type === "complete" || event.type === "error") terminalEvent = event.type
  }

  try {
    while (!terminalEvent) {
      const remainingTotalMs = deadlineAt - Date.now()
      if (remainingTotalMs <= 0) throw assistantStreamTotalTimeout()
      const totalDeadlineIsNext = remainingTotalMs <= inactivityTimeoutMs
      const { done, value } = await readAssistantStreamChunk(reader, {
        signal: options.signal,
        timeoutError: totalDeadlineIsNext
          ? assistantStreamTotalTimeout()
          : assistantStreamInactivityTimeout(),
        timeoutMs: Math.min(inactivityTimeoutMs, remainingTotalMs),
      })
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) emitStreamLine(line, dispatchEvent)
      if (terminalEvent) {
        if (buffer.trim() && buffer.trim() !== "[DONE]") {
          throw new AssistantStreamError(
            "assistant_stream_protocol_error",
            "SalesFrame received an unexpected conversation update."
          )
        }
        break
      }
      if (done) {
        emitStreamLine(buffer, dispatchEvent)
        buffer = ""
        break
      }
    }

    if (!terminalEvent) {
      throw new AssistantStreamError(
        "assistant_stream_interrupted",
        "SalesFrame's response was interrupted. Review the saved conversation before trying again."
      )
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

async function readAssistantStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: { signal?: AbortSignal; timeoutError: AssistantStreamError; timeoutMs: number }
) {
  if (options.signal?.aborted) throw createAssistantAbortError()

  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      options.signal?.removeEventListener("abort", handleAbort)
      callback()
    }
    const handleAbort = () => {
      finish(() => reject(createAssistantAbortError()))
      void reader.cancel().catch(() => undefined)
    }
    const timeoutId = setTimeout(() => {
      finish(() => reject(options.timeoutError))
      void reader.cancel().catch(() => undefined)
    }, options.timeoutMs)

    options.signal?.addEventListener("abort", handleAbort, { once: true })
    reader.read().then(
      (result) => finish(() => resolve(result)),
      (error: unknown) => finish(() => reject(error))
    )
  })
}

function normalizeStreamTimeout(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function assistantStreamInactivityTimeout() {
  return new AssistantStreamError(
    "assistant_stream_inactivity_timeout",
    "SalesFrame stopped receiving this response. The saved conversation will be checked before you try again."
  )
}

function assistantStreamTotalTimeout() {
  return new AssistantStreamError(
    "assistant_stream_total_timeout",
    "SalesFrame took too long to finish this response. The saved conversation will be checked before you try again."
  )
}

function createAssistantAbortError() {
  if (typeof DOMException !== "undefined") return new DOMException("The operation was aborted.", "AbortError")
  const error = new Error("The operation was aborted.")
  error.name = "AbortError"
  return error
}

function emitStreamLine(line: string, onEvent: (event: AssistantStreamEvent) => void) {
  const trimmedLine = line.trim()
  if (!trimmedLine || trimmedLine.startsWith(":")) return
  const serializedEvent = trimmedLine.startsWith("data:")
    ? trimmedLine.slice("data:".length).trim()
    : trimmedLine
  if (!serializedEvent || serializedEvent === "[DONE]") return

  const event = JSON.parse(serializedEvent) as unknown
  if (!isAssistantStreamEvent(event)) throw new Error("SalesFrame received an unexpected conversation update.")
  onEvent(event)
}

function isAssistantStreamEvent(value: unknown): value is AssistantStreamEvent {
  if (!value || typeof value !== "object") return false
  const event = value as Record<string, unknown>
  if (typeof event.type !== "string") return false

  switch (event.type) {
    case "status":
    case "text_delta":
      return typeof event.text === "string"
    case "reference":
      return isAssistantReference(event.reference)
    case "canvas":
      return typeof event.capabilityId === "string" && typeof event.title === "string"
    case "proposal":
      return isAssistantProposal(event.proposal)
    case "complete":
      return typeof event.messageId === "string"
    case "error":
      return typeof event.code === "string" && typeof event.message === "string"
    default:
      return false
  }
}

function isAssistantReference(value: unknown) {
  if (!value || typeof value !== "object") return false
  const reference = value as Record<string, unknown>
  return (
    typeof reference.id === "string" &&
    assistantReferenceKinds.has(reference.kind as AssistantMessageReference["kind"]) &&
    typeof reference.label === "string" &&
    (reference.description === undefined || typeof reference.description === "string") &&
    (reference.route === undefined || (
      typeof reference.route === "string" &&
      reference.route.startsWith("/") &&
      !reference.route.startsWith("//")
    ))
  )
}

function isAssistantProposal(value: unknown) {
  if (!value || typeof value !== "object") return false
  const proposal = value as Record<string, unknown>
  if (
    typeof proposal.id !== "string" ||
    typeof proposal.capabilityId !== "string" ||
    typeof proposal.summary !== "string" ||
    !["standard", "costed", "destructive"].includes(String(proposal.risk)) ||
    typeof proposal.expiresAt !== "string" ||
    !Array.isArray(proposal.fields)
  ) return false

  return proposal.fields.every((field) => {
    if (!field || typeof field !== "object") return false
    const record = field as Record<string, unknown>
    return typeof record.label === "string" && typeof record.value === "string"
  })
}
