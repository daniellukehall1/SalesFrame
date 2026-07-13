import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "../../../src/lib/supabase/database.types"
import {
  ASSISTANT_PROPOSAL_TTL_MS,
  assertAssistantCapabilityId,
  assertAssistantSafePath,
  assertAssistantText,
  assertAssistantUuid,
  type AssistantActionPreview,
  type AssistantCapabilityId,
  type AssistantProposalRequest,
  type AssistantResourceType,
  type AssistantRisk,
  toAssistantTitle,
  toNullableString,
  toOptionalDate,
  toRequiredString,
} from "./assistant-core"
import { AppError, badRequest, forbidden, notFound, tooManyRequests } from "./http"
import {
  authorizeAccount,
  authorizeCall,
  authorizeContact,
  authorizeOpportunity,
  authorizeWorkspace,
} from "./supabase"

type AssistantThreadRow = Database["public"]["Tables"]["assistant_threads"]["Row"]
type AssistantMessageRow = Database["public"]["Tables"]["assistant_messages"]["Row"]
type AssistantProposalRow = Database["public"]["Tables"]["assistant_action_proposals"]["Row"]
export type AssistantRunRow = Database["public"]["Tables"]["assistant_runs"]["Row"]

const ASSISTANT_TOOL_FIELD_BYTE_LIMIT = 1200
const ASSISTANT_TOOL_OUTPUT_BYTE_LIMIT = 16000
const ASSISTANT_HISTORY_BYTE_LIMIT = 32000
const ASSISTANT_HISTORY_MESSAGE_BYTE_LIMIT = 4000
const SUPPORTED_ACCOUNT_CURRENCIES = ["AUD", "USD", "NZD", "GBP", "EUR", "CAD", "SGD", "JPY"] as const

export type AssistantAuthorizationOptions = {
  token: string
  userId: string
}

export type AssistantReference = {
  id: string
  label: string
  route: string
  type:
    | "account"
    | "opportunity"
    | "contact"
    | "call"
    | "transcript_segment"
    | "methodology_evidence"
    | "next_call_brief"
}

export function serializeAssistantThread(thread: AssistantThreadRow) {
  return {
    archivedAt: thread.archived_at,
    createdAt: thread.created_at,
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updated_at,
    workspaceId: thread.workspace_id,
  }
}

export function serializeAssistantProposal(proposal: AssistantProposalRow) {
  return {
    capabilityId: proposal.capability_id,
    createdAt: proposal.created_at,
    executedAt: proposal.executed_at,
    expiresAt: proposal.expires_at,
    id: proposal.id,
    preview: proposal.preview,
    resultResourceId: proposal.result_resource_id,
    resultResourceType: proposal.result_resource_type,
    risk: proposal.risk,
    status: proposal.status,
  }
}

