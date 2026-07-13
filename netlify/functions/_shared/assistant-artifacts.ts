import { randomUUID } from "node:crypto"

import { getEnv } from "./env"
import { resolveServerAssistantArtifactCapability } from "./assistant-artifact-capabilities"
import type { AssistantCapabilityId, AssistantResourceType } from "./assistant-core"

export const assistantArtifactKinds = [
  "collection",
  "record",
  "summary",
  "relationship",
  "evidence",
  "form",
  "workflow",
  "task",
] as const

export const assistantArtifactActionBehaviors = [
  "open_artifact",
  "open_form",
  "submit_prompt",
  "prepare_action",
  "secure_handoff",
] as const

export type AssistantArtifactKind = (typeof assistantArtifactKinds)[number]
export type AssistantArtifactActionBehavior = (typeof assistantArtifactActionBehaviors)[number]
export type AssistantArtifactActionRisk = "none" | "standard" | "costed" | "destructive"
export type AssistantArtifactStatus = "ready" | "loading" | "stale" | "queued" | "running" | "completed" | "failed"

export type AssistantArtifactTarget = {
  accountId?: string
  opportunityId?: string
  contactId?: string
  callId?: string
}

export type AssistantArtifactAction = {
  id: string
  capabilityId: string
  label: string
  behavior: AssistantArtifactActionBehavior
  risk: AssistantArtifactActionRisk
  target: AssistantArtifactTarget
  prompt?: string
  artifactId?: string
  disabled?: boolean
}

export type AssistantArtifactField = {
  id: string
  label: string
  value: string
  detail?: string
  tone?: "neutral" | "positive" | "attention" | "critical"
}

export type AssistantArtifactRecord = {
  id: string
  kind: "account" | "opportunity" | "contact" | "call" | "playbook" | "other"
  label: string
  description?: string
  fields: AssistantArtifactField[]
  actions: AssistantArtifactAction[]
}

export type AssistantSerializedArtifact = {
  id: string
  kind: AssistantArtifactKind
  schemaVersion: 1
  title: string
  description?: string
  status?: AssistantArtifactStatus
  data: {
    summary?: string
    fields?: AssistantArtifactField[]
    records?: AssistantArtifactRecord[]
    sections?: Array<{
      id: string
      title?: string
      description?: string
      fields?: AssistantArtifactField[]
      records?: AssistantArtifactRecord[]
    }>
    steps?: Array<{ id: string; label: string; description?: string; status?: string }>
    task?: { status: string; progress?: number; detail?: string }
    emptyState?: string
    cursor?: string
  }
  actions: AssistantArtifactAction[]
}

export type AssistantThreadContextDraft = AssistantArtifactTarget & {
  artifactId?: string
  source: "explicit" | "selection" | "route" | "thread"
}

export function isAssistantArtifactsEnabled() {
  return getEnv("ASSISTANT_ARTIFACTS_ENABLED", "false").trim().toLowerCase() === "true"
}

export type AssistantPersistedArtifact = {
  id: string
  kind: AssistantArtifactKind
  schemaVersion: 1
  title: string
  description?: string
  status?: AssistantArtifactStatus
  data: Record<string, unknown>
  actions: Array<AssistantArtifactAction & { recordId?: string }>
}

const assistantActionResultDefinitions = {
  create_account: { operation: "created", resourceType: "account" },
  update_account: { operation: "updated", resourceType: "account" },
  archive_account: { operation: "archived", resourceType: "account" },
  create_opportunity: { operation: "created", resourceType: "opportunity" },
  update_opportunity: { operation: "updated", resourceType: "opportunity" },
  archive_opportunity: { operation: "archived", resourceType: "opportunity" },
  create_contact: { operation: "created", resourceType: "contact" },
  update_contact: { operation: "updated", resourceType: "contact" },
  archive_contact: { operation: "archived", resourceType: "contact" },
} satisfies Record<AssistantCapabilityId, {
  operation: "created" | "updated" | "archived"
  resourceType: AssistantResourceType
}>

