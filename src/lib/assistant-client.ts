import type {
  AssistantActionProposal,
  AssistantCapability,
  AssistantArtifact,
  AssistantArtifactAction,
  AssistantArtifactField,
  AssistantArtifactKind,
  AssistantArtifactRecord,
  AssistantArtifactSection,
  AssistantArtifactStep,
  AssistantActionTarget,
  AssistantMessage,
  AssistantMessageReference,
  AssistantPreparedAction,
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

type LocalAssistantCapabilityDefinition = AssistantCapability & {
  executionMode?: "read" | "navigate" | "write" | "background"
  risk?: "none" | "standard" | "costed" | "destructive"
  surface?: "native" | "secure_handoff"
}

export function createAssistantClient(
  transport: AssistantTransport,
  localCapabilities: readonly LocalAssistantCapabilityDefinition[] = []
) {
  return {
    listThreads: async (workspaceId: string, options: { includeArchived?: boolean } = {}) => {
      const query = new URLSearchParams({ workspaceId })
      if (options.includeArchived) query.set("includeArchived", "true")
      const response = await transport.request<AssistantThreadsWireResponse>(`/api/assistant/threads?${query}`)
      return normalizeThreadCollection(response)
    },
    createThread: async (workspaceId: string, title?: string, threadId?: string) => {
      const response = await transport.request<{ thread: AssistantThreadWire }>("/api/assistant/threads", {
        body: JSON.stringify({
          workspaceId,
          ...(threadId ? { threadId } : {}),
          ...(title?.trim() ? { title: title.trim() } : {}),
        }),
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
    listCapabilities: async (workspaceId: string) => {
      const query = new URLSearchParams({ workspaceId })
      const response = await transport.request<unknown>(`/api/assistant/capabilities?${query}`)
      const capabilities = normalizeAssistantCapabilityCatalog(response, localCapabilities)
      return capabilities.length ? capabilities : [...localCapabilities]
    },
    getArtifact: async (artifactId: string) => {
      const response = await transport.request<{ artifact: unknown }>(
        `/api/assistant/artifacts/${encodeURIComponent(artifactId)}`
      )
      const artifact = normalizeAssistantArtifact(response.artifact)
      if (!artifact) throw new Error("SalesFrame could not open that result.")
      return artifact
    },
    queryArtifact: async (
      artifactId: string,
      query: { cursor?: string; search?: string; sort?: string; filters?: Record<string, string> },
      signal?: AbortSignal
    ) => {
      const response = await transport.request<{ artifact: unknown }>(
        `/api/assistant/artifacts/${encodeURIComponent(artifactId)}/query`,
        {
          body: JSON.stringify(query),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal,
        }
      )
      const artifact = normalizeAssistantArtifact(response.artifact)
      if (!artifact) throw new Error("SalesFrame could not update that result.")
      return artifact
    },
    prepareArtifactAction: async (artifactId: string, actionId: string, signal?: AbortSignal) => {
      const response = await transport.request<AssistantPreparedActionWire>(
        "/api/assistant/actions/prepare",
        {
          body: JSON.stringify({ actionId, artifactId }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal,
        }
      )
      return normalizePreparedAction(response)
    },
    getTask: async (taskId: string, signal?: AbortSignal) => {
      const response = await transport.request<{ artifact: unknown }>(
        `/api/assistant/tasks/${encodeURIComponent(taskId)}`,
        { signal }
      )
      const artifact = normalizeAssistantArtifact(response.artifact)
      if (!artifact || artifact.kind !== "task") {
        throw new Error("SalesFrame could not open that progress update.")
      }
      return artifact
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
    confirmProposal: async (proposalId: string, signal?: AbortSignal) => {
      const response = await transport.request<unknown>(`/api/assistant/actions/${encodeURIComponent(proposalId)}/confirm`, {
        method: "POST",
        signal,
      })
      return normalizePreparedAction(asRecord(response) ?? {})
    },
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
  artifacts?: unknown[]
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

type AssistantPreparedActionWire = {
  capability?: unknown
  proposal?: AssistantProposalWire
  artifact?: unknown
  reference?: AssistantReferenceWire
}

const assistantCapabilityGroups = new Set<AssistantCapability["group"]>([
  "workspace",
  "accounts",
  "contacts",
  "opportunities",
  "calls",
  "playbooks",
  "settings",
])

const assistantCapabilityPresentations = new Set<AssistantCapability["presentation"]>([
  "message",
  "list",
  "record",
  "form",
  "evidence",
  "live_call",
])

const assistantContextKinds = new Set<AssistantCapability["requiredContext"][number]>([
  "workspace",
  "account",
  "opportunity",
  "call",
])

export function normalizeAssistantCapabilityCatalog(
  value: unknown,
  localCatalog: readonly LocalAssistantCapabilityDefinition[]
): LocalAssistantCapabilityDefinition[] {
  const response = asRecord(value)
  if (!response || !Array.isArray(response.capabilities)) return []
  const localCapabilities = new Map<string, LocalAssistantCapabilityDefinition>(
    localCatalog.map((capability) => [capability.id, capability])
  )
  const seen = new Set<string>()

  return response.capabilities.slice(0, localCatalog.length).flatMap((item) => {
    const capability = asRecord(item)
    if (!capability) return []
    const id = safeIdentifier(capability.id)
    const local = id ? localCapabilities.get(id) : undefined
    const title = safeText(capability.title, 120)
    const description = safeText(capability.description, 500)
    const group = safeText(capability.group, 32)
    const presentation = safeText(capability.presentation, 32)
    const executionMode = safeText(capability.executionMode, 32)
    const risk = safeText(capability.risk, 32)
    const surface = safeText(capability.surface, 32)
    const rawRequiredContext = capability.requiredContext
    const rawRequiredContextLength = Array.isArray(rawRequiredContext) ? rawRequiredContext.length : -1
    const requiredContext = Array.isArray(rawRequiredContext)
      ? rawRequiredContext.slice(0, 4).flatMap((context) => {
          const normalized = safeText(context, 32)
          return normalized && assistantContextKinds.has(normalized as AssistantCapability["requiredContext"][number])
            ? [normalized as AssistantCapability["requiredContext"][number]]
            : []
        })
      : null

    if (
      !id || !local || seen.has(id) || !title || !description ||
      !group || !assistantCapabilityGroups.has(group as AssistantCapability["group"]) ||
      !presentation || !assistantCapabilityPresentations.has(presentation as AssistantCapability["presentation"]) ||
      !requiredContext || requiredContext.length !== rawRequiredContextLength ||
      !["read", "navigate", "write", "background"].includes(executionMode ?? "") ||
      !["none", "standard", "costed", "destructive"].includes(risk ?? "") ||
      !["native", "secure_handoff"].includes(surface ?? "") ||
      (local.executionMode !== undefined && local.executionMode !== executionMode) ||
      (local.risk !== undefined && local.risk !== risk) ||
      (local.surface !== undefined && local.surface !== surface)
    ) return []

    seen.add(id)
    return [{
      id,
      title,
      description,
      group: group as AssistantCapability["group"],
      mode: executionMode === "read"
        ? "read"
        : executionMode === "navigate"
          ? "navigate"
          : "propose_write",
      presentation: presentation as AssistantCapability["presentation"],
      requiredContext,
      keywords: [...local.keywords],
      executionMode: executionMode as LocalAssistantCapabilityDefinition["executionMode"],
      risk: risk as LocalAssistantCapabilityDefinition["risk"],
      surface: surface as LocalAssistantCapabilityDefinition["surface"],
    }]
  })
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
      references: message.references?.flatMap((reference) => isAssistantReference(reference)
        ? [{
            id: reference.id,
            kind: reference.kind,
            label: reference.label,
            description: reference.description,
            route: reference.route,
          }]
        : []
      ),
      artifacts: message.artifacts?.flatMap((artifact) => {
        const normalized = normalizeAssistantArtifact(artifact)
        return normalized ? [normalized] : []
      }),
    })),
    proposals: (response.proposals ?? [])
      .filter((proposal) => !proposal.status || proposal.status === "pending")
      .map(normalizeProposal),
  }
}

function normalizePreparedAction(response: AssistantPreparedActionWire | Record<string, unknown>): AssistantPreparedAction {
  const rawCapability = asRecord(response.capability)
  const rawProposal = asRecord(response.proposal)
  const rawReference = asRecord(response.reference)
  const artifact = normalizeAssistantArtifact(response.artifact)
  return {
    capability: normalizePreparedCapability(rawCapability),
    proposal: rawProposal && isAssistantProposalWire(rawProposal)
      ? normalizeProposal(rawProposal)
      : undefined,
    artifact: artifact ?? undefined,
    reference: rawReference && isAssistantReference(rawReference)
      ? {
          id: rawReference.id as string,
          kind: rawReference.kind as AssistantMessageReference["kind"],
          label: rawReference.label as string,
          description: rawReference.description as string | undefined,
          route: rawReference.route as string | undefined,
        }
      : undefined,
  }
}

function normalizePreparedCapability(value: Record<string, unknown> | null): AssistantPreparedAction["capability"] {
  if (!value) return undefined
  const id = safeText(value.id, 120)
  const rawTarget = asRecord(value.target) ?? {}
  if (!id) return undefined
  const target: AssistantActionTarget = {}
  const accountId = safeIdentifier(rawTarget.accountId)
  const opportunityId = safeIdentifier(rawTarget.opportunityId)
  const contactId = safeIdentifier(rawTarget.contactId)
  const callId = safeIdentifier(rawTarget.callId)
  if (accountId) target.accountId = accountId
  if (opportunityId) target.opportunityId = opportunityId
  if (contactId) target.contactId = contactId
  if (callId) target.callId = callId
  return { id, target }
}

function isAssistantProposalWire(value: Record<string, unknown>): value is AssistantProposalWire {
  return (
    typeof value.id === "string" &&
    typeof value.capabilityId === "string" &&
    ["standard", "costed", "destructive"].includes(String(value.risk)) &&
    typeof value.expiresAt === "string"
  )
}

const assistantArtifactKinds = new Set<AssistantArtifactKind>([
  "collection",
  "record",
  "summary",
  "relationship",
  "evidence",
  "form",
  "workflow",
  "task",
])

const assistantArtifactKindAliases: Record<string, AssistantArtifactKind> = {
  table: "collection",
  metrics: "summary",
  timeline: "summary",
  clarification: "form",
  action_plan: "workflow",
}

export function normalizeAssistantArtifact(value: unknown): AssistantArtifact | null {
  const artifact = asRecord(value)
  if (!artifact || !withinSerializedLimit(artifact, 65_536)) return null
  if (artifact.schemaVersion !== undefined && artifact.schemaVersion !== 1) return null

  const rawKind = safeText(artifact.kind, 32)
  const kind = rawKind && (
    assistantArtifactKinds.has(rawKind as AssistantArtifactKind)
      ? rawKind as AssistantArtifactKind
      : assistantArtifactKindAliases[rawKind]
  )
  const id = safeIdentifier(artifact.id)
  const title = safeText(artifact.title, 160)
  if (!id || !kind || !title) return null

  const data = asRecord(artifact.data) ?? artifact
  const taskData = asRecord(data.task) ?? (kind === "task" ? data : null)
  const taskStatus = taskData ? safeText(taskData.status, 32) : undefined
  const task = taskStatus && ["queued", "running", "completed", "failed"].includes(taskStatus)
    ? {
        status: taskStatus as "queued" | "running" | "completed" | "failed",
        progress: normalizeProgress(taskData?.progress),
        detail: safeText(taskData?.detail, 1_000),
      }
    : undefined

  return {
    id,
    kind,
    schemaVersion: 1,
    title,
    description: safeText(artifact.description, 1_000),
    status: normalizeArtifactStatus(artifact.status ?? task?.status),
    summary: safeText(data.summary, 2_000),
    fields: normalizeArtifactFields(data.fields, 24),
    records: normalizeArtifactRecords(data.records ?? data.rows, 25),
    sections: normalizeArtifactSections(data.sections, 12),
    steps: normalizeArtifactSteps(data.steps, 16),
    task,
    emptyState: safeText(data.emptyState, 500),
    cursor: safeText(data.cursor, 500),
    actions: normalizeArtifactActions(artifact.actions ?? data.actions, 4),
  }
}

function normalizeArtifactFields(value: unknown, limit: number): AssistantArtifactField[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, limit).flatMap((item, index) => {
    const field = asRecord(item)
    if (!field) return []
    const label = safeText(field.label, 120)
    const rawValue = scalarText(field.value, 2_000)
    if (!label || rawValue === undefined) return []
    const tone = safeText(field.tone, 24)
    return [{
      id: safeIdentifier(field.id) ?? `field-${index + 1}`,
      label,
      value: rawValue,
      detail: safeText(field.detail, 1_000),
      tone: ["neutral", "positive", "attention", "critical"].includes(tone ?? "")
        ? tone as AssistantArtifactField["tone"]
        : undefined,
    }]
  })
}

function normalizeArtifactRecords(value: unknown, limit: number): AssistantArtifactRecord[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, limit).flatMap((item, index) => {
    const record = asRecord(item)
    if (!record) return []
    const id = safeIdentifier(record.id) ?? `record-${index + 1}`
    const label = safeText(record.label ?? record.title ?? record.name, 160)
    if (!label) return []
    const kind = safeText(record.kind ?? record.type, 32)
    const normalizedKind = ["account", "opportunity", "contact", "call", "playbook"].includes(kind ?? "")
      ? kind as AssistantArtifactRecord["kind"]
      : "other"
    return [{
      id,
      kind: normalizedKind,
      label,
      description: safeText(record.description ?? record.subtitle, 500),
      fields: normalizeArtifactFields(record.fields ?? objectEntriesAsFields(record.values), 12),
      actions: normalizeArtifactActions(record.actions, 4),
    }]
  })
}

function normalizeArtifactSections(value: unknown, limit: number): AssistantArtifactSection[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, limit).flatMap((item, index) => {
    const section = asRecord(item)
    if (!section) return []
    return [{
      id: safeIdentifier(section.id) ?? `section-${index + 1}`,
      title: safeText(section.title, 160),
      description: safeText(section.description, 1_000),
      fields: normalizeArtifactFields(section.fields, 24),
      records: normalizeArtifactRecords(section.records ?? section.rows, 25),
    }]
  })
}

function normalizeArtifactSteps(value: unknown, limit: number): AssistantArtifactStep[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, limit).flatMap((item, index) => {
    const step = asRecord(item)
    const label = step ? safeText(step.label ?? step.title, 200) : undefined
    if (!step || !label) return []
    const status = safeText(step.status, 24)
    return [{
      id: safeIdentifier(step.id) ?? `step-${index + 1}`,
      label,
      description: safeText(step.description, 1_000),
      status: ["pending", "active", "completed", "failed"].includes(status ?? "")
        ? status as AssistantArtifactStep["status"]
        : undefined,
    }]
  })
}

