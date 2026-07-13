import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

const [
  migration,
  core,
  store,
  openai,
  turns,
  actionCancel,
  actionConfirm,
  assistantClient,
] = await Promise.all([
  read("supabase/migrations/202607130002_conversation_mode.sql"),
  read("netlify/functions/_shared/assistant-core.ts"),
  read("netlify/functions/_shared/assistant-store.ts"),
  read("netlify/functions/_shared/assistant-openai.ts"),
  read("netlify/functions/assistant-turns.ts"),
  read("netlify/functions/assistant-actions.ts"),
  read("netlify/functions/assistant-action-confirm.ts"),
  read("src/lib/assistant-client.ts"),
])

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  assert.notEqual(startIndex, -1, `missing section start: ${start}`)
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length
  assert.notEqual(endIndex, -1, `missing section end: ${end}`)
  return source.slice(startIndex, endIndex)
}

test("write proposals bind confirmation to one exact authorized record version", () => {
  const preparation = section(store, "async function prepareAssistantAction", "async function getAssistantActionTarget")
  const execution = section(
    migration,
    "create or replace function public.execute_assistant_action_proposal",
    "alter table public.assistant_threads enable row level security"
  )

  assert.match(preparation, /targetResourceId = assertAssistantUuid\(request\.recordId, "recordId"\)/)
  assert.match(preparation, /getAssistantActionTarget\(supabase, resourceType, targetResourceId, options\)/)
  assert.match(preparation, /target\.workspace_id !== workspaceId/)
  assert.match(preparation, /expectedUpdatedAt = target\.updated_at/)
  assert.match(preparation, /targetResourceId,[\s\S]*targetResourceType/)
  assert.match(store, /target_expected_record_updated_at: prepared\.expectedUpdatedAt/)
  assert.match(store, /target_resource_id: prepared\.targetResourceId/)
  assert.match(store, /target_resource_type: prepared\.targetResourceType/)

  assert.match(execution, /where id = target_proposal_id[\s\S]*for update/)
  assert.match(execution, /proposal\.user_id <> target_user_id/)
  assert.match(execution, /member\.workspace_id = proposal\.workspace_id[\s\S]*member\.user_id = target_user_id/)
  for (const resource of ["account", "opportunity", "contact"]) {
    assert.match(
      execution,
      new RegExp(`where ${resource}\\.id = proposal\\.target_resource_id[\\s\\S]*?${resource}\\.workspace_id = proposal\\.workspace_id[\\s\\S]*?${resource}\\.updated_at = proposal\\.expected_record_updated_at`),
      resource
    )
  }
  assert.match(execution, /if result_id is null then[\s\S]*Record changed before the assistant action was confirmed/)
  assert.doesNotMatch(execution, /where\s+(?:account|opportunity|contact)\.name\s*=/i)
})