export function buildAssistantCapabilityHandoffArtifact(
  capabilityId: string,
  target: AssistantArtifactTarget,
  options: { description?: string; label?: string; title?: string } = {}
): AssistantSerializedArtifact {
  const capability = resolveServerAssistantArtifactCapability(capabilityId)
  if (capability.requiredTarget !== "workspace" && !target[capability.requiredTarget]) {
    throw new Error("Assistant capability handoff target was invalid.")
  }
  return {
    actions: [{
      behavior: capability.behavior,
      capabilityId: capability.id,
      id: randomUUID(),
      label: options.label ?? capability.title,
      risk: capability.risk,
      target,
    }],
    data: {},
    description: options.description ?? capability.description,
    id: randomUUID(),
    kind: "summary",
    schemaVersion: 1,
    status: "ready",
    title: options.title ?? capability.title,
  }
}

type ArtifactAccount = { id: string; name: string }

export function buildAssistantAccountCollection(
  rows: Array<Record<string, unknown>>,
  count: number
): AssistantSerializedArtifact {
  return buildCollection({
    count,
    description: "Active accounts in this workspace.",
    emptyState: "There are no active accounts in this workspace yet.",
    records: rows.map((row) => ({
      actions: [openRecordAction("account", { accountId: String(row.id) })],
      description: optionalText(row.website),
      fields: compactFields([
        field("industry", "Industry", row.industry),
        field("region", "Region", row.region),
      ]),
      id: String(row.id),
      kind: "account",
      label: requiredLabel(row.name, "Untitled account"),
    })),
    title: count === 1 ? "1 account" : `${count} accounts`,
  })
}

export function buildAssistantOpportunityCollection(
  rows: Array<Record<string, unknown>>,
  count: number,
  account: ArtifactAccount | null
): AssistantSerializedArtifact {
  return buildCollection({
    count,
    description: account ? `Active opportunities for ${account.name}.` : "Active opportunities in this workspace.",
    emptyState: account
      ? `There are no active opportunities for ${account.name}.`
      : "There are no active opportunities in this workspace yet.",
    records: rows.map((row) => ({
      actions: [openRecordAction("opportunity", {
        accountId: String(row.account_id),
        opportunityId: String(row.id),
      })],
      description: optionalText(row.next_step) ? `Next step: ${optionalText(row.next_step)}` : undefined,
      fields: compactFields([
        field("stage", "Stage", row.stage),
        field("amount", "Amount", row.amount),
        field("close-date", "Close date", row.close_date),
      ]),
      id: String(row.id),
      kind: "opportunity",
      label: requiredLabel(row.name, "Untitled opportunity"),
    })),
    title: account
      ? `${count} ${count === 1 ? "opportunity" : "opportunities"} for ${account.name}`
      : count === 1 ? "1 opportunity" : `${count} opportunities`,
  })
}

export function buildAssistantContactCollection(
  rows: Array<Record<string, unknown>>,
  count: number,
  account: ArtifactAccount | null
): AssistantSerializedArtifact {
  return buildCollection({
    count,
    description: account ? `Active contacts for ${account.name}.` : "Active contacts in this workspace.",
    emptyState: account
      ? `There are no active contacts saved for ${account.name}.`
      : "There are no active contacts in this workspace yet.",
    records: rows.map((row) => ({
      actions: [openRecordAction("contact", {
        accountId: String(row.account_id),
        contactId: String(row.id),
      })],
      description: optionalText(row.job_title),
      fields: compactFields([
        field("department", "Department", row.department),
      ]),
      id: String(row.id),
      kind: "contact",
      label: requiredLabel(row.full_name, "Unnamed contact"),
    })),
    title: account
      ? `${count} ${count === 1 ? "contact" : "contacts"} for ${account.name}`
      : count === 1 ? "1 contact" : `${count} contacts`,
  })
}