function normalizeArtifactActions(value: unknown, limit: number): AssistantArtifactAction[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, limit).flatMap((item) => {
    const action = asRecord(item)
    if (!action) return []
    const id = safeIdentifier(action.id)
    const label = safeText(action.label, 120)
    const legacyKind = safeText(action.kind, 32)
    const rawBehavior = safeText(action.behavior, 32) ?? ({
      open_resource: "secure_handoff",
      open_canvas: "open_artifact",
    }[legacyKind ?? ""])
    if (!id || !label || !rawBehavior || ![
      "open_artifact",
      "open_form",
      "submit_prompt",
      "prepare_action",
      "secure_handoff",
    ].includes(rawBehavior)) return []

    const rawTarget = asRecord(action.target) ?? {}
    const legacyResource = asRecord(action.resource)
    const legacyResourceKind = safeText(legacyResource?.kind ?? rawTarget.resourceType, 32)
    const legacyResourceId = safeIdentifier(legacyResource?.id ?? rawTarget.resourceId)
    const target: AssistantActionTarget = {}
    const accountId = safeIdentifier(rawTarget.accountId) ?? (legacyResourceKind === "account" ? legacyResourceId : undefined)
    const opportunityId = safeIdentifier(rawTarget.opportunityId) ?? (legacyResourceKind === "opportunity" ? legacyResourceId : undefined)
    const contactId = safeIdentifier(rawTarget.contactId) ?? (legacyResourceKind === "contact" ? legacyResourceId : undefined)
    const callId = safeIdentifier(rawTarget.callId) ?? (legacyResourceKind === "call" ? legacyResourceId : undefined)
    if (accountId) target.accountId = accountId
    if (opportunityId) target.opportunityId = opportunityId
    if (contactId) target.contactId = contactId
    if (callId) target.callId = callId
    const capabilityId = safeText(action.capabilityId, 120) ?? (
      legacyResourceKind && legacyResourceId
        ? ({
            account: "accounts.open",
            opportunity: "opportunities.open",
            contact: "contacts.open",
            call: "calls.open",
          }[legacyResourceKind] ?? "workspace.search")
        : "workspace.search"
    )

    return [{
      id,
      capabilityId,
      label,
      behavior: rawBehavior as AssistantArtifactAction["behavior"],
      risk: normalizeActionRisk(action.risk),
      target,
      prompt: safeText(action.prompt, 2_000),
      artifactId: safeIdentifier(action.artifactId ?? action.targetArtifactId),
      disabled: action.disabled === true,
    }]
  })
}