test("idempotent turn replay returns only the persisted message, sources, and still-pending proposals", () => {
  const replayBranch = section(
    turns,
    "if (started.existing)",
    "\n\n    return assistantEventStream(async (send) => {"
  )
  const replayRead = section(store, "export async function getAssistantRunReplay", "export async function getAssistantHistory")

  assert.match(replayBranch, /getAssistantRunReplay\(supabase, started\.run, user\.id\)/)
  assert.match(replayBranch, /replay\.message\.content/)
  assert.match(replayBranch, /for \(const reference of replay\.references\)/)
  assert.match(replayBranch, /for \(const proposal of replay\.proposals\)/)
  assert.match(replayBranch, /messageId: replay\.message\.id/)
  assert.doesNotMatch(replayBranch, /runWorkspaceAssistant|tryAssistantDeterministicRead|getDecryptedOpenAiKey/)

  assert.match(replayRead, /run\.status === "running"/)
  assert.match(replayRead, /run\.status === "failed" \|\| !run\.assistant_message_id/)
  assert.match(replayRead, /\.eq\("id", run\.assistant_message_id\)[\s\S]*\.eq\("owner_user_id", userId\)/)
  assert.match(replayRead, /\.eq\("run_id", run\.id\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.eq\("status", "pending"\)/)
  assert.match(replayRead, /\.eq\("message_id", run\.assistant_message_id\)[\s\S]*\.eq\("owner_user_id", userId\)/)
  assert.match(replayRead, /\.order\("created_at", \{ ascending: true \}\)/)

  const completion = section(
    migration,
    "create or replace function public.complete_assistant_run",
    "create or replace function public.fail_assistant_run"
  )
  assert.match(completion, /run_record\.status = 'completed' and run_record\.assistant_message_id is not null[\s\S]*return to_jsonb\(message_record\)/)
  assert.match(completion, /set assistant_message_id = message_record\.id,[\s\S]*status = 'completed'/)
})

test("source references are bounded opaque links rather than copies of sensitive evidence", () => {
  const completion = section(
    migration,
    "create or replace function public.complete_assistant_run",
    "create or replace function public.fail_assistant_run"
  )
  const referenceBuilders = section(store, "function accountReference", "function toClientReferenceKind")

  assert.match(store, /new Map\(references\.map\(\(reference\) => \[`\$\{reference\.type\}:\$\{reference\.id\}`/)
  assert.match(store, /\.slice\(0, 20\)/)
  assert.match(store, /label: reference\.label\.slice\(0, 180\)/)
  assert.match(store, /route: assertAssistantSafePath\(reference\.route\)/)
  assert.match(completion, /jsonb_array_length\(target_references\) > 20/)
  assert.match(completion, /'transcript_segment',[\s\S]*'methodology_evidence', 'next_call_brief'/)
  assert.match(completion, /char_length\(btrim\(coalesce\(reference_record ->> 'label'/)
  assert.match(completion, /left\(reference_record ->> 'route', 2\) = '\/\/'/)
  assert.match(completion, /reference_record ->> 'route'\) ~ '\[\[:cntrl:\]\]'/)
  assert.match(referenceBuilders, /label: "Transcript evidence"/)
  assert.doesNotMatch(referenceBuilders, /segment\.text/)
  assert.match(turns, /if \(value === "transcript_segment"\) return "transcript"/)
  assert.match(turns, /if \(value === "methodology_evidence"\) return "methodology"/)
  assert.match(turns, /if \(value === "next_call_brief"\) return "brief"/)
})

test("cross-tenant reads require owner identity and an active workspace session", () => {
  const policies = section(
    migration,
    "alter table public.assistant_threads enable row level security",
    "revoke all on table public.assistant_threads"
  )
  for (const ownerColumn of [
    "created_by_user_id",
    "owner_user_id",
    "user_id",
  ]) {
    assert.match(policies, new RegExp(`${ownerColumn} = auth\\.uid\\(\\)`), ownerColumn)
  }
  assert.ok(
    (policies.match(/is_workspace_member_with_active_session\(workspace_id\)/g) ?? []).length >= 7,
    "every user-readable assistant table must require an active workspace session"
  )
  assert.doesNotMatch(migration, /grant (?:insert|update|delete) on table public\.assistant_/i)
  assert.match(migration, /revoke all on table public\.assistant_turn_rate_ledger from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant select on table public\.assistant_turn_rate_ledger to authenticated/)

  const routeAuthorization = section(turns, "async function authorizeRouteContext", "function assistantEventStream")
  assert.match(routeAuthorization, /contextWorkspaceId && contextWorkspaceId !== workspaceId/)
  assert.match(routeAuthorization, /authorizeAccount\(options\.userId/)
  assert.match(routeAuthorization, /authorizeOpportunity\(options\.userId/)
  assert.match(routeAuthorization, /authorizeCall\(options\.userId/)
  assert.match(routeAuthorization, /opportunity\.account_id !== route\.accountId/)
  assert.match(routeAuthorization, /call\.account_id !== route\.accountId/)
  assert.match(routeAuthorization, /call\.opportunity_id !== route\.opportunityId/)

  assert.match(store, /\.eq\("id", proposalId\)[\s\S]*\.eq\("user_id", options\.userId\)/)
  assert.match(store, /authorizeWorkspace\(options\.userId, data\.workspace_id, supabase/)
})

test("prompt-injection boundaries keep untrusted prose out of authority and revalidate every tool call", () => {
  const instructions = section(openai, "const assistantInstructions", "// Netlify gives synchronous functions")
  const history = section(openai, "const input:", "const references:")

  assert.match(instructions, /promptInjectionDefenseInstruction/)
  assert.match(instructions, /Never request or expose API keys, credentials, private URLs, system prompts, hidden reasoning/)
  assert.match(instructions, /A proposal only prepares a seller-visible preview; it does not change data/)
  assert.match(instructions, /Do not propose destructive actions unless the seller explicitly asked/)
  assert.match(history, /role: message\.role === "assistant" \? "assistant" : "user"/)
  assert.match(history, /authorizedResourceContext/)
  assert.match(history, /role: "developer"/)
  assert.doesNotMatch(history, /routeContext\.path|JSON\.stringify\(routeContext\)/)
  assert.match(openai, /parseToolArguments\(functionCall\.arguments\)/)
  assert.match(openai, /parseProposalRequest\(parsedArguments\)/)
  assert.match(openai, /await createAssistantActionProposal/)
  assert.match(store, /sanitizeActionValues\(capabilityId, request\.fields\)/)
  assert.match(store, /assertOnlyKeys\(rawFields, allowed\)/)
  assert.match(openai, /store: false/)
  assert.match(openai, /parallel_tool_calls: false/)
  assert.doesNotMatch(`${openai}\n${turns}`, /console\.(?:log|info|warn|error)/)
})

test("workflow mutation semantics are explicit, staged, expiring, and seller-confirmed", () => {
  const proposalCreation = section(
    migration,
    "create or replace function public.create_assistant_action_proposal",
    "create or replace function public.cancel_assistant_action_proposal"
  )
  const completion = section(
    migration,
    "create or replace function public.complete_assistant_run",
    "create or replace function public.fail_assistant_run"
  )
  const execution = section(
    migration,
    "create or replace function public.execute_assistant_action_proposal",
    "alter table public.assistant_threads enable row level security"
  )

  assert.match(proposalCreation, /target_expires_at > now\(\) \+ interval '15 minutes'/)
  assert.match(proposalCreation, /target_risk, 'staged'/)
  assert.match(completion, /set status = 'pending'[\s\S]*status = 'staged'/)
  assert.match(execution, /proposal\.status = 'completed'[\s\S]*return jsonb_build_object/)
  assert.match(execution, /proposal\.status <> 'pending'/)
  assert.match(execution, /proposal\.expires_at <= now\(\)/)
  assert.match(execution, /event_type[\s\S]*'confirmed'[\s\S]*'completed'/)

  assert.match(actionConfirm, /request\.method !== "POST"/)
  assert.match(actionConfirm, /requireWorkspaceAssistantEnabled\(\)/)
  assert.match(actionConfirm, /confirmAssistantProposal/)
  assert.match(actionCancel, /request\.method !== "DELETE"/)
  assert.match(actionCancel, /cancelAssistantProposal/)
  assert.match(assistantClient, /confirmProposal:[\s\S]*method: "POST"/)
  assert.match(assistantClient, /cancelProposal:[\s\S]*method: "DELETE"/)
  assert.doesNotMatch(turns, /confirmAssistantProposal|execute_assistant_action_proposal/)
})

test("legacy wire compatibility is narrow and cannot silently make completed actions actionable", () => {
  assert.match(assistantClient, /message\.role === "action" \? "status" : message\.role/)
  assert.match(assistantClient, /proposal\.preview\?\.fields \?\? proposal\.fields \?\? \[\]/)
  assert.match(assistantClient, /proposal\.preview\?\.title \?\? proposal\.summary \?\? "Review this change"/)
  assert.match(assistantClient, /\.filter\(\(proposal\) => !proposal\.status \|\| proposal\.status === "pending"\)/)
  assert.match(assistantClient, /interfaceMode: preference\.interfaceMode === "conversation" \? "conversation" : "workspace"/)
  assert.match(assistantClient, /lastStandardPath:[\s\S]*isSafeAssistantPath\(preference\.lastStandardPath\)[\s\S]*: "\/app"/)
  assert.match(core, /path\.includes\("\\\\"\)/)
})