export function buildAssistantActionResultArtifact({
  artifactId,
  capabilityId,
  record,
  resourceType,
}: {
  artifactId: string
  capabilityId: AssistantCapabilityId
  record: Record<string, unknown>
  resourceType: AssistantResourceType
}): AssistantSerializedArtifact {
  const definition = assistantActionResultDefinitions[capabilityId]
  if (
    definition.resourceType !== resourceType ||
    String(record.id ?? "") === "" ||
    (resourceType !== "account" && String(record.account_id ?? "") === "")
  ) {
    throw new Error("Assistant action result was invalid.")
  }

  const operation = definition.operation
  const labels = {
    account: requiredLabel(record.name, "Account"),
    contact: requiredLabel(record.full_name, "Contact"),
    opportunity: requiredLabel(record.name, "Opportunity"),
  }
  const label = labels[resourceType]
  const isArchived = operation === "archived"
  const action = isArchived
    ? archivedRecordAction(resourceType)
    : openRecordAction(resourceType, resourceType === "account"
      ? { accountId: String(record.id) }
      : resourceType === "opportunity"
        ? { accountId: String(record.account_id), opportunityId: String(record.id) }
        : { accountId: String(record.account_id), contactId: String(record.id) })

  const artifactRecord: AssistantArtifactRecord = resourceType === "account"
    ? {
        actions: [action],
        description: optionalText(record.website),
        fields: compactFields([
          field("industry", "Industry", record.industry),
          field("region", "Region", record.region),
        ]),
        id: String(record.id),
        kind: "account",
        label,
      }
    : resourceType === "opportunity"
      ? {
          actions: [action],
          description: optionalText(record.next_step) ? `Next step: ${optionalText(record.next_step)}` : undefined,
          fields: compactFields([
            field("stage", "Stage", record.stage),
            field("amount", "Amount", record.amount),
            field("close-date", "Close date", record.close_date),
          ]),
          id: String(record.id),
          kind: "opportunity",
          label,
        }
      : {
          actions: [action],
          description: optionalText(record.job_title),
          fields: compactFields([
            field("department", "Department", record.department),
            field("seniority", "Seniority", record.seniority),
          ]),
          id: String(record.id),
          kind: "contact",
          label,
        }

  const resourceLabel = resourceType === "opportunity"
    ? "Opportunity"
    : resourceType === "account"
      ? "Account"
      : "Contact"
  return {
    actions: [],
    data: { records: [artifactRecord] },
    description: operation === "created"
      ? `${label} is ready.`
      : operation === "updated"
        ? `Your changes to ${label} are saved.`
        : `${label} was archived.`,
    id: artifactId,
    kind: "record",
    schemaVersion: 1,
    status: "completed",
    title: `${resourceLabel} ${operation}`,
  }
}

export function buildAssistantCallCollection(
  rows: Array<Record<string, unknown>>,
  count: number,
  account: ArtifactAccount | null
): AssistantSerializedArtifact {
  return buildCollection({
    count,
    description: account ? `Calls saved for ${account.name}.` : "Recent calls in this workspace.",
    emptyState: account
      ? `There are no calls saved for ${account.name} yet.`
      : "There are no calls saved in this workspace yet.",
    records: rows.map((row) => ({
      actions: [openRecordAction("call", {
        accountId: String(row.account_id),
        opportunityId: String(row.opportunity_id),
        callId: String(row.id),
      })],
      description: optionalText(row.call_type),
      fields: compactFields([
        field("status", "Status", row.status),
        field("started", "Started", row.started_at ?? row.created_at),
      ]),
      id: String(row.id),
      kind: "call",
      label: requiredLabel(row.title, "Untitled call"),
    })),
    title: account
      ? `${count} ${count === 1 ? "call" : "calls"} for ${account.name}`
      : count === 1 ? "1 call" : `${count} calls`,
  })
}

