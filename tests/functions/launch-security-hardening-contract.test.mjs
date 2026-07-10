import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

function runNoArgumentHelper(source, name) {
  const helper = source.match(new RegExp(`export function ${name}\\(\\) \\{[\\s\\S]*?\\n\\}`))
  assert.ok(helper, `${name} helper should be present`)

  return Function(`"use strict"; ${helper[0].replace(/^export /, "")}; return ${name}();`)()
}

test("recording retention only removes storage paths scoped to the selected call", async () => {
  const migration = await read("supabase/migrations/202607100002_launch_security_hardening.sql")
  const preflight = await read("supabase/preflight/202607100002_launch_security_hardening.sql")
  const cleanup = await read("netlify/functions/retention-cleanup.ts")
  const data = await read("src/lib/supabase/salesframe-data.ts")
  const uploadIntegrity = await read("src/lib/supabase/recording-upload-integrity.ts")

  assert.match(migration, /enforce_call_recording_storage_integrity/)
  assert.match(migration, /workspace_id_from_storage_path\(new\.recording_storage_path\)[\s\S]*new\.workspace_id/)
  assert.match(migration, /call_id_from_storage_path\(new\.recording_storage_path\)[\s\S]*new\.id/)
  assert.match(migration, /old\.recording_storage_path is not null[\s\S]*new\.recording_storage_path is distinct from old\.recording_storage_path/)
  assert.match(migration, /registration\.storage_path = new\.recording_storage_path[\s\S]*for update/)
  assert.match(migration, /from storage\.objects storage_object[\s\S]*bucket_id = 'call-recordings'[\s\S]*name = new\.recording_storage_path[\s\S]*for key share/)
  assert.match(migration, /Recording object must exist before attachment/)
  assert.match(migration, /registration_cleanup_started_at is not null[\s\S]*Recording upload registration is not available/)
  assert.match(migration, /delete from public\.recording_upload_reconciliations[\s\S]*where id = registration_id/)
  assert.doesNotMatch(migration, /linked_at/)
  assert.match(migration, /is_recording_upload_registration_enforced\(\)[\s\S]*Recording upload registration is required before attachment/)
  assert.match(migration, /calls_recording_storage_path_scope_check[\s\S]*not valid/)
  assert.match(migration, /revoke update[\s\S]*on table public\.calls[\s\S]*from public, anon, authenticated/)
  assert.match(preflight, /recording_storage_path is not null[\s\S]*workspace_id_from_storage_path[\s\S]*call_id_from_storage_path/)

  assert.match(cleanup, /function isScopedRecordingPath/)
  assert.match(cleanup, /select\("id,workspace_id,recording_storage_path"\)/)
  assert.match(cleanup, /filter\(isScopedRecordingPath\)/)
  assert.match(cleanup, /retention_cleanup_path_mismatch/)
  assert.match(cleanup, /const expiredCallIds = canonicalCalls\.map/)

  assert.match(data, /const objectId = crypto\.randomUUID\(\)/)
  assert.match(data, /\.upload\(path, file,[\s\S]*upsert: false/)
  assert.doesNotMatch(data, /upsert: true/)
  assert.match(data, /if \(existingRecordingPath\)[\s\S]*already has a recording attached/)
  assert.match(data, /\.is\("recording_storage_path", null\)/)
  assert.match(data, /const currentPointerResponse = await supabase[\s\S]*select\("recording_storage_path"\)/)
  assert.match(data, /getRecordingUploadRecoveryAction\([\s\S]*uploadedPath: path/)
  assert.match(data, /recoveryAction === "remove-upload"[\s\S]*\.remove\(\[path\]\)/)
  assert.match(data, /uploaded audio was preserved to avoid data loss/)
  assert.match(uploadIntegrity, /pointer\.path === uploadedPath[\s\S]*return "linked"/)
  assert.match(uploadIntegrity, /pointer\.status === "read-failed"[\s\S]*return "preserve-upload"/)
  assert.match(uploadIntegrity, /pointer\.status === "call-missing"[\s\S]*return "remove-upload"/)
  assert.match(uploadIntegrity, /pointer\.path === null[\s\S]*return "preserve-upload"/)
  assert.match(uploadIntegrity, /pointer\.path === uploadedPath[\s\S]*return "linked"[\s\S]*return "remove-upload"/)
})

test("recording uploads are registered before storage and reconciled without exposing the ledger", async () => {
  const migration = await read("supabase/migrations/202607100002_launch_security_hardening.sql")
  const preflight = await read("supabase/preflight/202607100002_launch_security_hardening.sql")
  const cleanup = await read("netlify/functions/retention-cleanup.ts")
  const data = await read("src/lib/supabase/salesframe-data.ts")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /create table if not exists public\.recording_upload_reconciliations/)
  assert.match(migration, /storage_path text not null unique/)
  assert.match(migration, /workspace_id uuid not null[\s\S]*call_id uuid not null[\s\S]*user_id uuid not null[\s\S]*cleanup_started_at timestamptz/)
  assert.doesNotMatch(
    migration.match(/create table if not exists public\.recording_upload_reconciliations \([\s\S]*?\n\);/)?.[0] ?? "",
    /references public\.(calls|workspaces)/
  )
  assert.match(migration, /alter table public\.recording_upload_reconciliations enable row level security/)
  assert.match(migration, /revoke all[\s\S]*on table public\.recording_upload_reconciliations[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant select, insert, update, delete[\s\S]*recording_upload_reconciliations[\s\S]*to service_role/)

  assert.match(migration, /create or replace function public\.register_call_recording_upload/)
  assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/)
  assert.match(migration, /auth\.role\(\) <> 'authenticated'[\s\S]*auth\.uid\(\)/)
  assert.match(migration, /length\(target_storage_path\) not between 1 and 512/)
  assert.match(migration, /split_part\(target_storage_path, '\/', 3\) in \('\.', '\.\.'\)/)
  assert.match(migration, /recording_upload_reconciliations_path_scope_check[\s\S]*storage_path is not distinct from \([\s\S]*workspace_id::text[\s\S]*call_id::text/)
  assert.match(migration, /workspace_id_from_storage_path\(target_storage_path\)[\s\S]*target_workspace_id/)
  assert.match(migration, /call_id_from_storage_path\(target_storage_path\)[\s\S]*target_call_id/)
  assert.match(migration, /call\.workspace_id = target_workspace_id[\s\S]*call\.recording_storage_path is null/)
  assert.match(migration, /is_workspace_member_with_active_session\(target_workspace_id\)/)
  assert.match(migration, /can_access_call\(target_call_id\)/)
  assert.match(migration, /recording-workspace:[\s\S]*pg_advisory_xact_lock[\s\S]*recording-user:/)
  assert.match(migration, /pending_call_attempt_limit constant integer := 3/)
  assert.match(migration, /pending_user_attempt_limit constant integer := 12/)
  assert.match(migration, /pending_workspace_attempt_limit constant integer := 100/)
  assert.match(migration, /pending_call_attempt_count[\s\S]*registration\.workspace_id = target_workspace_id[\s\S]*registration\.call_id = target_call_id/)
  assert.match(migration, /pending_user_attempt_count[\s\S]*registration\.user_id = requesting_user_id[\s\S]*pending_user_attempt_limit/)
  assert.match(migration, /pending_workspace_attempt_count[\s\S]*registration\.workspace_id = target_workspace_id[\s\S]*pending_workspace_attempt_limit/)

  const registrationFunction = migration.match(
    /create or replace function public\.register_call_recording_upload[\s\S]*?\n\$\$;/
  )?.[0] ?? ""
  for (const counter of ["call", "user", "workspace"]) {
    const counterQuery = registrationFunction.match(
      new RegExp(`select count\\(\\*\\)::integer[\\s\\S]*?into pending_${counter}_attempt_count[\\s\\S]*?;`)
    )?.[0] ?? ""
    assert.ok(counterQuery, `pending ${counter} counter should be present`)
    assert.doesNotMatch(counterQuery, /expires_at|cleanup_started_at/)
  }
  assert.match(migration, /grant execute[\s\S]*register_call_recording_upload\(uuid, uuid, text\)[\s\S]*to authenticated/)
  assert.match(migration, /has_active_recording_upload_registration\(name\)/)
  assert.match(migration, /drop policy if exists "Workspace members can update call recordings"/)

  assert.match(migration, /create table if not exists public\.recording_upload_rollout_control/)
  assert.match(migration, /enforce_after timestamptz not null default \(now\(\) \+ interval '6 hours'\)/)
  assert.match(migration, /revoke all[\s\S]*recording_upload_rollout_control[\s\S]*public, anon, authenticated/)
  assert.match(migration, /is_recording_upload_registration_enforced/)
  assert.match(migration, /not public\.is_recording_upload_registration_enforced\(\)[\s\S]*or public\.has_active_recording_upload_registration\(name\)/)
  assert.match(migration, /create policy "Workspace members can update call recordings during rollout"[\s\S]*not public\.is_recording_upload_registration_enforced\(\)/)

  const registrationIndex = data.indexOf('supabase.rpc("register_call_recording_upload"')
  const storageUploadIndex = data.indexOf('.upload(path, file,')
  assert.ok(registrationIndex >= 0)
  assert.ok(storageUploadIndex > registrationIndex)
  assert.match(data, /registrationResponse\.error \|\| registrationResponse\.data !== true/)

  assert.match(cleanup, /recordingReconciliationBatchLimit = 50/)
  assert.match(cleanup, /recordingReconciliationMaxBatches = 4/)
  assert.match(cleanup, /recordingReconciliationStaleClaimSeconds = 15 \* 60/)
  assert.match(cleanup, /for \(let batch = 0; batch < recordingReconciliationMaxBatches; batch \+= 1\)/)
  assert.match(cleanup, /schedule: "@hourly"/)
  assert.match(cleanup, /rpc\("claim_expired_recording_upload_reconciliations"[\s\S]*batch_limit: recordingReconciliationBatchLimit[\s\S]*stale_claim_seconds: recordingReconciliationStaleClaimSeconds/)
  assert.doesNotMatch(cleanup, /from\("recording_upload_reconciliations"\)[\s\S]*\.lte\("expires_at", now\)/)
  assert.match(cleanup, /referencedRecordingPaths\.has\(registration\.storage_path\)/)
  assert.match(cleanup, /referencedReconciliationIds[\s\S]*\.delete\(\)[\s\S]*\.in\("id", referencedReconciliationIds\)/)
  assert.match(cleanup, /\.remove\(unreferencedRecordingPaths\)[\s\S]*\.delete\(\)[\s\S]*\.in\("id", unreferencedReconciliationIds\)/)
  assert.match(cleanup, /recording_reconciliation_path_mismatch[\s\S]*skippedRegistrations/)
  assert.doesNotMatch(cleanup, /logSafeEvent\([^\n]*storage_path/)

  assert.match(preflight, /from storage\.objects storage_object[\s\S]*call\.recording_storage_path = storage_object\.name[\s\S]*call\.id is null/)
  assert.match(preflight, /ROLLOUT REVIEW:[\s\S]*status = 'active'[\s\S]*recording_storage_path is null/)
  assert.match(preflight, /POST-MIGRATION OPERATOR VERIFICATION[\s\S]*recording_upload_rollout_control/)
  assert.match(preflight, /from pg_policies[\s\S]*call-recordings/)
  assert.match(types, /recording_upload_reconciliations: TableDefinition/)
  assert.match(types, /recording_upload_reconciliations: TableDefinition<[\s\S]*cleanup_started_at: string \| null/)
  assert.doesNotMatch(
    types.match(/recording_upload_reconciliations: TableDefinition<[\s\S]*?\n      >/)?.[0] ?? "",
    /linked_at/
  )
  assert.match(types, /register_call_recording_upload:[\s\S]*target_storage_path: string[\s\S]*Returns: boolean/)
  assert.match(types, /claim_expired_recording_upload_reconciliations:[\s\S]*stale_claim_seconds\?: number[\s\S]*cleanup_started_at: string/)

  assert.match(migration, /create or replace function public\.claim_expired_recording_upload_reconciliations/)
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /registration\.expires_at <= now\(\)[\s\S]*cleanup_started_at[\s\S]*make_interval\(secs => stale_claim_seconds\)/)
  assert.match(migration, /set cleanup_started_at = now\(\)/)
  assert.match(migration, /revoke all[\s\S]*claim_expired_recording_upload_reconciliations\(integer, integer\)[\s\S]*public, anon, authenticated, service_role/)
  assert.match(migration, /grant execute[\s\S]*claim_expired_recording_upload_reconciliations\(integer, integer\)[\s\S]*to service_role/)
})

test("bulk enrichment queue mutation and key ownership are server authorized", async () => {
  const migration = await read("supabase/migrations/202607100002_launch_security_hardening.sql")
  const preflight = await read("supabase/preflight/202607100002_launch_security_hardening.sql")
  const queue = await read("netlify/functions/_shared/import-enrichment.ts")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /drop policy if exists "Workspace members can create ai enrichment jobs"/)
  assert.match(migration, /drop policy if exists "Workspace members can update ai enrichment jobs"/)
  assert.match(migration, /revoke insert, update, delete[\s\S]*on table public\.ai_enrichment_jobs[\s\S]*from anon, authenticated/)
  assert.match(migration, /drop policy if exists "Workspace members can create csv import runs"/)
  assert.match(migration, /revoke insert, update, delete[\s\S]*on table public\.csv_import_runs[\s\S]*from anon, authenticated/)
  assert.match(migration, /add column if not exists server_authorized_at timestamptz/)

  assert.match(queue, /server_authorized_at: new Date\(\)\.toISOString\(\)/)
  assert.match(queue, /async function hasTrustedJobProvenance/)
  assert.match(queue, /!job\.server_authorized_at/)
  assert.match(queue, /\.eq\("workspace_id", job\.workspace_id\)[\s\S]*\.eq\("created_by_user_id", job\.created_by_user_id\)/)
  assert.match(queue, /if \(!\(await hasTrustedJobProvenance\(lockedJob, supabase\)\)\)[\s\S]*status: "skipped"/)
  assert.match(queue, /if \(job\.attempts >= job\.max_attempts\)[\s\S]*status: "failed"/)
  assert.match(queue, /jobsToInsert\.push\(\{[\s\S]*\.\.\.buildFreshEnrichmentAttemptState\(\)/)
  assert.match(queue, /retryFailedEnrichmentJobs[\s\S]*\.update\(\{[\s\S]*\.\.\.buildFreshEnrichmentAttemptState\(\)/)
  assert.match(preflight, /OPERATOR DECISION REQUIRED:[\s\S]*server_authorized_at[\s\S]*operator_review_required/)
  assert.match(preflight, /nullif\(to_jsonb\(job\) ->> 'server_authorized_at', ''\) is null/)
  assert.match(types, /server_authorized_at: string \| null/)

  const freshAttempt = runNoArgumentHelper(queue, "buildFreshEnrichmentAttemptState")
  assert.deepEqual(
    {
      attempts: freshAttempt.attempts,
      last_error: freshAttempt.last_error,
      locked_at: freshAttempt.locked_at,
      locked_by: freshAttempt.locked_by,
    },
    {
      attempts: 0,
      last_error: null,
      locked_at: null,
      locked_by: null,
    }
  )
  assert.equal(Number.isNaN(Date.parse(freshAttempt.run_after)), false)
})

test("workspace session polling is read only and live-call heartbeats are authorized", async () => {
  const migration = await read("supabase/migrations/202607100002_launch_security_hardening.sql")
  const sessionStatus = await read("netlify/functions/session-status.ts")
  const sessionActivity = await read("netlify/functions/session-activity.ts")
  const sharedSession = await read("netlify/functions/_shared/workspace-session.ts")
  const app = await read("src/App.tsx")

  assert.match(migration, /drop policy if exists "Users can create own workspace sessions"/)
  assert.match(migration, /drop policy if exists "Users can update own workspace sessions"/)
  assert.match(migration, /revoke insert, update, delete[\s\S]*on table public\.workspace_session_activity[\s\S]*from anon, authenticated/)

  assert.match(sessionStatus, /getWorkspaceSessionStatus/)
  assert.doesNotMatch(sessionStatus, /getOrCreateWorkspaceSessionStatus/)
  assert.match(sharedSession, /export async function getWorkspaceSessionStatus[\s\S]*buildWorkspaceSessionStatus/)
  assert.match(sessionActivity, /authorizeCall\(user\.id, payload\.activeCallId[\s\S]*requireActiveSession: false/)
  assert.match(sessionActivity, /activeCall\.workspace_id !== workspaceId/)
  assert.match(sessionActivity, /assertCallIsLive\(activeCall/)
  assert.match(app, /const recordVisibleActivity = \(\) => \{[\s\S]*document\.visibilityState === "visible"/)
})

test("Deepgram grants have validated sources and a durable per-user call quota", async () => {
  const migration = await read("supabase/migrations/202607100002_launch_security_hardening.sql")
  const tokenFunction = await read("netlify/functions/deepgram-token.ts")
  const cleanup = await read("netlify/functions/retention-cleanup.ts")

  assert.match(migration, /create table if not exists public\.deepgram_token_grants/)
  assert.match(migration, /create or replace function public\.claim_deepgram_token_grant/)
  assert.match(migration, /create index if not exists deepgram_token_grants_issued_at_idx[\s\S]*issued_at/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /grant execute[\s\S]*claim_deepgram_token_grant[\s\S]*to service_role/)
  assert.match(tokenFunction, /const supportedSourceKinds = new Set/)
  assert.match(tokenFunction, /deepgram_source_kind_invalid/)
  assert.match(tokenFunction, /key: `\$\{user\.id\}:\$\{call\.id\}`/)
  assert.doesNotMatch(tokenFunction, /key: `\$\{user\.id\}:\$\{call\.id\}:\$\{payload\.sourceKind/)
  assert.match(tokenFunction, /supabase\.rpc\("claim_deepgram_token_grant"/)
  assert.match(tokenFunction, /if \(!durableQuota\.data\)[\s\S]*tooManyRequests/)
  assert.match(cleanup, /deepgramGrantRetentionMs = 24 \* 60 \* 60 \* 1000/)
  assert.match(cleanup, /\.from\("deepgram_token_grants"\)[\s\S]*\.delete\(\{ count: "exact" \}\)[\s\S]*\.lt\("issued_at", expiredGrantCutoff\)/)
  assert.match(cleanup, /removedDeepgramTokenGrants: removedDeepgramTokenGrantCount \?\? 0/)
})