export async function authorizeAssistantThread(
  supabase: SupabaseClient<Database>,
  threadId: string,
  options: AssistantAuthorizationOptions
) {
  const { data, error } = await supabase
    .from("assistant_threads")
    .select("*")
    .eq("id", threadId)
    .eq("created_by_user_id", options.userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw notFound("Conversation was not found.")

  await authorizeWorkspace(options.userId, data.workspace_id, supabase, { token: options.token })
  return data
}

export async function getAssistantPreference(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  options: AssistantAuthorizationOptions
) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  const { data, error } = await supabase
    .from("workspace_member_preferences")
    .select("workspace_id,interface_mode,active_thread_id,last_standard_path")
    .eq("workspace_id", workspaceId)
    .eq("user_id", options.userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return serializeAssistantPreference(data ?? {
    workspace_id: workspaceId,
    interface_mode: "workspace",
    active_thread_id: null,
    last_standard_path: "/",
  })
}

export async function updateAssistantPreference({
  activeThreadId,
  interfaceMode,
  lastStandardPath,
  options,
  supabase,
  workspaceId,
}: {
  activeThreadId?: string | null
  interfaceMode?: unknown
  lastStandardPath?: unknown
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  workspaceId: string
}) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  const current = await getAssistantPreference(supabase, workspaceId, options)

  let normalizedThreadId = activeThreadId
  if (activeThreadId) {
    normalizedThreadId = assertAssistantUuid(activeThreadId, "activeThreadId")
    const thread = await authorizeAssistantThread(supabase, normalizedThreadId, options)
    if (thread.workspace_id !== workspaceId) throw forbidden()
    if (thread.archived_at) {
      throw new AppError(
        "assistant_thread_archived",
        "Choose an active conversation before continuing.",
        409
      )
    }
  }

  const normalizedMode = interfaceMode ?? current.interfaceMode
  if (normalizedMode !== "workspace" && normalizedMode !== "conversation") {
    throw badRequest("Interface mode is invalid.", "assistant_interface_mode_invalid")
  }

  const normalizedPath =
    lastStandardPath === undefined
      ? current.lastStandardPath
      : assertAssistantSafePath(lastStandardPath, "lastStandardPath")

  const { data, error } = await supabase
    .from("workspace_member_preferences")
    .upsert(
      {
        active_thread_id: normalizedThreadId === undefined ? current.activeThreadId : normalizedThreadId,
        interface_mode: normalizedMode,
        last_standard_path: normalizedPath,
        user_id: options.userId,
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id,user_id" }
    )
    .select("workspace_id,interface_mode,active_thread_id,last_standard_path")
    .single()

  if (error) throw new Error(error.message)
  return serializeAssistantPreference(data)
}

export async function listAssistantThreads(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  options: AssistantAuthorizationOptions,
  includeArchived = false
) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  let query = supabase
    .from("assistant_threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("created_by_user_id", options.userId)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (!includeArchived) query = query.is("archived_at", null)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(serializeAssistantThread)
}

export async function createAssistantThread({
  options,
  supabase,
  title,
  workspaceId,
}: {
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  title?: unknown
  workspaceId: string
}) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  const normalizedTitle = title === undefined ? "New conversation" : assertAssistantText(title, "title", { max: 120 })
  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({
      created_by_user_id: options.userId,
      title: normalizedTitle,
      workspace_id: workspaceId,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  await updateAssistantPreference({
    activeThreadId: data.id,
    interfaceMode: "conversation",
    options,
    supabase,
    workspaceId,
  })
  return serializeAssistantThread(data)
}

export async function ensureAssistantDefaultThread({
  options,
  supabase,
  workspaceId,
}: {
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  workspaceId: string
}) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  const { data, error } = await supabase.rpc("ensure_assistant_default_thread", {
    target_user_id: options.userId,
    target_workspace_id: workspaceId,
  })
  if (error) throw new Error(error.message)
  return serializeAssistantThread(parseAssistantThread(data))
}

export async function updateAssistantThread({
  archived,
  options,
  supabase,
  threadId,
  title,
}: {
  archived?: unknown
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  threadId: string
  title?: unknown
}) {
  const thread = await authorizeAssistantThread(supabase, threadId, options)
  const values: Database["public"]["Tables"]["assistant_threads"]["Update"] = {}
  if (title !== undefined) values.title = assertAssistantText(title, "title", { max: 120 })
  if (archived !== undefined) {
    if (typeof archived !== "boolean") throw badRequest("Archive state is invalid.", "assistant_archive_state_invalid")
    values.archived_at = archived ? new Date().toISOString() : null
  }
  if (Object.keys(values).length === 0) return serializeAssistantThread(thread)

  const { data, error } = await supabase
    .from("assistant_threads")
    .update(values)
    .eq("id", thread.id)
    .eq("workspace_id", thread.workspace_id)
    .eq("created_by_user_id", options.userId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return serializeAssistantThread(data)
}

export async function deleteAssistantThread(
  supabase: SupabaseClient<Database>,
  threadId: string,
  options: AssistantAuthorizationOptions
) {
  const thread = await authorizeAssistantThread(supabase, threadId, options)
  const { data, error } = await supabase.rpc("delete_assistant_thread", {
    target_thread_id: thread.id,
    target_user_id: options.userId,
  })
  if (error) throw new Error(error.message)
  if (!data) throw notFound("Conversation was not found.")
  return { deleted: true, id: thread.id }
}

export async function listAssistantMessages(
  supabase: SupabaseClient<Database>,
  threadId: string,
  options: AssistantAuthorizationOptions,
  limit = 100
) {
  const thread = await authorizeAssistantThread(supabase, threadId, options)
  const normalizedLimit = Math.max(1, Math.min(200, Math.round(limit)))
  const { data: messages, error: messagesError } = await supabase
    .from("assistant_messages")
    .select("id,role,content,ordinal,created_at")
    .eq("workspace_id", thread.workspace_id)
    .eq("thread_id", thread.id)
    .eq("owner_user_id", options.userId)
    .order("ordinal", { ascending: false })
    .limit(normalizedLimit)
  if (messagesError) throw new Error(messagesError.message)

  const messageIds = (messages ?? []).map((message) => message.id)
  const { data: proposals, error: proposalsError } = await supabase
    .from("assistant_action_proposals")
    .select("*")
    .eq("workspace_id", thread.workspace_id)
    .eq("thread_id", thread.id)
    .eq("user_id", options.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100)
  if (proposalsError) throw new Error(proposalsError.message)

  let references: Array<{
    label: string
    message_id: string
    reference_id: string
    reference_type: string
    route: string
  }> = []
  if (messageIds.length > 0) {
    const { data, error } = await supabase
      .from("assistant_message_references")
      .select("message_id,reference_type,reference_id,label,route")
      .eq("workspace_id", thread.workspace_id)
      .eq("thread_id", thread.id)
      .eq("owner_user_id", options.userId)
      .in("message_id", messageIds)
      .order("created_at", { ascending: true })
      .limit(Math.min(500, messageIds.length * 20))
    if (error) throw new Error(error.message)
    references = data ?? []
  }
  const referencesByMessage = new Map<string, Array<{ id: string; kind: string; label: string; route: string }>>()
  for (const reference of references ?? []) {
    const items = referencesByMessage.get(reference.message_id) ?? []
    items.push({
      id: reference.reference_id,
      kind: toClientReferenceKind(reference.reference_type),
      label: reference.label,
      route: reference.route,
    })
    referencesByMessage.set(reference.message_id, items)
  }
  return {
    messages: (messages ?? []).reverse().map((message) => ({
      content: message.content,
      createdAt: message.created_at,
      id: message.id,
      ordinal: message.ordinal,
      references: referencesByMessage.get(message.id) ?? [],
      role: message.role,
    })),
    proposals: (proposals ?? []).map(serializeAssistantProposal),
  }
}

export async function beginAssistantRun({
  clientRequestId,
  model,
  options,
  supabase,
  text,
  thread,
}: {
  clientRequestId: string
  model: string
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  text: string
  thread: AssistantThreadRow
}) {
  const { data, error } = await supabase.rpc("begin_assistant_run", {
    target_client_request_id: clientRequestId,
    target_content: text,
    target_model: model,
    target_thread_id: thread.id,
    target_title: toAssistantTitle(text),
    target_user_id: options.userId,
  })
  if (error) {
    if (error.code === "P0001") {
      throw tooManyRequests("That is a lot of conversation activity at once. Wait a moment, then try again.")
    }
    if (error.code === "P0002") {
      throw notFound("Conversation was not found.")
    }
    if (error.code === "55000" || error.code === "23505") {
      throw new AppError("assistant_turn_in_progress", "SalesFrame is already working in this conversation.", 409)
    }
    if (error.code === "22023") {
      throw badRequest("That message request is not valid for this conversation.", "assistant_request_id_conflict")
    }
    throw new Error(error.message)
  }
  const result = parseAssistantRunStart(data)
  return { existing: !result.created, run: result.run }
}

export async function getAssistantRunReplay(
  supabase: SupabaseClient<Database>,
  run: AssistantRunRow,
  userId: string
) {
  if (run.status === "running") {
    throw new AppError("assistant_turn_in_progress", "SalesFrame is already working on that message.", 409)
  }
  if (run.status === "failed" || !run.assistant_message_id) {
    throw new AppError("assistant_turn_failed", "SalesFrame couldn't complete that message. Try sending it again.", 409)
  }
  const [
    { data: message, error: messageError },
    { data: proposals, error: proposalsError },
    { data: references, error: referencesError },
  ] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("id,content,created_at")
      .eq("id", run.assistant_message_id)
      .eq("owner_user_id", userId)
      .single(),
    supabase
      .from("assistant_action_proposals")
      .select("*")
      .eq("run_id", run.id)
      .eq("user_id", userId)
      .eq("status", "pending"),
    supabase
      .from("assistant_message_references")
      .select("reference_type,reference_id,label,route")
      .eq("message_id", run.assistant_message_id)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true }),
  ])
  if (messageError) throw new Error(messageError.message)
  if (proposalsError) throw new Error(proposalsError.message)
  if (referencesError) throw new Error(referencesError.message)
  return {
    message,
    proposals: (proposals ?? []).map(serializeAssistantProposal),
    references: (references ?? []).map(toAssistantReference),
  }
}