export function buildAssistantToolReadArtifact(
  toolName: string,
  output: unknown
): AssistantSerializedArtifact | null {
  const values = Array.isArray(output) ? output.filter(isRecord) : isRecord(output) ? [output] : []
  if (toolName === "search_accounts" || toolName === "get_account") {
    const artifact = buildAssistantAccountCollection(values, values.length)
    return toolName === "get_account" && values[0]
      ? { ...artifact, kind: "record", title: requiredLabel(values[0].name, "Account") }
      : artifact
  }
  if (["search_opportunities", "list_account_opportunities", "get_opportunity"].includes(toolName)) {
    const artifact = buildAssistantOpportunityCollection(values, values.length, null)
    return toolName === "get_opportunity" && values[0]
      ? { ...artifact, kind: "record", title: requiredLabel(values[0].name, "Opportunity") }
      : artifact
  }
  if (["search_contacts", "list_account_contacts", "list_opportunity_contacts", "get_contact"].includes(toolName)) {
    const artifact = buildAssistantContactCollection(values, values.length, null)
    return toolName === "get_contact" && values[0]
      ? { ...artifact, kind: "record", title: requiredLabel(values[0].full_name, "Contact") }
      : artifact
  }
  if (["list_recent_calls", "list_account_calls", "list_opportunity_calls"].includes(toolName)) {
    return buildAssistantCallCollection(values, values.length, null)
  }
  if (toolName === "list_opportunity_playbooks") {
    return buildCollection({
      count: values.length,
      description: "Methodologies selected for this opportunity.",
      emptyState: "No methodologies are selected for this opportunity yet.",
      records: values.map((row) => ({
        actions: [],
        description: optionalText(row.description),
        fields: compactFields([field("best-for", "Best for", row.best_for)]),
        id: String(row.id),
        kind: "playbook",
        label: requiredLabel(row.name, "Methodology"),
      })),
      title: values.length === 1 ? "1 methodology" : `${values.length} methodologies`,
    })
  }
  if (toolName === "search_call_transcript") {
    return {
      actions: [],
      data: {
        emptyState: "No matching customer conversation evidence was found.",
        records: values.slice(0, 8).map((row) => ({
          actions: row.call_id ? [openRecordAction("call", { callId: String(row.call_id) })] : [],
          description: "Matching finalized transcript segment.",
          fields: compactFields([
            field("start", "Start", row.start_ms),
          ]),
          id: String(row.id),
          kind: "other" as const,
          label: "Transcript evidence",
        })),
      },
      description: "Finalized transcript matches from the authorized call.",
      id: randomUUID(),
      kind: "evidence",
      schemaVersion: 1,
      status: "ready",
      title: values.length === 1 ? "1 evidence match" : `${values.length} evidence matches`,
    }
  }
  return null
}

export function toAssistantPersistedArtifact(
  artifact: AssistantSerializedArtifact
): AssistantPersistedArtifact {
  const recordActions: AssistantPersistedArtifact["actions"] = []
  const records = (artifact.data.records ?? []).map((record) => {
    for (const action of record.actions) {
      recordActions.push({ ...normalizeServerAction(action), recordId: record.id })
    }
    const { actions: _actions, ...recordData } = record
    return recordData
  })

  return {
    actions: [...artifact.actions.map(normalizeServerAction), ...recordActions],
    data: {
      ...artifact.data,
      records,
    },
    description: artifact.description,
    id: artifact.id,
    kind: artifact.kind,
    schemaVersion: artifact.schemaVersion,
    status: artifact.status,
    title: artifact.title,
  }
}

export function restoreAssistantArtifact(
  artifact: {
    data: unknown
    description: string | null
    id: string
    kind: string
    schema_version: number
    status: string | null
    title: string
  },
  actions: Array<{
    behavior: string
    capability_id: string | null
    id: string
    label: string
    prompt: string | null
    record_key: string | null
    risk: string
    target_account_id: string | null
    target_artifact_id: string | null
    target_call_id: string | null
    target_contact_id: string | null
    target_opportunity_id: string | null
  }>
): AssistantSerializedArtifact {
  const data = isRecord(artifact.data) ? { ...artifact.data } : {}
  const restoredActions = actions.flatMap((action) => {
    try {
      return [restoreAction(action)]
    } catch {
      return []
    }
  })
  const actionsByRecord = new Map<string, AssistantArtifactAction[]>()
  for (const action of actions) {
    if (!action.record_key) continue
    let restored: AssistantArtifactAction
    try {
      restored = restoreAction(action)
    } catch {
      continue
    }
    const existing = actionsByRecord.get(action.record_key) ?? []
    existing.push(restored)
    actionsByRecord.set(action.record_key, existing)
  }
  if (Array.isArray(data.records)) {
    data.records = data.records.map((value) => {
      if (!isRecord(value)) return value
      const id = String(value.id ?? "")
      return { ...value, actions: actionsByRecord.get(id) ?? [] }
    })
  }
  return {
    actions: restoredActions.filter((action) => !actions.find((row) => row.id === action.id)?.record_key),
    data: data as AssistantSerializedArtifact["data"],
    description: artifact.description ?? undefined,
    id: artifact.id,
    kind: artifact.kind as AssistantArtifactKind,
    schemaVersion: 1,
    status: (artifact.status ?? undefined) as AssistantArtifactStatus | undefined,
    title: artifact.title,
  }
}

