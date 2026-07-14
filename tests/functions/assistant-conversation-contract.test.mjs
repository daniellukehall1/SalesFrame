import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

const [
  migration,
  preflight,
  databaseTypes,
  core,
  store,
  openai,
  preferences,
  threads,
  thread,
  messages,
  briefing,
  turns,
  actions,
  confirm,
  voice,
  recovery,
  assistantClient,
] = await Promise.all([
  read("supabase/migrations/202607130002_conversation_mode.sql"),
  read("supabase/preflight/202607130002_conversation_mode.sql"),
  read("src/lib/supabase/database.types.ts"),
  read("netlify/functions/_shared/assistant-core.ts"),
  read("netlify/functions/_shared/assistant-store.ts"),
  read("netlify/functions/_shared/assistant-openai.ts"),
  read("netlify/functions/assistant-preferences.ts"),
  read("netlify/functions/assistant-threads.ts"),
  read("netlify/functions/assistant-thread.ts"),
  read("netlify/functions/assistant-messages.ts"),
  read("netlify/functions/assistant-briefing.ts"),
  read("netlify/functions/assistant-turns.ts"),
  read("netlify/functions/assistant-actions.ts"),
  read("netlify/functions/assistant-action-confirm.ts"),
  read("netlify/functions/assistant-voice-token.ts"),
  read("netlify/functions/assistant-recovery.ts"),
  read("src/lib/assistant-client.ts"),
])