export async function getAssistantHistory(
  supabase: SupabaseClient<Database>,
  threadId: string,
  userId: string,
  limit: number
) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role,content")
    .eq("thread_id", threadId)
    .eq("owner_user_id", userId)
    .in("role", ["user", "assistant"])
    .order("ordinal", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  const retained: Array<{ content: string; role: string }> = []
  let remainingBytes = ASSISTANT_HISTORY_BYTE_LIMIT
  for (const [index, message] of (data ?? []).entries()) {
    const perMessageLimit = index === 0 ? 8000 : ASSISTANT_HISTORY_MESSAGE_BYTE_LIMIT
    const allowedBytes = Math.min(perMessageLimit, remainingBytes)
    if (allowedBytes < 64) break
    const content = truncateUtf8(message.content, allowedBytes)
    retained.push({ content, role: message.role })
    remainingBytes -= Buffer.byteLength(content, "utf8")
  }
  return retained.reverse()
}

export async function completeAssistantRun({
  content,
  inputTokens,
  outputTokens,
  readOperations,
  references,
  run,
  supabase,
  toolRounds,
}: {
  content: string
  inputTokens: number | null
  outputTokens: number | null
  readOperations: number
  references: AssistantReference[]
  run: AssistantRunRow
  supabase: SupabaseClient<Database>
  toolRounds: number
}) {
  const uniqueReferences = Array.from(
    new Map(references.map((reference) => [`${reference.type}:${reference.id}`, reference])).values()
  ).slice(0, 20)
  const { data, error } = await supabase.rpc("complete_assistant_run", {
    target_content: content.slice(0, 12000),
    target_input_tokens: inputTokens,
    target_output_tokens: outputTokens,
    target_read_operations: Math.min(readOperations, 8),
    target_references: uniqueReferences.map((reference) => ({
      label: reference.label.slice(0, 180),
      referenceId: reference.id,
      referenceType: reference.type,
      route: assertAssistantSafePath(reference.route),
    })) as Json,
    target_run_id: run.id,
    target_tool_rounds: Math.min(toolRounds, 4),
    target_user_id: run.user_id,
  })
  if (error) {
    if (error.code === "55000" || error.code === "P0002") {
      throw new AppError("assistant_turn_inactive", "That conversation turn is no longer active.", 409)
    }
    throw new Error(error.message)
  }
  return parseAssistantMessage(data)
}