export function disableAssistantArtifactActions(
  artifact: AssistantSerializedArtifact,
  unavailableActionIds: Set<string>
): AssistantSerializedArtifact {
  const disable = (action: AssistantArtifactAction) => unavailableActionIds.has(action.id)
    ? { ...action, disabled: true }
    : action
  return {
    ...artifact,
    actions: artifact.actions.map(disable),
    data: {
      ...artifact.data,
      records: artifact.data.records?.map((record) => ({
        ...record,
        actions: record.actions.map(disable),
      })),
    },
  }
}

export function getAssistantArtifactCommonTarget(
  artifact: AssistantSerializedArtifact
): AssistantArtifactTarget {
  const actions = [
    ...artifact.actions,
    ...(artifact.data.records ?? []).flatMap((record) => record.actions),
  ]
  if (actions.length === 0) return {}
  const target: AssistantArtifactTarget = {}
  for (const key of ["accountId", "opportunityId", "contactId", "callId"] as const) {
    const values = actions.map((action) => action.target[key]).filter((value): value is string => Boolean(value))
    if (values.length === actions.length && new Set(values).size === 1) target[key] = values[0]
  }
  return target
}

function buildCollection({
  count,
  description,
  emptyState,
  records,
  title,
}: {
  count: number
  description: string
  emptyState: string
  records: AssistantArtifactRecord[]
  title: string
}): AssistantSerializedArtifact {
  return {
    actions: [],
    data: {
      emptyState,
      fields: [{ id: "result-count", label: "Results", value: String(count) }],
      records: records.slice(0, 20),
    },
    description,
    id: randomUUID(),
    kind: "collection",
    schemaVersion: 1,
    status: "ready",
    title,
  }
}

function openRecordAction(
  kind: "account" | "opportunity" | "contact" | "call",
  target: AssistantArtifactTarget
): AssistantArtifactAction {
  const labels = {
    account: "Open account",
    call: "Open call",
    contact: "Open contact",
    opportunity: "Open opportunity",
  }
  return {
    behavior: "secure_handoff",
    capabilityId: `${kind === "opportunity" ? "opportunities" : `${kind}s`}.open`,
    id: randomUUID(),
    label: labels[kind],
    risk: "none",
    target,
  }
}

function archivedRecordAction(
  kind: "account" | "opportunity" | "contact"
): AssistantArtifactAction {
  const plural = kind === "opportunity" ? "opportunities" : `${kind}s`
  return {
    behavior: "secure_handoff",
    capabilityId: `${plural}.restore`,
    id: randomUUID(),
    label: `View archived ${plural}`,
    risk: "standard",
    target: {},
  }
}

function restoreAction(action: {
  behavior: string
  capability_id: string | null
  id: string
  label: string
  prompt: string | null
  risk: string
  target_account_id: string | null
  target_artifact_id: string | null
  target_call_id: string | null
  target_contact_id: string | null
  target_opportunity_id: string | null
}): AssistantArtifactAction {
  const capability = resolveServerAssistantArtifactCapability(action.capability_id ?? "")
  return {
    artifactId: action.target_artifact_id ?? undefined,
    behavior: capability.behavior,
    capabilityId: capability.id,
    id: action.id,
    label: action.label,
    prompt: action.prompt ?? undefined,
    risk: capability.risk,
    target: {
      accountId: action.target_account_id ?? undefined,
      callId: action.target_call_id ?? undefined,
      contactId: action.target_contact_id ?? undefined,
      opportunityId: action.target_opportunity_id ?? undefined,
    },
  }
}

function normalizeServerAction(action: AssistantArtifactAction): AssistantArtifactAction {
  const capability = resolveServerAssistantArtifactCapability(action.capabilityId)
  if (capability.requiredTarget !== "workspace" && !action.target[capability.requiredTarget]) {
    throw new Error("Assistant artifact action target was invalid.")
  }
  return {
    ...action,
    behavior: capability.behavior,
    capabilityId: capability.id,
    risk: capability.risk,
  }
}

function field(id: string, label: string, value: unknown): AssistantArtifactField | null {
  const text = optionalText(value)
  return text ? { id, label, value: text } : null
}

function compactFields(fields: Array<AssistantArtifactField | null>) {
  return fields.filter((value): value is AssistantArtifactField => Boolean(value))
}

function requiredLabel(value: unknown, fallback: string) {
  return optionalText(value) ?? fallback
}

function optionalText(value: unknown) {
  if (value === null || value === undefined) return undefined
  const text = String(value).replace(/\s+/g, " ").trim()
  return text || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
