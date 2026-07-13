import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

const [artifacts, store, client, shell, migration, preflight, databaseTypes] = await Promise.all([
  read("netlify/functions/_shared/assistant-artifacts.ts"),
  read("netlify/functions/_shared/assistant-store.ts"),
  read("src/lib/assistant-client.ts"),
  read("src/components/conversation-mode-shell.tsx"),
  read("supabase/migrations/202607140001_assistant_action_result_artifacts.sql"),
  read("supabase/preflight/202607140001_assistant_action_result_artifacts.sql"),
  read("src/lib/supabase/database.types.ts"),
])

test("every supported CRM mutation produces a record-bound result artifact", () => {
  for (const capability of [
    "create_account", "update_account", "archive_account",
    "create_opportunity", "update_opportunity", "archive_opportunity",
    "create_contact", "update_contact", "archive_contact",
  ]) {
    assert.match(artifacts, new RegExp(`\\b${capability}\\b`), capability)
  }

  assert.match(store, /buildAssistantProposalResultArtifact\(supabase, proposal, data\)/)
  assert.match(store, /buildAssistantActionResultArtifact\(\{/)
  assert.match(artifacts, /satisfies Record<AssistantCapabilityId/)
  assert.match(artifacts, /data: \{ records: \[artifactRecord\] \}/)
  assert.match(artifacts, /openRecordAction\(resourceType/)
  assert.match(artifacts, /archivedRecordAction\(resourceType\)/)
})

test("confirmed results are durable, idempotent, and exact-target", () => {
  assert.match(store, /rpc\("persist_assistant_action_result_artifact"/)
  assert.match(store, /getAssistantArtifactById\(supabase, artifact\.id, options\)/)
  assert.match(migration, /if auth\.role\(\) <> 'service_role'/)
  assert.match(migration, /where id = target_proposal_id[\s\S]*for update/)
  assert.match(migration, /proposal_record\.status <> 'completed'/)
  assert.match(migration, /coalesce\(target_artifact ->> 'id', ''\) <> target_proposal_id::text/)
  assert.match(migration, /action_record ->> 'recordId' <> proposal_record\.result_resource_id::text/)
  assert.match(migration, /assistant_artifact_target_is_valid/)
  assert.match(migration, /return jsonb_build_object\('artifactId', existing_artifact\.id, 'created', false\)/)
  assert.match(migration, /revoke all on function public\.persist_assistant_action_result_artifact/)
  assert.match(migration, /grant execute[\s\S]*to service_role/)
  assert.match(databaseTypes, /persist_assistant_action_result_artifact:/)
  assert.match(preflight, /proposal_id_artifact_collisions/)
})

test("a presentation failure cannot turn a completed CRM mutation into a retry", () => {
  const confirmation = store.slice(
    store.indexOf("export async function confirmAssistantProposal"),
    store.indexOf("async function buildAssistantProposalResultArtifact")
  )
  assert.match(confirmation, /const \{ data, error \} = await supabase\.rpc\("execute_assistant_action_proposal"/)
  assert.match(confirmation, /if \(artifactError\) return \{ \.\.\.asResponseRecord\(data\), artifact \}/)
  assert.match(confirmation, /catch \{[\s\S]*return data/)
  assert.doesNotMatch(confirmation, /throw artifactError/)
})

test("the client inserts the result inline and lets the seller choose when to open it", () => {
  assert.match(client, /const artifact = normalizeAssistantArtifact\(response\.artifact\)/)
  assert.match(shell, /setMessages\(\(items\) => upsertAssistantArtifact\(items, result\.artifact!\)\)/)
  assert.match(artifacts, /kind: "record"/)
  assert.match(artifacts, /status: "completed"/)
})