export async function renewAssistantRunLease(
  supabase: SupabaseClient<Database>,
  runId: string,
  userId: string
) {
  const { data, error } = await supabase.rpc("renew_assistant_run_lease", {
    target_run_id: runId,
    target_user_id: userId,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new AppError("assistant_turn_inactive", "That conversation turn is no longer active.", 409)
}

export async function failAssistantRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  userId: string,
  safeErrorCode: string,
  toolRounds: number,
  readOperations: number
) {
  const { error } = await supabase.rpc("fail_assistant_run", {
    target_read_operations: Math.min(readOperations, 8),
    target_run_id: runId,
    target_safe_error_code: safeErrorCode,
    target_tool_rounds: Math.min(toolRounds, 4),
    target_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function createAssistantActionProposal({
  idempotencyKey,
  options,
  request,
  run,
  supabase,
}: {
  idempotencyKey: string
  options: AssistantAuthorizationOptions
  request: AssistantProposalRequest
  run: AssistantRunRow
  supabase: SupabaseClient<Database>
}) {
  const capabilityId = assertAssistantCapabilityId(request.capabilityId)
  const prepared = await prepareAssistantAction({ capabilityId, options, request, supabase, workspaceId: run.workspace_id })
  const normalizedIdempotencyKey = `${run.id}:${idempotencyKey}`.slice(0, 160)
  const { data, error } = await supabase.rpc("create_assistant_action_proposal", {
    target_arguments: prepared.arguments as Json,
    target_capability_id: capabilityId,
    target_expected_record_updated_at: prepared.expectedUpdatedAt,
    target_expires_at: new Date(Date.now() + ASSISTANT_PROPOSAL_TTL_MS).toISOString(),
    target_idempotency_key: normalizedIdempotencyKey,
    target_preview: prepared.preview as unknown as Json,
    target_resource_id: prepared.targetResourceId,
    target_resource_type: prepared.targetResourceType,
    target_risk: prepared.risk,
    target_run_id: run.id,
    target_user_id: options.userId,
  })
  if (error) {
    if (error.code === "55000" || error.code === "P0002") {
      throw new AppError("assistant_turn_inactive", "That conversation turn is no longer active.", 409)
    }
    throw new Error(error.message)
  }
  return parseAssistantProposal(data)
}

export async function authorizeAssistantProposal(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  options: AssistantAuthorizationOptions
) {
  const { data, error } = await supabase
    .from("assistant_action_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("user_id", options.userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw notFound("Assistant action was not found.")
  await authorizeWorkspace(options.userId, data.workspace_id, supabase, { token: options.token })
  return data
}

export async function cancelAssistantProposal(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  options: AssistantAuthorizationOptions
) {
  const proposal = await authorizeAssistantProposal(supabase, proposalId, options)
  if (proposal.status !== "pending") return serializeAssistantProposal(proposal)
  const { data, error } = await supabase.rpc("cancel_assistant_action_proposal", {
    target_proposal_id: proposal.id,
    target_user_id: options.userId,
  })
  if (error) {
    if (error.code === "P0002") throw notFound("Assistant action was not found.")
    throw new Error(error.message)
  }
  return serializeAssistantProposal(parseAssistantProposal(data))
}

export async function confirmAssistantProposal(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  options: AssistantAuthorizationOptions
) {
  await authorizeAssistantProposal(supabase, proposalId, options)
  const { data, error } = await supabase.rpc("execute_assistant_action_proposal", {
    target_proposal_id: proposalId,
    target_user_id: options.userId,
  })
  if (error) {
    if (error.code === "P0002") {
      throw notFound("Assistant action was not found.")
    }
    if (error.code === "23505") {
      throw new AppError(
        "assistant_action_duplicate",
        "A matching record already exists. Review the existing record before trying again.",
        409
      )
    }
    if (error.code === "40001") {
      throw new AppError("assistant_action_conflict", "That record changed. Review the latest details before confirming again.", 409)
    }
    if (error.code === "55000" || error.code === "57014") {
      throw new AppError("assistant_action_unavailable", "That action is no longer available.", 409)
    }
    throw new Error(error.message)
  }
  if (isRecord(data) && data.status === "expired") {
    throw new AppError("assistant_action_expired", "That action expired. Ask SalesFrame to prepare it again.", 409)
  }
  return data
}

export async function buildAssistantBriefing(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  options: AssistantAuthorizationOptions
) {
  await authorizeWorkspace(options.userId, workspaceId, supabase, { token: options.token })
  const { data: opportunities, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,account_id,name,stage,coverage_score,missing_count,weak_count,next_step,updated_at")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(80)
  if (opportunityError) throw new Error(opportunityError.message)
  const accountIds = Array.from(new Set((opportunities ?? []).map((opportunity) => opportunity.account_id)))
  let accounts: Array<{ id: string; name: string }> = []
  if (accountIds.length > 0) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id,name")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .in("id", accountIds)
      .limit(80)
    if (error) throw new Error(error.message)
    accounts = data ?? []
  }
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const ranked = (opportunities ?? [])
    .map((opportunity) => ({
      opportunity,
      priority:
        (opportunity.next_step ? 0 : 50) +
        Math.min(30, opportunity.missing_count * 5) +
        Math.min(20, opportunity.weak_count * 3) +
        Math.max(0, 20 - Math.round(opportunity.coverage_score / 5)),
    }))
    .filter(({ priority }) => priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)

  const findings = ranked.map(({ opportunity }) => {
    const accountName = accountNames.get(opportunity.account_id) ?? "Opportunity"
    const needsNextStep = !opportunity.next_step
    return {
      capabilityId: needsNextStep ? "opportunities.open" : "opportunities.next_call",
      detail: needsNextStep
        ? "There is no saved next step yet."
        : `${opportunity.missing_count} missing and ${opportunity.weak_count} weak methodology fields remain.`,
      id: opportunity.id,
      title: `${accountName} — ${opportunity.name}`,
    }
  })

  return {
    actions: [
      { capabilityId: "calls.start", emphasis: "primary", id: "start_call", label: "Start call" },
      { capabilityId: "opportunities.next_call", emphasis: "secondary", id: "prepare_next_call", label: "Prepare next call" },
      { capabilityId: "opportunities.list", emphasis: "quiet", id: "review_opportunities", label: "Review opportunities" },
    ],
    description: findings.length > 0
      ? "A few things may be worth your attention."
      : "Your workspace is ready when you are.",
    findings,
    title: "Workspace briefing",
  }
}

export async function executeAssistantReadTool({
  arguments: rawArguments,
  name,
  options,
  supabase,
  workspaceId,
}: {
  arguments: unknown
  name: string
  options: AssistantAuthorizationOptions
  supabase: SupabaseClient<Database>
  workspaceId: string
}): Promise<{ output: unknown; references: AssistantReference[] }> {
  const args = isRecord(rawArguments) ? rawArguments : {}
  if (name === "search_accounts") {
    const query = normalizeSearchQuery(args.query)
    const { data, error } = await supabase
      .from("accounts")
      .select("id,name,website,industry,region,updated_at")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("name")
      .limit(200)
    if (error) throw new Error(error.message)
    const matches = localSearch(data ?? [], query, ["name", "website", "industry"], 12)
    return toolResult(matches, matches.map((item) => accountReference(item)))
  }
  if (name === "get_account") {
    const accountId = assertAssistantUuid(args.account_id, "accountId")
    const account = await authorizeAccount(options.userId, accountId, supabase, { token: options.token })
    if (account.workspace_id !== workspaceId) throw forbidden()
    const { data, error } = await supabase
      .from("accounts")
      .select("id,name,website,industry,employee_count,region,currency,current_tools,strategic_initiatives,competitors,notes,updated_at")
      .eq("id", account.id)
      .single()
    if (error) throw new Error(error.message)
    return toolResult(data, [accountReference(data)])
  }
  if (name === "search_opportunities") {
    const query = normalizeSearchQuery(args.query)
    const { data, error } = await supabase
      .from("opportunities")
      .select("id,account_id,name,stage,amount,close_date,next_step,coverage_score,missing_count,weak_count,updated_at")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)
    const matches = localSearch(data ?? [], query, ["name", "stage", "next_step"], 12)
    return toolResult(matches, matches.map((item) => opportunityReference(item)))
  }
  if (name === "get_opportunity") {
    const opportunityId = assertAssistantUuid(args.opportunity_id, "opportunityId")
    const scope = await authorizeOpportunity(options.userId, opportunityId, supabase, { token: options.token })
    if (scope.workspace_id !== workspaceId) throw forbidden()
    const { data, error } = await supabase
      .from("opportunities")
      .select("id,account_id,name,stage,amount,close_date,source,pain,decision_process,next_step,manual_notes,coverage_score,missing_count,weak_count,call_type,updated_at")
      .eq("id", scope.id)
      .single()
    if (error) throw new Error(error.message)
    return toolResult(data, [opportunityReference(data)])
  }
  if (name === "search_contacts") {
    const query = normalizeSearchQuery(args.query)
    const { data, error } = await supabase
      .from("contacts")
      .select("id,account_id,full_name,preferred_name,job_title,department,seniority,employment_status,location,updated_at")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("full_name")
      .limit(250)
    if (error) throw new Error(error.message)
    const matches = localSearch(data ?? [], query, ["full_name", "preferred_name", "job_title", "department"], 12)
    return toolResult(matches, matches.map((item) => contactReference(item)))
  }
  if (name === "get_contact") {
    const contactId = assertAssistantUuid(args.contact_id, "contactId")
    const contact = await authorizeContact(options.userId, contactId, supabase, { token: options.token })
    if (contact.workspace_id !== workspaceId) throw forbidden()
    const { data, error } = await supabase
      .from("contacts")
      .select("id,account_id,full_name,preferred_name,job_title,department,seniority,employment_status,location,timezone,updated_at")
      .eq("id", contact.id)
      .single()
    if (error) throw new Error(error.message)
    return toolResult(data, [contactReference(data)])
  }
  if (name === "list_recent_calls") {
    const { data, error } = await supabase
      .from("calls")
      .select("id,account_id,opportunity_id,title,call_type,status,started_at,ended_at,duration_seconds,updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(12)
    if (error) throw new Error(error.message)
    return toolResult(data ?? [], (data ?? []).map((item) => callReference(item)))
  }
  if (name === "search_call_transcript") {
    const callId = assertAssistantUuid(args.call_id, "callId")
    const query = normalizeSearchQuery(args.query)
    const call = await authorizeCall(options.userId, callId, supabase, { token: options.token })
    if (call.workspace_id !== workspaceId) throw forbidden()
    const { data, error } = await supabase
      .from("transcript_segments")
      .select("id,call_id,start_ms,end_ms,text,speaker_attribution,is_final,created_at")
      .eq("call_id", call.id)
      .eq("is_final", true)
      .order("created_at", { ascending: true })
      .limit(400)
    if (error) throw new Error(error.message)
    const matches = localSearch(data ?? [], query, ["text", "speaker_attribution"], 8).map((segment) => ({
      ...segment,
      text: segment.text.slice(0, 600),
    }))
    return toolResult(matches, matches.map((item) => transcriptReference(item)))
  }
  throw badRequest("That workspace lookup is not supported.", "assistant_read_tool_invalid")
}

async function prepareAssistantAction({
  capabilityId,
  options,
  request,
  supabase,
  workspaceId,
}: {
  capabilityId: AssistantCapabilityId
  options: AssistantAuthorizationOptions
  request: AssistantProposalRequest
  supabase: SupabaseClient<Database>
  workspaceId: string
}) {
  const resourceType = getCapabilityResourceType(capabilityId)
  const isCreate = capabilityId.startsWith("create_")
  const isArchive = capabilityId.startsWith("archive_")
  let accountId = request.accountId
  let targetResourceId: string | null = null
  let expectedUpdatedAt: string | null = null
  let recordName = "record"

  if (!isCreate) {
    targetResourceId = assertAssistantUuid(request.recordId, "recordId")
    const target = await getAssistantActionTarget(supabase, resourceType, targetResourceId, options)
    if (target.workspace_id !== workspaceId) throw forbidden()
    expectedUpdatedAt = target.updated_at
    recordName = target.name
    accountId = target.account_id ?? accountId
  }

  if (isCreate && resourceType !== "account") {
    accountId = assertAssistantUuid(accountId, "accountId")
    const account = await getAssistantActionTarget(supabase, "account", accountId, options)
    if (account.workspace_id !== workspaceId) throw forbidden()
  }

  const values = sanitizeActionValues(capabilityId, request.fields)
  if (isCreate) recordName = getCreatedRecordName(resourceType, values)
  const preview = buildActionPreview(capabilityId, recordName, values)
  const argumentsValue: Record<string, unknown> = {
    accountId: accountId ?? null,
    newId: isCreate ? randomUUID() : null,
    values,
  }
  return {
    arguments: argumentsValue,
    expectedUpdatedAt,
    preview,
    risk: (isArchive ? "destructive" : "standard") as AssistantRisk,
    targetResourceId,
    targetResourceType: (isCreate ? null : resourceType) as AssistantResourceType | null,
  }
}

async function getAssistantActionTarget(
  supabase: SupabaseClient<Database>,
  resourceType: AssistantResourceType,
  id: string,
  options: AssistantAuthorizationOptions
) {
  if (resourceType === "account") {
    const scope = await authorizeAccount(options.userId, id, supabase, { token: options.token })
    const { data, error } = await supabase.from("accounts").select("id,workspace_id,name,updated_at,archived_at").eq("id", scope.id).single()
    if (error) throw new Error(error.message)
    if (data.archived_at) throw new AppError("assistant_record_archived", "That account is already archived.", 409)
    return { ...data, account_id: null }
  }
  if (resourceType === "opportunity") {
    const scope = await authorizeOpportunity(options.userId, id, supabase, { token: options.token })
    const { data, error } = await supabase.from("opportunities").select("id,workspace_id,account_id,name,updated_at,archived_at").eq("id", scope.id).single()
    if (error) throw new Error(error.message)
    if (data.archived_at) throw new AppError("assistant_record_archived", "That opportunity is already archived.", 409)
    return data
  }
  const scope = await authorizeContact(options.userId, id, supabase, { token: options.token })
  const { data, error } = await supabase.from("contacts").select("id,workspace_id,account_id,full_name,updated_at,archived_at").eq("id", scope.id).single()
  if (error) throw new Error(error.message)
  if (data.archived_at) throw new AppError("assistant_record_archived", "That contact is already archived.", 409)
  return { ...data, name: data.full_name }
}

function sanitizeActionValues(capabilityId: AssistantCapabilityId, rawFields: Record<string, unknown>) {
  if (!isRecord(rawFields)) throw badRequest("Review the proposed fields.", "assistant_action_fields_invalid")
  if (capabilityId.startsWith("archive_")) {
    assertOnlyKeys(rawFields, ["reason"])
    return { reason: toNullableString(rawFields.reason, 500) }
  }

  if (capabilityId.endsWith("account")) {
    const allowed = ["name", "website", "industry", "employeeCount", "region", "currency", "currentTools", "strategicInitiatives", "competitors", "notes"]
    assertOnlyKeys(rawFields, allowed)
    const currency = fieldRequiredString(rawFields, "currency", 3)?.toUpperCase()
    if (currency && !SUPPORTED_ACCOUNT_CURRENCIES.includes(currency as (typeof SUPPORTED_ACCOUNT_CURRENCIES)[number])) {
      throw badRequest("Review the proposed currency.", "assistant_action_currency_invalid")
    }
    const values = compactValues({
      competitors: fieldString(rawFields, "competitors", 2000),
      currency,
      currentTools: fieldString(rawFields, "currentTools", 2000),
      employeeCount: fieldString(rawFields, "employeeCount", 120),
      industry: fieldString(rawFields, "industry", 240),
      name: fieldRequiredString(rawFields, "name", 240),
      notes: fieldString(rawFields, "notes", 4000),
      region: fieldRequiredString(rawFields, "region", 160),
      strategicInitiatives: fieldString(rawFields, "strategicInitiatives", 2000),
      website: fieldUrl(rawFields, "website"),
    })
    if (capabilityId === "create_account") values.name = toRequiredString(rawFields.name, 240)
    assertHasUpdate(values, capabilityId)
    return values
  }

  if (capabilityId.endsWith("opportunity")) {
    const allowed = ["name", "stage", "amount", "closeDate", "closeDateNote", "source", "pain", "decisionProcess", "nextStep", "manualNotes", "callType"]
    assertOnlyKeys(rawFields, allowed)
    const values = compactValues({
      amount: fieldString(rawFields, "amount", 120),
      callType: fieldRequiredString(rawFields, "callType", 120),
      closeDate: Object.prototype.hasOwnProperty.call(rawFields, "closeDate") ? toOptionalDate(rawFields.closeDate) : undefined,
      closeDateNote: fieldString(rawFields, "closeDateNote", 1000),
      decisionProcess: fieldString(rawFields, "decisionProcess", 3000),
      manualNotes: fieldString(rawFields, "manualNotes", 4000),
      name: fieldRequiredString(rawFields, "name", 240),
      nextStep: fieldString(rawFields, "nextStep", 2000),
      pain: fieldString(rawFields, "pain", 3000),
      source: fieldString(rawFields, "source", 240),
      stage: fieldRequiredString(rawFields, "stage", 120),
    })
    if (capabilityId === "create_opportunity") values.name = toRequiredString(rawFields.name, 240)
    assertHasUpdate(values, capabilityId)
    return values
  }

  const allowed = ["fullName", "preferredName", "jobTitle", "department", "seniority", "workEmail", "businessPhone", "linkedinUrl", "location", "timezone", "employmentStatus", "privateNotes"]
  assertOnlyKeys(rawFields, allowed)
  const employmentStatus = fieldRequiredString(rawFields, "employmentStatus", 20)
  if (employmentStatus && !["active", "former", "unknown"].includes(employmentStatus)) {
    throw badRequest("Review the employment status.", "assistant_action_fields_invalid")
  }
  const values = compactValues({
    businessPhone: fieldString(rawFields, "businessPhone", 80),
    department: fieldString(rawFields, "department", 240),
    employmentStatus,
    fullName: fieldRequiredString(rawFields, "fullName", 240),
    jobTitle: fieldString(rawFields, "jobTitle", 240),
    linkedinUrl: fieldUrl(rawFields, "linkedinUrl"),
    location: fieldString(rawFields, "location", 240),
    preferredName: fieldString(rawFields, "preferredName", 160),
    privateNotes: fieldString(rawFields, "privateNotes", 4000),
    seniority: fieldString(rawFields, "seniority", 120),
    timezone: fieldString(rawFields, "timezone", 120),
    workEmail: fieldEmail(rawFields, "workEmail"),
  })
  if (capabilityId === "create_contact") values.fullName = toRequiredString(rawFields.fullName, 240)
  assertHasUpdate(values, capabilityId)
  return values
}

function buildActionPreview(
  capabilityId: AssistantCapabilityId,
  recordName: string,
  values: Record<string, unknown>
): AssistantActionPreview {
  const verb = capabilityId.startsWith("create_") ? "Create" : capabilityId.startsWith("archive_") ? "Archive" : "Update"
  const resource = getCapabilityResourceType(capabilityId)
  const labels: Record<string, string> = {
    amount: "Amount", businessPhone: "Business phone", callType: "Call type", closeDate: "Close date",
    closeDateNote: "Close date note", competitors: "Competitors", currency: "Currency", currentTools: "Current tools",
    decisionProcess: "Decision process", department: "Department", employeeCount: "Employee count", employmentStatus: "Employment status",
    fullName: "Full name", industry: "Industry", jobTitle: "Job title", linkedinUrl: "Professional profile", location: "Location",
    manualNotes: "Notes", name: "Name", nextStep: "Next step", notes: "Notes", pain: "Pain", preferredName: "Preferred name",
    privateNotes: "Private notes", reason: "Reason", region: "Region", seniority: "Seniority", source: "Source",
    stage: "Stage", strategicInitiatives: "Strategic initiatives", timezone: "Timezone", website: "Website", workEmail: "Work email",
  }
  return {
    fields: Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .slice(0, 16)
      .map(([key, value]) => ({ label: labels[key] ?? key, value: value === null ? "Clear" : String(value) })),
    title: `${verb} ${resource}: ${recordName}`,
  }
}

function getCapabilityResourceType(capabilityId: AssistantCapabilityId): AssistantResourceType {
  if (capabilityId.endsWith("account")) return "account"
  if (capabilityId.endsWith("opportunity")) return "opportunity"
  return "contact"
}

function getCreatedRecordName(resourceType: AssistantResourceType, values: Record<string, unknown>) {
  return String(resourceType === "contact" ? values.fullName : values.name)
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const allowedSet = new Set(allowed)
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw badRequest("Review the proposed fields.", "assistant_action_fields_invalid")
  }
}

function assertHasUpdate(values: Record<string, unknown>, capabilityId: AssistantCapabilityId) {
  if (!capabilityId.startsWith("create_") && Object.keys(values).length === 0) {
    throw badRequest("Choose at least one field to update.", "assistant_action_fields_empty")
  }
}

function compactValues(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined))
}

function fieldString(value: Record<string, unknown>, key: string, max: number) {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined
  return toNullableString(value[key], max)
}

function fieldRequiredString(value: Record<string, unknown>, key: string, max: number) {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined
  return toRequiredString(value[key], max)
}

function fieldEmail(value: Record<string, unknown>, key: string) {
  const email = fieldString(value, key, 320)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("Review the proposed email.", "assistant_action_email_invalid")
  }
  return email
}

function fieldUrl(value: Record<string, unknown>, key: string) {
  const urlValue = fieldString(value, key, 2048)
  if (!urlValue) return urlValue
  let url: URL
  try {
    url = new URL(urlValue)
  } catch {
    throw badRequest("Review the proposed URL.", "assistant_action_url_invalid")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw badRequest("Review the proposed URL.", "assistant_action_url_invalid")
  }
  if (url.username || url.password) {
    throw badRequest("Review the proposed URL.", "assistant_action_url_invalid")
  }
  return url.toString()
}

function serializeAssistantPreference(value: {
  active_thread_id: string | null
  interface_mode: string
  last_standard_path: string
  workspace_id: string
}) {
  return {
    activeThreadId: value.active_thread_id,
    interfaceMode: value.interface_mode,
    lastStandardPath: value.last_standard_path,
    workspaceId: value.workspace_id,
  }
}

function normalizeSearchQuery(value: unknown) {
  return assertAssistantText(value, "query", { max: 160 }).toLocaleLowerCase()
}

function localSearch<T extends Record<string, unknown>>(rows: T[], query: string, keys: string[], limit: number) {
  return rows
    .filter((row) => keys.some((key) =>
      truncateUtf8(String(row[key] ?? ""), ASSISTANT_TOOL_FIELD_BYTE_LIMIT)
        .toLocaleLowerCase()
        .includes(query)
    ))
    .slice(0, limit)
}

function toolResult(output: unknown, references: AssistantReference[]) {
  return { output: compactAssistantToolOutput(output), references }
}

function accountReference(account: Record<string, unknown>): AssistantReference {
  return { id: String(account.id), label: String(account.name), route: `/accounts/${account.id}`, type: "account" }
}

function opportunityReference(opportunity: Record<string, unknown>): AssistantReference {
  return { id: String(opportunity.id), label: String(opportunity.name), route: `/opportunities/${opportunity.id}`, type: "opportunity" }
}

function contactReference(contact: Record<string, unknown>): AssistantReference {
  return { id: String(contact.id), label: String(contact.full_name), route: `/accounts/${contact.account_id}/contacts?contact=${contact.id}`, type: "contact" }
}

function callReference(call: Record<string, unknown>): AssistantReference {
  return { id: String(call.id), label: String(call.title), route: `/calls/${call.id}`, type: "call" }
}

function transcriptReference(segment: Record<string, unknown>): AssistantReference {
  return {
    id: String(segment.id),
    label: "Transcript evidence",
    route: `/calls/${segment.call_id}#transcript-turn-${segment.id}`,
    type: "transcript_segment",
  }
}

function toClientReferenceKind(value: string) {
  if (value === "transcript_segment") return "transcript"
  if (value === "methodology_evidence") return "methodology"
  if (value === "next_call_brief") return "brief"
  return value
}

function parseAssistantRunStart(value: Json) {
  if (!isRecord(value) || typeof value.created !== "boolean" || !isRecord(value.run)) {
    throw new Error("Assistant run response was invalid.")
  }
  const run = value.run
  if (
    typeof run.id !== "string" ||
    typeof run.workspace_id !== "string" ||
    typeof run.thread_id !== "string" ||
    typeof run.user_id !== "string" ||
    typeof run.status !== "string"
  ) {
    throw new Error("Assistant run response was invalid.")
  }
  return { created: value.created, run: run as unknown as AssistantRunRow }
}

function parseAssistantMessage(value: Json) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.workspace_id !== "string" ||
    typeof value.thread_id !== "string" ||
    typeof value.owner_user_id !== "string" ||
    typeof value.role !== "string" ||
    typeof value.content !== "string"
  ) {
    throw new Error("Assistant message response was invalid.")
  }
  return value as unknown as AssistantMessageRow
}