test("conversation storage is private, scoped, additive, and active-session read-only", () => {
  for (const table of [
    "workspace_member_preferences",
    "assistant_threads",
    "assistant_messages",
    "assistant_runs",
    "assistant_turn_rate_ledger",
    "assistant_action_proposals",
    "assistant_action_events",
    "assistant_message_references",
    "assistant_voice_token_grants",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(databaseTypes, new RegExp(`${table}: TableDefinition`))
  }
  assert.match(migration, /foreign key \(workspace_id, created_by_user_id\)[\s\S]*references public\.workspace_members\(workspace_id, user_id\)/)
  assert.match(migration, /created_by_user_id = auth\.uid\(\)[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /owner_user_id = auth\.uid\(\)[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /user_id = auth\.uid\(\)[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /revoke all on table public\.assistant_threads from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.assistant_threads to authenticated/)
  assert.match(migration, /assistant_action_events is[\s\S]*survive deletion of their proposal or conversation/)
  assert.doesNotMatch(migration, /assistant_action_events[\s\S]{0,120}references public\.assistant_action_proposals/)
  assert.match(migration, /create trigger clear_archived_assistant_thread_preference[\s\S]*execute function public\.clear_archived_assistant_thread_preference\(\)/)
  assert.match(migration, /revoke all on function public\.clear_archived_assistant_thread_preference\(\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /workspace_id uuid not null references public\.workspaces\(id\) on delete cascade/)
  assert.match(migration, /assistant_action_events_owner_activity_idx[\s\S]*workspace_id, user_id, created_at desc/)
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]*assistant_(?:threads|messages|runs|action_proposals)[^;]*authenticated/i)
  assert.match(migration, /revoke all on table public\.assistant_turn_rate_ledger from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant select on table public\.assistant_turn_rate_ledger to authenticated/)
})

test("preferences and threads expose modern explicitly authorized routes", () => {
  const explicitCreateClient = assistantClient.slice(
    assistantClient.indexOf("createThread: async"),
    assistantClient.indexOf("ensureDefaultThread: async")
  )
  const defaultThreadFunction = migration.slice(
    migration.indexOf("create or replace function public.ensure_assistant_default_thread"),
    migration.indexOf("create or replace function public.begin_assistant_run")
  )
  assert.match(preferences, /path: "\/api\/assistant\/preferences"/)
  assert.match(preferences, /method: \["GET", "POST"\]/)
  assert.match(preferences, /getAssistantPreference/)
  assert.match(preferences, /updateAssistantPreference/)
  assert.match(threads, /path: "\/api\/assistant\/threads"/)
  assert.match(threads, /dataResponse\(\{ preference, threads \}\)/)
  assert.match(threads, /dataResponse\(\{ thread: await createAssistantThread/)
  assert.match(threads, /payload\.ensureDefault === true/)
  assert.match(threads, /assertAssistantUuidV4\(payload\.threadId, "threadId"\)/)
  assert.match(store, /\.insert\(\{[\s\S]*\.\.\.\(threadId \? \{ id: threadId \} : \{\}\)/)
  assert.match(store, /error\.code === "23505"[\s\S]*\.eq\("created_by_user_id", options\.userId\)/)
  assert.match(explicitCreateClient, /\.\.\.\(threadId \? \{ threadId \} : \{\}\)/)
  assert.match(threads, /ensureAssistantDefaultThread/)
  assert.match(store, /rpc\("ensure_assistant_default_thread"/)
  assert.match(assistantClient, /ensureDefaultThread: async \(workspaceId: string\)/)
  assert.match(assistantClient, /JSON\.stringify\(\{ ensureDefault: true, workspaceId \}\)/)
  assert.doesNotMatch(explicitCreateClient, /ensureDefault/)
  assert.match(defaultThreadFunction, /create or replace function public\.ensure_assistant_default_thread/)
  assert.match(defaultThreadFunction, /pg_advisory_xact_lock[\s\S]*assistant-default-thread:/)
  assert.match(defaultThreadFunction, /if not found then[\s\S]*insert into public\.assistant_threads/)
  assert.match(defaultThreadFunction, /on conflict \(workspace_id, user_id\) do update[\s\S]*active_thread_id = excluded\.active_thread_id/)
  assert.match(migration, /revoke all on function public\.ensure_assistant_default_thread\(uuid, uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.ensure_assistant_default_thread\(uuid, uuid\)[\s\S]*to service_role/)
  assert.match(databaseTypes, /ensure_assistant_default_thread:/)
  assert.match(thread, /path: "\/api\/assistant\/threads\/:threadId"/)
  assert.match(thread, /method: \["GET", "PATCH", "DELETE"\]/)
  assert.match(thread, /new Response\(null, \{ status: 204 \}\)/)
  assert.match(messages, /path: "\/api\/assistant\/threads\/:threadId\/messages"/)
  assert.match(store, /authorizeWorkspace\(options\.userId, data\.workspace_id, supabase, \{ token: options\.token \}\)/)
  assert.match(store, /references: referencesByMessage\.get\(message\.id\) \?\? \[\]/)
  assert.match(store, /route: reference\.route/)
  assert.match(store, /\.in\("message_id", messageIds\)/)
  assert.match(store, /assistant_thread_archived/)
  assert.doesNotMatch(`${preferences}\n${threads}\n${thread}\n${messages}`, /exports\.handler|export (?:async )?function handler/)
})

test("assistant turns use the requested Responses API model and bounded direct tools", () => {
  assert.match(core, /OPENAI_WORKSPACE_ASSISTANT_MODEL", "gpt-5\.6-terra"/)
  assert.match(openai, /https:\/\/api\.openai\.com\/v1\/responses/)
  assert.match(openai, /store: false/)
  assert.match(openai, /reasoning: \{ effort: "low" \}/)
  assert.doesNotMatch(openai, /context: "current_turn"/)
  assert.match(openai, /createHash\("sha256"\)/)
  assert.match(openai, /safety_identifier: safetyIdentifier/)
  assert.match(openai, /salesframe-workspace-assistant:/)
  assert.doesNotMatch(openai, /safety_identifier: options\.userId/)
  assert.match(openai, /include: \["reasoning\.encrypted_content"\]/)
  assert.match(openai, /content: message\.content/)
  assert.match(openai, /parallel_tool_calls: false/)
  assert.match(openai, /ASSISTANT_MAX_TOOL_ROUNDS/)
  assert.match(openai, /ASSISTANT_MAX_READ_OPERATIONS/)
  assert.match(openai, /ASSISTANT_MAX_TOOL_OUTPUT_BYTES/)
  assert.match(openai, /promptInjectionDefenseInstruction/)
  assert.match(openai, /propose_action/)
  assert.match(openai, /list_account_opportunities/)
  assert.match(openai, /list_account_contacts/)
  assert.match(openai, /list_account_calls/)
  assert.match(openai, /list_opportunity_contacts/)
  assert.match(openai, /list_opportunity_calls/)
  assert.match(openai, /list_opportunity_playbooks/)
  assert.match(openai, /toolChoice: "none"/)
  assert.match(openai, /completedReadCalls/)
  assert.match(openai, /await createAssistantActionProposal/)
  assert.match(openai, /await renewAssistantRunLease/)
  assert.match(openai, /authorizedResourceContext/)
  assert.doesNotMatch(openai, /JSON\.stringify\(routeContext\)/)
  assert.match(store, /ASSISTANT_TOOL_FIELD_BYTE_LIMIT = 1200/)
  assert.match(store, /ASSISTANT_TOOL_OUTPUT_BYTE_LIMIT = 16000/)
  assert.match(core, /ASSISTANT_MAX_TOOL_OUTPUT_BYTES = 48_000/)
  assert.match(openai, /toolOutputBytes \+ serializedToolOutputBytes > ASSISTANT_MAX_TOOL_OUTPUT_BYTES/)
  assert.match(store, /ASSISTANT_HISTORY_BYTE_LIMIT = 32000/)
  assert.match(store, /ASSISTANT_HISTORY_MESSAGE_BYTE_LIMIT = 4000/)
  assert.match(store, /compactAssistantToolOutput/)
  assert.match(store, /truncateUtf8\(String\(value/)
  assert.doesNotMatch(openai, /\.from\("(?:accounts|opportunities|contacts)"\)\.(?:insert|update|delete)/)
  assert.match(turns, /requireWorkspaceAssistantEnabled\(\)/)
  assert.match(turns, /getDecryptedOpenAiKey/)
  assert.match(turns, /authorizeAssistantThread/)
  assert.match(turns, /tryAssistantDeterministicRead/)
  assert.match(turns, /type: "text_delta"/)
  assert.match(turns, /type: "reference"/)
  assert.match(turns, /route: reference\.route/)
  assert.match(turns, /for \(const reference of replay\.references\)/)
  assert.match(turns, /type: "proposal"/)
  assert.match(turns, /type: "complete"/)
  assert.match(turns, /Content-Type": "text\/event-stream; charset=utf-8"/)
  assert.match(turns, /JSON\.stringify\(event\)\}\\n\\n/)
  assert.doesNotMatch(openai, /console\.(?:log|info|warn|error)/)
  assert.match(store, /account_name/)
  assert.match(store, /rankAssistantSearch/)
  assert.match(store, /\.eq\("account_id", account\.id\)/)
})

test("briefing remains deterministic and action execution requires fresh confirmation", () => {
  assert.match(briefing, /buildAssistantBriefing/)
  assert.doesNotMatch(briefing, /OpenAI|callOpenAi|runWorkspaceAssistant/)
  assert.match(store, /\.in\("id", accountIds\)/)
  assert.match(confirm, /confirmAssistantProposal/)
  assert.match(actions, /cancelAssistantProposal/)
  assert.match(migration, /create or replace function public\.execute_assistant_action_proposal/)
  assert.match(migration, /create or replace function public\.begin_assistant_run/)
  assert.match(migration, /create or replace function public\.complete_assistant_run/)
  assert.match(migration, /create or replace function public\.create_assistant_action_proposal/)
  assert.match(migration, /create or replace function public\.cancel_assistant_action_proposal/)
  assert.match(migration, /assistant_runs_one_running_user_key/)
  assert.match(migration, /on public\.assistant_runs\(workspace_id, user_id\)[\s\S]*where status = 'running'/)
  assert.match(migration, /run_record\.thread_id <> thread_record\.id/)
  assert.match(migration, /assistant-rate:/)
  assert.match(migration, /from public\.assistant_turn_rate_ledger[\s\S]*created_at >= now\(\) - interval '10 minutes'/)
  assert.match(migration, /insert into public\.assistant_turn_rate_ledger/)
  assert.match(store, /rpc\("begin_assistant_run"/)
  assert.match(store, /rpc\("complete_assistant_run"/)
  assert.match(store, /rpc\("fail_assistant_run"/)
  assert.match(store, /rpc\("create_assistant_action_proposal"/)
  assert.match(store, /rpc\("cancel_assistant_action_proposal"/)
  assert.match(store, /\.eq\("status", "pending"\)/)
  assert.match(migration, /if auth\.role\(\) <> 'service_role'/)
  assert.match(migration, /for update/)
  assert.match(migration, /proposal\.status = 'completed'[\s\S]*return jsonb_build_object/)
  assert.match(migration, /proposal\.expires_at <= now\(\)/)
  assert.match(migration, /updated_at = proposal\.expected_record_updated_at/)
  assert.match(migration, /status = 'completed'[\s\S]*result_resource_id = result_id/)
  assert.match(migration, /grant execute on function public\.execute_assistant_action_proposal\(uuid, uuid\)[\s\S]*to service_role/)
  assert.match(databaseTypes, /execute_assistant_action_proposal:/)
  assert.match(migration, /status text not null default 'staged'/)
  assert.match(migration, /set status = 'pending'[\s\S]*status = 'staged'/)
  assert.match(migration, /proposal\.status in \('staged', 'pending'\)/)
  assert.match(briefing, /buildAssistantBriefing/)
  assert.match(store, /capabilityId: "calls\.start"/)
  assert.match(store, /capabilityId: "opportunities\.next_call"/)
  assert.match(store, /capabilityId: "opportunities\.list"/)
})

test("workspace command voice uses a separate short-lived Flux grant", () => {
  assert.match(voice, /requireWorkspaceAssistantEnabled\(\)/)
  assert.match(voice, /authorizeWorkspace\(user\.id, workspaceId, supabase, \{ token \}\)/)
  assert.match(voice, /claim_assistant_voice_token_grant/)
  assert.match(voice, /sourceKind: "assistant_command"/)
  assert.match(voice, /grant\.expiresIn < 1 \|\| grant\.expiresIn > 60/)
  assert.match(voice, /getDeepgramFluxConfig/)
  assert.match(voice, /createDeepgramListenUrls/)
  assert.match(migration, /create or replace function public\.claim_assistant_voice_token_grant/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(databaseTypes, /claim_assistant_voice_token_grant:/)
})

test("stale assistant work is leased and recovered without exposing a public mutator", () => {
  assert.match(migration, /lease_expires_at timestamptz not null/)
  assert.match(migration, /create or replace function public\.renew_assistant_run_lease/)
  assert.match(migration, /create or replace function public\.recover_stale_assistant_state/)
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /proposal\.run_id = any\(expired_run_ids\)/)
  assert.match(migration, /safe_error_code = 'assistant_run_expired'/)
  assert.match(recovery, /rpc\("recover_stale_assistant_state"/)
  assert.match(recovery, /isWorkspaceAssistantEnabled\(\)/)
  assert.match(recovery, /schedule: "\*\/10 \* \* \* \*"/)
  assert.doesNotMatch(recovery, /path:/)
})

test("the operational gate is server-only and defaults closed", () => {
  assert.match(core, /getEnv\("WORKSPACE_ASSISTANT_ENABLED", "false"\)/)
  assert.match(core, /=== "true"/)
  assert.doesNotMatch(core, /VITE_WORKSPACE_ASSISTANT_ENABLED/)
  assert.doesNotMatch(`${turns}\n${voice}`, /VITE_WORKSPACE_ASSISTANT_ENABLED/)
})

test("assistant execution stays inside Netlify's synchronous budget", () => {
  assert.match(openai, /ASSISTANT_EXECUTION_BUDGET_MS = 45_000/)
  assert.match(openai, /ASSISTANT_OPENAI_ROUND_TIMEOUT_MS = 25_000/)
  assert.match(openai, /deadlineAt = Date\.now\(\) \+ ASSISTANT_EXECUTION_BUDGET_MS/)
  assert.match(openai, /timeoutMs: Math\.min\(ASSISTANT_OPENAI_ROUND_TIMEOUT_MS, remainingMs\)/)
  assert.match(openai, /assistant_execution_deadline/)
  assert.match(openai, /assistant_openai_timeout/)
  assert.doesNotMatch(openai, /callAssistantResponses\(\{ apiKey, input, model, safetyIdentifier \}\)/)
})

test("idempotent turns reject changed input and preserve workspace defaults", () => {
  assert.match(migration, /run_record\.model <> btrim\(target_model\)/)
  assert.match(migration, /btrim\(message_record\.content\) <> btrim\(target_content\)/)
  assert.match(migration, /Assistant request ID was reused with different input/)
  assert.match(migration, /select workspace\.default_currency from public\.workspaces workspace/)
  assert.match(preflight, /public\.workspaces\.default_currency/)
  assert.match(migration, /assistant_voice_token_grants_cleanup_idx[\s\S]*issued_at/)
})

test("thread deletion is atomic and preserves content-minimized cancellation audit", () => {
  assert.match(store, /rpc\("delete_assistant_thread"/)
  assert.match(migration, /create or replace function public\.delete_assistant_thread/)
  assert.match(migration, /proposal\.status in \('staged', 'pending'\)/)
  assert.match(migration, /'cancelled', 'assistant_thread_deleted'/)
  assert.match(migration, /delete from public\.assistant_threads/)
  assert.match(migration, /revoke all on function public\.delete_assistant_thread\(uuid, uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.delete_assistant_thread\(uuid, uuid\)[\s\S]*to service_role/)
  assert.match(databaseTypes, /delete_assistant_thread:/)
})

test("confirmed writes stay behind the kill switch and fail calmly on duplicates", () => {
  assert.match(confirm, /requireWorkspaceAssistantEnabled\(\)/)
  assert.match(store, /assistant_action_duplicate/)
  assert.match(store, /error\.code === "23505"/)
  assert.match(core, /year < 1000/)
  assert.match(core, /daysInMonth/)
  assert.match(store, /SUPPORTED_ACCOUNT_CURRENCIES/)
  assert.match(store, /getAssistantActionTarget\(supabase, "account", accountId, options\)/)
  assert.match(store, /function fieldRequiredString/)
  assert.match(store, /name: fieldRequiredString\(rawFields, "name", 240\)/)
  assert.match(store, /fullName: fieldRequiredString\(rawFields, "fullName", 240\)/)
  assert.match(store, /url\.username \|\| url\.password/)
  assert.match(core, /path\.includes\("\\\\"\)/)
  assert.match(migration, /position\(chr\(92\) in last_standard_path\) = 0/)
  assert.match(migration, /capability_id = 'create_opportunity'[\s\S]*from public\.accounts account[\s\S]*account\.archived_at is null[\s\S]*for update[\s\S]*insert into public\.opportunities/)
  assert.match(migration, /capability_id = 'create_contact'[\s\S]*from public\.accounts account[\s\S]*account\.archived_at is null[\s\S]*for update[\s\S]*insert into public\.contacts/)
})
