import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("meeting bot storage is tenant-scoped, private by default, and service-owned", async () => {
  const migration = await read("supabase/migrations/202607120001_recall_meeting_bot.sql")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /add column if not exists capture_method text not null default 'browser_one_channel'/)
  assert.match(migration, /'browser_one_channel',[\s\S]*'browser_two_channel',[\s\S]*'recall_meeting_bot'/)
  assert.match(migration, /enforce_recall_capture_method_ownership\(\)[\s\S]*new\.capture_method = 'recall_meeting_bot'[\s\S]*auth\.role\(\)[\s\S]*'service_role'/)
  assert.match(migration, /before insert or update of capture_method on public\.calls/)
  assert.match(migration, /revoke all on function public\.enforce_recall_capture_method_ownership\(\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /'meeting_ended',[\s\S]*'bot_removed',[\s\S]*'provider_failed'/)
  assert.match(migration, /add column if not exists capture_provider text/)
  assert.match(migration, /capture_provider in \('browser_audio', 'recall_ai'\)/)

  for (const table of [
    "meeting_bot_sessions",
    "meeting_bot_usage_ledger",
    "meeting_bot_provisioning_private",
    "meeting_bot_participants",
    "meeting_bot_turn_buffers",
    "meeting_bot_webhook_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(types, new RegExp(`${table}: TableDefinition<`))
  }

  assert.match(
    migration,
    /foreign key \(workspace_id, account_id, opportunity_id, call_id\)[\s\S]*references public\.calls\(workspace_id, account_id, opportunity_id, id\)/
  )
  assert.match(
    migration,
    /foreign key \(workspace_id, account_id, opportunity_id, call_id, session_id\)[\s\S]*references public\.meeting_bot_sessions/
  )
  assert.match(
    migration,
    /foreign key \(workspace_id, account_id, opportunity_id, call_id, session_id, participant_id\)[\s\S]*references public\.meeting_bot_participants/
  )
  assert.match(migration, /meeting_bot_sessions_one_active_call_idx/)
  assert.match(migration, /meeting_bot_sessions_active_user_idx/)
  assert.match(migration, /meeting_bot_sessions_one_active_call_idx[\s\S]*where status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/)
  assert.match(migration, /meeting_bot_sessions_active_user_idx[\s\S]*and status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/)
  assert.match(migration, /meeting_bot_sessions_workspace_active_idx[\s\S]*where status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/)
  assert.match(migration, /meeting_bot_sessions_recovery_idx[\s\S]*where status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/)
  assert.match(migration, /client_visibility text not null default 'visible'/)
  assert.match(migration, /client_visibility in \('visible', 'hidden'\)/)
  assert.match(migration, /session\.client_visibility = 'visible'[\s\S]*last_heartbeat_at <= now\(\) - interval '1 minute'/)
  assert.match(migration, /meeting_bot_turn_buffers_one_open_participant_idx/)
  assert.match(migration, /status in \('open', 'committing', 'committed', 'discarded'\)/)
  assert.match(migration, /utterances jsonb not null default '\[\]'::jsonb/)
  assert.match(migration, /is_valid_meeting_bot_utterances\(utterances\)/)
  assert.match(migration, /jsonb_array_length\(value\) > 500[\s\S]*pg_column_size\(value\) > 262144/)
  assert.match(migration, /utterances = '\[\]'::jsonb,[\s\S]*buffered_text = ''/)
  assert.match(types, /utterances: Json/)
  assert.match(migration, /set status = 'committing',[\s\S]*processing_locked_at = now\(\)/)
  assert.match(migration, /unique \(region, webhook_id\)/)

  assert.match(migration, /encrypted_meeting_url text not null/)
  assert.match(migration, /payload_ciphertext text/)
  assert.doesNotMatch(migration, /\n\s+meeting_url text|raw_payload jsonb|participant_email text/)
  assert.match(migration, /retention_expires_at > created_at[\s\S]*interval '24 hours'/)
  assert.match(migration, /post_call_requested_at timestamptz/)
  assert.match(migration, /post_call_completed_at timestamptz/)
  assert.match(migration, /post_call_error_code text/)
  assert.match(migration, /post_call_attempts integer not null default 0/)
  assert.match(migration, /transcript_completed_at timestamptz/)
  assert.match(migration, /final_transcript_watermark_ms integer/)
  assert.match(migration, /transcript_artifact_sha256 text[\s\S]*'\^\[0-9a-f\]\{64\}\$'/)
  assert.match(migration, /final_transcript_watermark_ms is null[\s\S]*transcript_completed_at is not null/)
  assert.match(migration, /final_transcript_watermark_ms is null[\s\S]*transcript_artifact_sha256 is null[\s\S]*final_transcript_watermark_ms is not null[\s\S]*transcript_artifact_sha256 is not null/)
  assert.match(migration, /post_call_requested_at is null[\s\S]*media_transfer_status = 'verified'[\s\S]*transcript_completed_at is not null[\s\S]*final_transcript_watermark_ms is not null[\s\S]*transcript_artifact_sha256 is not null/)
  assert.match(migration, /media_storage_path text,[\s\S]*media_size_bytes bigint,[\s\S]*media_checksum_sha256 text/)
  assert.match(migration, /num_nonnulls\(media_storage_path, media_size_bytes, media_checksum_sha256\) in \(0, 3\)/)
  assert.match(migration, /media_storage_path = \([\s\S]*workspace_id::text[\s\S]*call_id::text[\s\S]*id::text[\s\S]*'\.mp3'/)
  assert.match(migration, /media_checksum_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(migration, /protect_meeting_bot_session_receipts/)
  assert.match(migration, /not \(post_call_completed_at is not null and post_call_error_code is not null\)/)
  assert.match(migration, /add column if not exists source_meeting_bot_session_id uuid/)
  assert.match(migration, /add column if not exists generation_result jsonb/)
  assert.match(migration, /generation_result is null or jsonb_typeof\(generation_result\) = 'object'/)
  assert.match(migration, /protect_meeting_bot_generation_result\(\)[\s\S]*old\.generation_result is not null[\s\S]*new\.generation_result is distinct from old\.generation_result[\s\S]*protect_post_call_outputs_generation_result/)
  assert.match(migration, /post_call_outputs_source_meeting_bot_session_key/)
  assert.match(migration, /next_call_briefs_source_meeting_bot_session_key/)
  assert.match(migration, /protect_meeting_bot_post_call_provenance/)
  assert.match(migration, /old\.source_meeting_bot_session_id is not null[\s\S]*new\.source_meeting_bot_session_id is not null[\s\S]*new\.source_meeting_bot_session_id is distinct from old\.source_meeting_bot_session_id/)

  assert.match(migration, /Workspace members can read meeting bot sessions[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /Workspace members can read meeting bot participants[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  const authenticatedSessionGrant = migration.match(
    /grant select \([\s\S]*?on table public\.meeting_bot_sessions[\s\S]*?to authenticated;/
  )?.[0] ?? ""
  assert.ok(authenticatedSessionGrant)
  assert.doesNotMatch(
    authenticatedSessionGrant,
    /client_instance_id|client_request_id|correlation_token|recall_bot_id|processing_locked/
  )
  assert.match(migration, /revoke all on table public\.meeting_bot_provisioning_private from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.meeting_bot_usage_ledger from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.meeting_bot_turn_buffers from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.meeting_bot_webhook_events from public, anon, authenticated/)
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[\s\S]*meeting_bot_[\s\S]*to authenticated/)
  assert.match(migration, /grant select, insert, update, delete[\s\S]*meeting_bot_webhook_events[\s\S]*to service_role/)
  assert.doesNotMatch(migration, /grant update \(capture_method\)[\s\S]*to authenticated/)
})

test("meeting bot creation and recovery claims are atomic and service-role only", async () => {
  const migration = await read("supabase/migrations/202607120001_recall_meeting_bot.sql")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /create or replace function public\.create_meeting_bot_session/)
  assert.match(migration, /target_client_request_id uuid,[\s\S]*target_client_instance_id uuid/)
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('salesframe_meeting_bot_capacity'/)
  assert.match(migration, /session\.client_request_id = target_client_request_id/)
  assert.match(migration, /target_call\.status <> 'active'[\s\S]*target_call\.started_at is null[\s\S]*target_call\.ended_at is not null/)
  assert.match(migration, /member\.workspace_id = target_call\.workspace_id[\s\S]*member\.user_id = target_user_id/)
  assert.match(migration, /target_user_limit integer default 1/)
  assert.match(migration, /target_workspace_limit integer default 5/)
  assert.match(migration, /target_global_limit integer default 25/)
  assert.match(migration, /target_rate_window_minutes integer default 60/)
  assert.match(migration, /target_user_rolling_creation_limit integer default 3/)
  assert.match(migration, /target_workspace_rolling_creation_limit integer default 15/)
  assert.match(migration, /target_user_daily_bot_limit integer default 12/)
  assert.match(migration, /target_workspace_daily_bot_limit integer default 60/)
  assert.match(migration, /target_user_daily_minute_limit integer default 480/)
  assert.match(migration, /target_workspace_daily_minute_limit integer default 2400/)
  assert.match(migration, /target_reserved_bot_minutes integer default 120/)
  assert.match(migration, />= target_user_limit[\s\S]*already has an active meeting bot/)
  assert.match(migration, />= target_workspace_limit[\s\S]*active meeting-bot limit/)
  assert.match(migration, />= target_global_limit[\s\S]*capacity is temporarily unavailable/)
  const createSessionFunction = migration.match(
    /create or replace function public\.create_meeting_bot_session\([\s\S]*?\n\$\$;/
  )?.[0] ?? ""
  assert.ok(createSessionFunction)
  assert.equal(
    (createSessionFunction.match(
      /session\.status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/g
    ) ?? []).length,
    4
  )
  assert.doesNotMatch(createSessionFunction, /session\.status not in \('completed', 'failed'\)/)
  assert.match(migration, /insert into public\.meeting_bot_sessions[\s\S]*insert into public\.meeting_bot_usage_ledger[\s\S]*insert into public\.meeting_bot_provisioning_private/)
  assert.match(migration, /usage\.created_at >= rolling_started_at[\s\S]*target_user_rolling_creation_limit/)
  assert.match(migration, /usage\.created_at >= daily_started_at[\s\S]*target_user_daily_bot_limit/)
  assert.match(migration, /when usage\.finalized_at is null then usage\.reserved_minutes[\s\S]*else usage\.consumed_minutes/)
  assert.match(migration, /user_daily_minutes \+ target_reserved_bot_minutes > target_user_daily_minute_limit/)
  assert.match(migration, /workspace_daily_minutes \+ target_reserved_bot_minutes > target_workspace_daily_minute_limit/)
  assert.match(migration, /create or replace function public\.settle_meeting_bot_usage_on_end/)
  assert.match(migration, /after update of ended_at on public\.meeting_bot_sessions[\s\S]*old\.ended_at is null and new\.ended_at is not null/)
  assert.match(types, /meeting_bot_usage_ledger: TableDefinition</)
  assert.match(migration, /create or replace function public\.reconnect_meeting_bot_session/)
  assert.match(migration, /existing_session\.requested_by_user_id is distinct from target_user_id/)
  assert.match(migration, /disconnect_grace_expires_at > now\(\)[\s\S]*last_heartbeat_at <= now\(\) - interval '20 seconds'/)
  assert.match(migration, /set client_instance_id = target_client_instance_id,[\s\S]*client_visibility = 'visible',[\s\S]*last_heartbeat_at = now\(\),[\s\S]*disconnect_requested_at = null,[\s\S]*disconnect_grace_expires_at = null/)
  assert.match(migration, /grant execute on function public\.reconnect_meeting_bot_session\(uuid, uuid, uuid\) to service_role/)
  assert.match(types, /reconnect_meeting_bot_session:/)
  assert.match(migration, /create or replace function public\.transition_meeting_bot_call_to_browser_capture/)
  assert.match(migration, /target_capture_method not in \('browser_one_channel', 'browser_two_channel'\)/)
  assert.match(migration, /session_record\.status not in \('completed', 'failed'\)/)
  assert.match(migration, /session_record\.safe_error_code in \([\s\S]*'provider_state_reconciling'[\s\S]*'provider_state_reconciling_abandoned'/)
  assert.match(migration, /session_record\.recall_bot_id is not null[\s\S]*session_record\.provider_media_deleted_at is null/)
  assert.match(migration, /session_record\.provider_absence_confirmed_at is null[\s\S]*'meeting_link_invalid'[\s\S]*'provider_capacity'/)
  assert.match(migration, /call_record\.capture_method <> 'recall_meeting_bot'/)
  assert.match(migration, /call_record\.recording_storage_path is not null[\s\S]*session_record\.media_transfer_status = 'verified'/)
  assert.match(migration, /set capture_method = target_capture_method,[\s\S]*status = 'active',[\s\S]*started_at = now\(\),[\s\S]*ended_at = null,[\s\S]*ended_reason = 'seller_stopped'/)
  assert.match(migration, /recording_error = null,[\s\S]*recording_status = 'none',[\s\S]*recording_storage_path = null,[\s\S]*audio_preflight = '\{\}'::jsonb/)
  assert.match(migration, /call_row\.capture_method = 'recall_meeting_bot'/)
  assert.match(migration, /grant execute on function public\.transition_meeting_bot_call_to_browser_capture\(uuid, uuid, text\) to service_role/)
  assert.match(types, /transition_meeting_bot_call_to_browser_capture:/)

  for (const claim of [
    "claim_due_meeting_bot_provisioning",
    "claim_due_meeting_bot_turn_buffers",
    "claim_due_meeting_bot_recovery",
    "claim_meeting_bot_webhook_event",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${claim}`))
    assert.match(migration, new RegExp(`grant execute on function public\\.${claim}[\\s\\S]*to service_role`))
    assert.match(types, new RegExp(`${claim}:`))
  }

  assert.match(migration, /for update of provisioning skip locked/)
  assert.match(migration, /for update of turn_buffer skip locked/)
  assert.match(migration, /for update of session skip locked/)
  assert.match(migration, /session\.status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)[\s\S]*session\.status = 'leaving'[\s\S]*session\.disconnect_grace_expires_at <= now\(\)/)
  assert.match(migration, /session\.status = 'provisioning'[\s\S]*session\.recall_bot_id is null[\s\S]*session\.safe_error_code in \([\s\S]*'provider_state_reconciling'[\s\S]*'provider_state_reconciling_abandoned'/)
  assert.match(migration, /attempts = webhook\.attempts \+ 1/)
  assert.match(types, /client_instance_id: string/)
  assert.match(types, /post_call_requested_at: string \| null/)
  assert.match(types, /post_call_completed_at: string \| null/)
  assert.match(types, /post_call_error_code: string \| null/)
  assert.match(migration, /create or replace function public\.claim_meeting_bot_post_call/)
  assert.match(migration, /media_transfer_status = 'verified'[\s\S]*provider_media_deleted_at is not null[\s\S]*post_call_completed_at is null/)
  assert.match(migration, /create or replace function public\.correct_meeting_bot_participant_attribution/)
  assert.match(migration, /match_provenance = 'seller_corrected'[\s\S]*correction_locked = true/)
  assert.match(migration, /sync_meeting_bot_participant_from_confirmed_speaker/)
  assert.match(migration, /sync_meeting_bot_participant_from_confirmed_speaker\(\)[\s\S]*security definer[\s\S]*set search_path = public, pg_temp/)
  assert.match(migration, /tg_table_schema <> 'public'[\s\S]*tg_table_name <> 'call_speakers'/)
  assert.match(migration, /session\.workspace_id = participant_row\.workspace_id[\s\S]*session\.account_id = participant_row\.account_id[\s\S]*session\.opportunity_id = participant_row\.opportunity_id[\s\S]*session\.call_id = participant_row\.call_id/)
  assert.match(migration, /session_activity\.session_key = public\.current_salesframe_session_key\(\)[\s\S]*session_activity\.expires_at > now\(\)/)
  assert.match(migration, /call_contact\.workspace_id = participant_row\.workspace_id[\s\S]*call_contact\.account_id = participant_row\.account_id[\s\S]*call_contact\.opportunity_id = participant_row\.opportunity_id[\s\S]*call_contact\.call_id = participant_row\.call_id[\s\S]*call_contact\.contact_id = new\.contact_id/)
  assert.match(migration, /revoke all on function public\.sync_meeting_bot_participant_from_confirmed_speaker\(\) from public, anon, authenticated, service_role/)
  assert.match(migration, /new\.contact_id is not null[\s\S]*match_provenance = 'seller_corrected'/)
  assert.match(migration, /matched_contact_id = null,[\s\S]*party = 'unknown',[\s\S]*match_provenance = 'none'/)
  assert.match(migration, /create or replace function public\.expire_meeting_bot_private_data/)
  assert.match(migration, /payload_ciphertext = null[\s\S]*payload_iv = null[\s\S]*payload_auth_tag = null/)
  assert.match(migration, /coalesce\(session\.safe_error_code, ''\) not in \([\s\S]*'provider_state_reconciling'[\s\S]*'provider_state_reconciling_abandoned'/)
  assert.match(types, /transcript_completed_at: string \| null/)
  assert.match(types, /final_transcript_watermark_ms: number \| null/)
  assert.match(types, /transcript_artifact_sha256: string \| null/)
  assert.match(types, /provider_absence_confirmed_at: string \| null/)
  assert.match(types, /media_storage_path: string \| null/)
  assert.match(types, /media_size_bytes: number \| null/)
  assert.match(types, /media_checksum_sha256: string \| null/)
  assert.match(types, /generation_result: Json \| null/)
  assert.match(types, /claim_meeting_bot_post_call:/)
  assert.match(types, /correct_meeting_bot_participant_attribution:/)
  assert.match(types, /source_meeting_bot_session_id: string \| null/)
})

test("meeting bot production preflight is read-only and checks legacy integrity", async () => {
  const preflight = await read("supabase/preflight/202607120001_recall_meeting_bot.sql")

  assert.match(preflight, /call_row\.account_id is distinct from opportunity\.account_id/)
  assert.match(preflight, /ended_reason not in/)
  assert.match(preflight, /ROLLOUT INVENTORY/)
  assert.match(preflight, /post_call_requested_at[\s\S]*post_call_completed_at[\s\S]*post_call_error_code/)
  assert.match(preflight, /transcript_completed_at[\s\S]*final_transcript_watermark_ms[\s\S]*transcript_artifact_sha256/)
  assert.match(preflight, /media_storage_path[\s\S]*media_size_bytes[\s\S]*media_checksum_sha256/)
  assert.match(preflight, /meeting_bot_usage_ledger usage[\s\S]*where usage\.session_id is null/)
  assert.match(preflight, /'recording_started_at', 'transcript_completed_at',[\s\S]*'final_transcript_watermark_ms'/)
  assert.match(preflight, /meeting_bot_provisioning_private[\s\S]*meeting_bot_webhook_events/)
  assert.doesNotMatch(preflight, /^\s*(?:update|delete|insert|alter|drop|create)\s/im)
})

test("meeting bot parent deletion and archive cannot orphan a provider bot", async () => {
  const migration = await read("supabase/migrations/202607120001_recall_meeting_bot.sql")

  assert.match(migration, /create or replace function public\.protect_meeting_bot_parent_mutation\(\)[\s\S]*security definer[\s\S]*set search_path = public, pg_temp/)
  assert.match(migration, /tg_table_name not in \('accounts', 'opportunities', 'calls'\)/)
  assert.match(migration, /old\.archived_at is null and new\.archived_at is not null/)
  assert.match(migration, /old\.status::text <> 'archived' and new\.status::text = 'archived'/)
  assert.match(migration, /before delete or update of archived_at on public\.accounts/)
  assert.match(migration, /before delete or update of archived_at on public\.opportunities/)
  assert.match(migration, /before delete or update of status on public\.calls/)
  assert.match(migration, /session\.account_id = old\.id/)
  assert.match(migration, /session\.opportunity_id = old\.id/)
  assert.match(migration, /session\.call_id = old\.id/)
  assert.match(migration, /session\.status in \('provisioning', 'joining', 'waiting_room', 'recording', 'leaving'\)/)
  assert.match(migration, /session\.safe_error_code in \([\s\S]*'provider_state_reconciling'[\s\S]*'provider_state_reconciling_abandoned'/)
  assert.match(migration, /session\.recall_bot_id is not null[\s\S]*session\.provider_media_deleted_at is null/)
  assert.match(migration, /revoke all on function public\.protect_meeting_bot_parent_mutation\(\) from public, anon, authenticated, service_role/)
})