function parseAssistantThread(value: Json) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.workspace_id !== "string" ||
    typeof value.created_by_user_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error("Assistant conversation response was invalid.")
  }
  return value as unknown as AssistantThreadRow
}

function parseAssistantProposal(value: Json) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.workspace_id !== "string" ||
    typeof value.thread_id !== "string" ||
    typeof value.user_id !== "string" ||
    typeof value.run_id !== "string" ||
    typeof value.capability_id !== "string" ||
    typeof value.status !== "string"
  ) {
    throw new Error("Assistant proposal response was invalid.")
  }
  return value as unknown as AssistantProposalRow
}

function toAssistantReference(value: {
  label: string
  reference_id: string
  reference_type: string
  route: string
}): AssistantReference {
  if (![
    "account",
    "opportunity",
    "contact",
    "call",
    "transcript_segment",
    "methodology_evidence",
    "next_call_brief",
  ].includes(value.reference_type)) {
    throw new Error("Assistant reference response was invalid.")
  }
  return {
    id: value.reference_id,
    label: value.label,
    route: assertAssistantSafePath(value.route),
    type: value.reference_type as AssistantReference["type"],
  }
}

function compactAssistantToolOutput(value: unknown) {
  for (const stringBudget of [12000, 8000, 4000]) {
    const compacted = compactAssistantToolValue(value, { remaining: stringBudget }, 0)
    if (Buffer.byteLength(JSON.stringify(compacted), "utf8") <= ASSISTANT_TOOL_OUTPUT_BYTE_LIMIT) {
      return compacted
    }
  }
  return { omitted: true, reason: "Workspace result was too large to include safely." }
}

function compactAssistantToolValue(
  value: unknown,
  budget: { remaining: number },
  depth: number
): Json {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value
  if (typeof value === "string") {
    const allowedBytes = Math.max(0, Math.min(ASSISTANT_TOOL_FIELD_BYTE_LIMIT, budget.remaining))
    if (allowedBytes === 0) return "[Additional content omitted]"
    const compacted = truncateUtf8(value, allowedBytes)
    budget.remaining -= Buffer.byteLength(compacted, "utf8")
    return compacted
  }
  if (depth >= 4) return "[Nested content omitted]"
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => compactAssistantToolValue(item, budget, depth + 1))
  }
  if (!isRecord(value)) return String(value).slice(0, 120)

  const entries = Object.entries(value).slice(0, 32)
  return Object.fromEntries(
    entries.map(([key, item]) => [key.slice(0, 120), compactAssistantToolValue(item, budget, depth + 1)])
  )
}

function truncateUtf8(value: string, maxBytes: number) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value
  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(value.slice(0, middle), "utf8") <= Math.max(0, maxBytes - 3)) low = middle
    else high = middle - 1
  }
  return `${value.slice(0, low).trimEnd()}…`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