function objectEntriesAsFields(value: unknown) {
  const record = asRecord(value)
  if (!record) return undefined
  return Object.entries(record).slice(0, 12).map(([label, fieldValue], index) => ({
    id: `value-${index + 1}`,
    label,
    value: fieldValue,
  }))
}

function normalizeArtifactStatus(value: unknown): AssistantArtifact["status"] {
  const status = safeText(value, 24)
  return ["ready", "loading", "stale", "queued", "running", "completed", "failed"].includes(status ?? "")
    ? status as AssistantArtifact["status"]
    : undefined
}

function normalizeActionRisk(value: unknown): AssistantArtifactAction["risk"] {
  const risk = safeText(value, 24)
  return ["standard", "costed", "destructive"].includes(risk ?? "")
    ? risk as AssistantArtifactAction["risk"]
    : "none"
}

function normalizeProgress(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : undefined
}

function scalarText(value: unknown, limit: number) {
  if (typeof value === "string") return safeText(value, limit) ?? ""
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return undefined
}

function safeText(value: unknown, limit: number) {
  if (typeof value !== "string") return undefined
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
  return text ? text.slice(0, limit) : undefined
}

function safeIdentifier(value: unknown) {
  const identifier = safeText(value, 180)
  return identifier && /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(identifier) ? identifier : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function withinSerializedLimit(value: unknown, limit: number) {
  try {
    return JSON.stringify(value).length <= limit
  } catch {
    return false
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
  const normalizedEvent = normalizeAssistantStreamEvent(event)
  if (!normalizedEvent) throw new Error("SalesFrame received an unexpected conversation update.")
  onEvent(normalizedEvent)
}

function isAssistantStreamEvent(value: unknown): value is AssistantStreamEvent {
  return normalizeAssistantStreamEvent(value) !== null
}

function normalizeAssistantStreamEvent(value: unknown): AssistantStreamEvent | null {
  if (!value || typeof value !== "object") return null
  const event = value as Record<string, unknown>
  if (typeof event.type !== "string") return null

  switch (event.type) {
    case "status":
    case "text_delta":
      return typeof event.text === "string" ? { type: event.type, text: event.text } : null
    case "reference":
      return isAssistantReference(event.reference)
        ? { type: "reference", reference: event.reference as AssistantMessageReference }
        : null
    case "canvas":
      return typeof event.capabilityId === "string" && typeof event.title === "string"
        ? { type: "canvas", capabilityId: event.capabilityId, title: event.title }
        : null
    case "artifact":
    case "task": {
      const artifact = normalizeAssistantArtifact(event.artifact)
      return artifact ? { type: event.type, artifact } : null
    }
    case "proposal":
      return isAssistantProposal(event.proposal)
        ? { type: "proposal", proposal: event.proposal as AssistantActionProposal }
        : null
    case "complete":
      return typeof event.messageId === "string" ? { type: "complete", messageId: event.messageId } : null
    case "error":
      return typeof event.code === "string" && typeof event.message === "string"
        ? { type: "error", code: event.code, message: event.message }
        : null
    default:
      return null
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
      isSafeAssistantPath(reference.route)
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
