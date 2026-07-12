-- Read-only production preflight for 202607120001_recall_meeting_bot.sql.
-- Every non-inventory query should return zero rows. Do not automatically
-- rewrite or delete flagged records.

-- BLOCKER: Recall sessions inherit this four-ID scope. Resolve any legacy call
-- whose account does not match its opportunity before enabling meeting bots.
select
  call_row.id as call_id,
  call_row.workspace_id,
  call_row.account_id as call_account_id,
  opportunity.account_id as opportunity_account_id,
  call_row.opportunity_id,
  call_row.started_at,
  call_row.status
from public.calls call_row
join public.opportunities opportunity
  on opportunity.id = call_row.opportunity_id
 and opportunity.workspace_id = call_row.workspace_id
where call_row.account_id is distinct from opportunity.account_id
order by call_row.started_at desc nulls last, call_row.id;

-- BLOCKER: the replacement ended-reason constraint accepts every existing
-- production value plus the new provider-specific terminal reasons.
select
  id,
  workspace_id,
  ended_reason,
  status,
  started_at,
  ended_at
from public.calls
where ended_reason not in (
  'seller_stopped',
  'time_limit_reached',
  'start_cancelled',
  'start_failed',
  'meeting_ended',
  'bot_removed',
  'bot_join_failed',
  'client_disconnected',
  'provider_failed'
)
order by started_at desc nulls last, id;

-- ROLLOUT INVENTORY: existing rows predate capture_method and receive the
-- compatibility default browser_one_channel. This query is informational;
-- historical two-channel calls must not be rewritten from uncertain JSON.
select
  workspace_id,
  status,
  count(*) as existing_calls,
  min(created_at) as earliest_created_at,
  max(created_at) as latest_created_at
from public.calls
group by workspace_id, status
order by workspace_id, status;

-- ROLLOUT INVENTORY: the migration adds composite integrity and an inferable
-- provider-event upsert index to transcript storage. Review table size and run
-- the additive migration in a controlled window if this relation is large.
select
  count(*) as transcript_segment_rows,
  pg_size_pretty(pg_total_relation_size('public.transcript_segments')) as total_relation_size;

-- POST-MIGRATION OPERATOR VERIFICATION (run separately after the migration):
--
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in (
--     'meeting_bot_sessions',
--     'meeting_bot_usage_ledger',
--     'meeting_bot_provisioning_private',
--     'meeting_bot_participants',
--     'meeting_bot_turn_buffers',
--     'meeting_bot_webhook_events'
--   )
-- order by table_name, grantee, privilege_type;
--
-- The query below must return zero rows. It verifies that post-call generation
-- can only complete or expose a safe error after it has been requested, and
-- can never be both completed and failed.
-- select id, call_id, transcript_completed_at,
--        final_transcript_watermark_ms, transcript_artifact_sha256,
--        post_call_requested_at, post_call_completed_at, post_call_error_code
-- from public.meeting_bot_sessions
-- where (post_call_completed_at is not null and post_call_requested_at is null)
--    or (post_call_error_code is not null and post_call_requested_at is null)
--    or (post_call_completed_at is not null and post_call_error_code is not null)
--    or (
--      post_call_requested_at is not null
--      and (
--        transcript_completed_at is null
--        or final_transcript_watermark_ms is null
--        or transcript_artifact_sha256 is null
--      )
--    );
--
-- Verified provider audio must have one durable private-storage receipt. This
-- query must return zero rows.
-- select id, call_id, media_transfer_status, media_storage_path,
--        media_size_bytes, media_checksum_sha256
-- from public.meeting_bot_sessions
-- where media_transfer_status = 'verified'
--   and (
--     media_storage_path is null
--     or media_size_bytes is null
--     or media_checksum_sha256 is null
--   );
--
-- Every bot created through the server RPC must have one durable usage row;
-- this query must return zero rows.
-- select session.id, session.workspace_id, session.requested_by_user_id
-- from public.meeting_bot_sessions session
-- left join public.meeting_bot_usage_ledger usage
--   on usage.session_id = session.id
-- where usage.session_id is null;
--
-- These provenance checks must return zero rows. They make a crash/retry reuse
-- the output and next-call brief created for the same meeting-bot session.
-- select output.id, output.call_id, output.source_meeting_bot_session_id
-- from public.post_call_outputs output
-- join public.meeting_bot_sessions session
--   on session.id = output.source_meeting_bot_session_id
-- where output.call_id is distinct from session.call_id;
--
-- select brief.id, brief.opportunity_id, brief.previous_call_id,
--        brief.source_meeting_bot_session_id
-- from public.next_call_briefs brief
-- join public.meeting_bot_sessions session
--   on session.id = brief.source_meeting_bot_session_id
-- where brief.opportunity_id is distinct from session.opportunity_id
--    or brief.previous_call_id is distinct from session.call_id;
--
-- Automatic attribution must never masquerade as seller-confirmed Speaker Map
-- evidence. The synchronization trigger changes confirmed rows to
-- seller_corrected, so this query must return zero rows.
-- select participant.id, participant.call_id, participant.match_provenance,
--        speaker.contact_id, speaker.contact_confirmed_by
-- from public.meeting_bot_participants participant
-- join public.call_speakers speaker
--   on speaker.id = participant.call_speaker_id
--  and speaker.call_id = participant.call_id
-- where participant.match_provenance like 'automatic_%'
--   and speaker.contact_confirmed_at is not null;
--
-- The query below must also return zero rows. Authenticated users may read only
-- safe sessions and participants; all provider/private mutation remains owned
-- by the service role.
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in (
--     'meeting_bot_sessions',
--     'meeting_bot_usage_ledger',
--     'meeting_bot_provisioning_private',
--     'meeting_bot_participants',
--     'meeting_bot_turn_buffers',
--     'meeting_bot_webhook_events'
--   )
--   and grantee in ('anon', 'authenticated')
--   and not (
--     grantee = 'authenticated'
--     and privilege_type = 'SELECT'
--     and table_name = 'meeting_bot_participants'
--   );
--
-- Authenticated session access is deliberately column-scoped so lifecycle
-- ownership, provider IDs, correlation values, leases and heartbeats remain
-- server-only. This query must return zero unexpected column grants.
-- select table_name, column_name, privilege_type
-- from information_schema.role_column_grants
-- where table_schema = 'public'
--   and table_name = 'meeting_bot_sessions'
--   and grantee = 'authenticated'
--   and (
--     privilege_type <> 'SELECT'
--     or column_name not in (
--       'id', 'workspace_id', 'account_id', 'opportunity_id', 'call_id',
--       'region', 'platform', 'status', 'provider_status', 'provider_subcode',
--       'safe_error_code', 'started_at', 'joined_at',
--       'recording_started_at', 'transcript_completed_at',
--       'final_transcript_watermark_ms', 'ended_at', 'created_at', 'updated_at'
--     )
--   )
-- order by column_name, privilege_type;
