import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const [
  artifactCapabilities,
  artifacts,
  store,
  shell,
  turns,
  migration,
  preflight,
  searchPreflight,
  maintenance,
] = await Promise.all([
  read("netlify/functions/_shared/assistant-artifact-capabilities.ts"),
  read("netlify/functions/_shared/assistant-artifacts.ts"),
  read("netlify/functions/_shared/assistant-store.ts"),
  read("src/components/conversation-mode-shell.tsx"),
  read("netlify/functions/assistant-turns.ts"),
  read("supabase/migrations/202607130003_conversation_mode_artifacts.sql"),
  read("supabase/preflight/202607130003_conversation_mode_artifacts.sql"),
  read("supabase/preflight/202607130003_conversation_search_indexes.maintenance.sql"),
  read("supabase/202607130003_conversation_search_indexes.maintenance.sql"),
])

test("persisted artifact actions derive behavior and risk from a server allowlist", () => {
  assert.match(artifactCapabilities, /serverAssistantArtifactCapabilities/)
  assert.match(artifactCapabilities, /throw new AppError\([\s\S]*assistant_artifact_capability_invalid/)
  assert.match(artifacts, /normalizeServerAction\(action\)/)
  assert.match(artifacts, /resolveServerAssistantArtifactCapability\(action\.capability_id \?\? ""\)/)
  assert.match(artifacts, /behavior: capability\.behavior/)
  assert.match(artifacts, /risk: capability\.risk/)
})

test("artifact hydration reauthorizes targets and disables stale actions before rendering", () => {
  const getArtifact = functionBlock(
    store,
    "export async function getAssistantArtifactById",
    "export async function queryAssistantArtifactById"
  )
  const loadHistoryArtifacts = functionBlock(
    store,
    "async function loadAssistantArtifactsForMessages",
    "async function authorizePersistedArtifactTarget"
  )
  const secureHandoff = functionBlock(
    shell,
    "const handleArtifactAction = React.useCallback",
    "const stopResponse = React.useCallback"
  )

  const reauthorizationPattern = /authorizeAssistantArtifactActionTargets|authorizePersistedArtifactTarget/
  const getReauthorizes = reauthorizationPattern.test(getArtifact)
  const historyReauthorizes = reauthorizationPattern.test(loadHistoryArtifacts)
  const staleActionsAreDisabled = /disabled/.test(getArtifact + loadHistoryArtifacts)
  const prepareIndex = secureHandoff.indexOf("client.prepareArtifactAction(artifact.id, action.id)")
  const handoffIndex = secureHandoff.indexOf('action.behavior === "secure_handoff"')
  const openReferenceIndex = secureHandoff.indexOf("prepared.capability.target")
  const everyHandoffIsPreparedServerSide =
    prepareIndex >= 0 && handoffIndex > prepareIndex && openReferenceIndex > handoffIndex

  assert.ok(
    (getReauthorizes && historyReauthorizes && staleActionsAreDisabled) || everyHandoffIsPreparedServerSide,
    "Saved actions must be reauthorized and disabled during direct/history hydration, or every handoff click must be prepared server-side."
  )
})

test("transcript excerpts are not duplicated into durable artifact snapshots", () => {
  const transcriptPresenter = blockBetween(
    artifacts,
    'if (toolName === "search_call_transcript")',
    "return null"
  )

  assert.doesNotMatch(transcriptPresenter, /row\.text/)
  assert.doesNotMatch(transcriptPresenter, /field\([^\n]*["'](?:text|excerpt|transcript)["']/i)
  assert.match(transcriptPresenter, /id: String\(row\.id\)/)
})

test("workflow steps cannot be appended to terminal proposals or bundle destructive work", () => {
  const createStep = blockBetween(
    migration,
    "create or replace function public.create_assistant_action_step(",
    "create or replace function public.upsert_assistant_task_reference("
  )

  assert.match(
    createStep,
    /proposal\.status\s+not\s+in\s*\(\s*'staged'\s*,\s*'pending'\s*\)|proposal\.status\s*<>\s*'staged'/i,
    "Terminal, cancelled, failed, completed, or expired proposals must reject new workflow steps."
  )
  assert.match(createStep, /target_risk\s*=\s*'destructive'/i)
  assert.match(
    createStep,
    /target_position\s*<>\s*0|exists\s*\([\s\S]*from public\.assistant_action_steps/i,
    "A destructive step must be the only step in its proposal."
  )
  assert.match(
    createStep,
    /proposal\.risk\s*<>\s*derived_risk|update\s+public\.assistant_action_proposals[\s\S]*set\s+risk\s*=\s*(?:derived_risk|case[\s\S]*'destructive'[\s\S]*'costed'[\s\S]*'standard')/i,
    "The seller-visible proposal risk must match the aggregate workflow risk."
  )
})

test("background task references are scoped to the originating thread", () => {
  assert.match(
    migration,
    /unique\s*\(\s*workspace_id\s*,\s*user_id\s*,\s*thread_id\s*,\s*task_type\s*,\s*task_id\s*\)/i
  )
  assert.match(
    migration,
    /on conflict\s*\(\s*workspace_id\s*,\s*user_id\s*,\s*thread_id\s*,\s*task_type\s*,\s*task_id\s*\)/i
  )
})

test("stale archived thread context cannot widen a scoped read to the workspace", () => {
  const routeAuthorization = blockBetween(
    turns,
    "async function authorizeRouteContext(",
    "function sendArtifact("
  )
  const deterministicRead = blockBetween(
    store,
    "export async function tryAssistantDeterministicRead(",
    "export async function executeAssistantReadTool("
  )

  assert.match(
    routeAuthorization,
    /archived_at|assistant_record_archived|assertAssistantContextTargetIsActive/,
    "Persisted account, opportunity, and contact context must reject archived targets before reuse."
  )
  assert.match(
    deterministicRead,
    /if\s*\(\s*intent\.scopedAccountId\s*\)[\s\S]*?if\s*\(\s*!account\s*\)\s*\{?[\s\S]*?(?:return|throw)/,
    "A supplied account scope that no longer resolves must never fall through to an unscoped workspace query."
  )
})

test("production preflight covers extension placement and interrupted concurrent indexes", () => {
  const combined = `${preflight}\n${searchPreflight}\n${maintenance}`
  assert.match(combined, /pg_extension/i)
  assert.match(combined, /pg_namespace|extnamespace/i)
  assert.match(combined, /indisvalid/i)
  assert.match(combined, /assistant_accounts_name_trgm_idx/)
  assert.match(preflight, /contacts_workspace_id_key/)
  assert.match(preflight, /complete_assistant_run_v2|assistant_artifact_target_is_valid/)
  assert.match(searchPreflight, /join\s+pg_namespace[\s\S]*nspname\s*=\s*'public'/i)
  assert.match(
    searchPreflight,
    /pg_get_indexdef\([^)]*\)\s*(?:<>|not\s+like|!~)|expected_(?:definition|index)/i,
    "A valid but differently-defined same-name index must block maintenance instead of being silently reused."
  )
})

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `Missing contract start: ${start}`)
  assert.notEqual(endIndex, -1, `Missing contract end: ${end}`)
  return source.slice(startIndex, endIndex)
}

function functionBlock(source, start, end) {
  return blockBetween(source, start, end)
}
