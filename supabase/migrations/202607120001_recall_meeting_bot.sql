-- Additive storage and integrity model for Recall.ai meeting-bot capture.
--
-- Provider credentials, plaintext meeting URLs, and raw webhook payloads never
-- belong in browser-readable rows. All provider mutation tables are owned by
-- the service role; authenticated workspace members receive read-only access
-- to the safe session and participant projections through active-session RLS.
--
-- Rollback strategy: disable the server-side meeting-bot feature flag and leave
-- this additive schema in place. Dropping these tables or columns would erase
-- call audit/provenance data and must only happen in a separately reviewed,
-- explicitly authorised migration after retention obligations are satisfied.

set check_function_bodies = off;

alter table public.calls
  add column if not exists capture_method text not null default 'browser_one_channel';

alter table public.calls
  drop constraint if exists calls_capture_method_check;

alter table public.calls
  add constraint calls_capture_method_check
  check (
    capture_method in (
      'browser_one_channel',
      'browser_two_channel',
      'recall_meeting_bot'
    )
  );

-- Authenticated clients create the call shell before provisioning begins, but
-- only service-owned functions may assert Recall provenance. The provisioning
-- transaction below promotes the row after it creates the matching bot session.
create or replace function public.enforce_recall_capture_method_ownership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.capture_method = 'recall_meeting_bot'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Recall capture provenance is server-owned.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_recall_capture_method_ownership on public.calls;
create trigger enforce_recall_capture_method_ownership
before insert or update of capture_method on public.calls
for each row execute function public.enforce_recall_capture_method_ownership();

revoke all on function public.enforce_recall_capture_method_ownership()
  from public, anon, authenticated;

alter table public.calls
  drop constraint if exists calls_ended_reason_check;

alter table public.calls
  add constraint calls_ended_reason_check
  check (
    ended_reason in (
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
  );

alter table public.transcript_segments
  add column if not exists capture_provider text;

alter table public.transcript_segments
  drop constraint if exists transcript_segments_capture_provider_check;

alter table public.transcript_segments
  add constraint transcript_segments_capture_provider_check
  check (capture_provider is null or capture_provider in ('browser_audio', 'recall_ai'));

-- These redundant unique keys let child records carry and enforce the complete
-- parent scope, rather than trusting independently valid IDs from other calls.
alter table public.call_speakers
  add constraint call_speakers_call_id_id_key unique (call_id, id);

alter table public.transcript_segments
  add constraint transcript_segments_call_id_id_key unique (call_id, id);

-- PostgREST cannot express the predicate needed to infer the existing partial
-- provider-event index during ON CONFLICT. A standard unique index preserves
-- null-distinct legacy rows while making finalized Recall turn upserts atomic.
create unique index transcript_segments_provider_event_upsert_key
  on public.transcript_segments(
    call_id,
    audio_source_kind,
    transcription_provider,
    provider_event_id
  );

create table public.meeting_bot_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  opportunity_id uuid not null,
  call_id uuid not null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  region text not null default 'us-west-2'
    check (region = 'us-west-2'),
  platform text not null
    check (platform in ('zoom', 'google_meet', 'microsoft_teams', 'webex')),
  recall_bot_id text,
  recall_recording_id text,
  recall_transcript_id text,
  provider_absence_confirmed_at timestamptz,
  correlation_token uuid not null default gen_random_uuid(),
  client_request_id uuid not null,
  client_instance_id uuid not null,
  client_visibility text not null default 'visible'
    check (client_visibility in ('visible', 'hidden')),
  client_visibility_updated_at timestamptz not null default now(),
  status text not null default 'provisioning'
    check (
      status in (
        'provisioning',
        'joining',
        'waiting_room',
        'recording',
        'leaving',
        'processing',
        'completed',
        'failed'
      )
    ),
  provider_status text,
  provider_subcode text check (provider_subcode is null or length(provider_subcode) <= 120),
  safe_error_code text check (safe_error_code is null or length(safe_error_code) <= 120),
  started_at timestamptz not null default now(),
  joined_at timestamptz,
  recording_started_at timestamptz,
  transcript_completed_at timestamptz,
  final_transcript_watermark_ms integer
    check (final_transcript_watermark_ms is null or final_transcript_watermark_ms >= 0),
  transcript_artifact_sha256 text
    check (
      transcript_artifact_sha256 is null
      or transcript_artifact_sha256 ~ '^[0-9a-f]{64}$'
    ),
  last_heartbeat_at timestamptz not null default now(),
  disconnect_requested_at timestamptz,
  disconnect_grace_expires_at timestamptz,
  ended_at timestamptz,
  retention_expires_at timestamptz not null default (now() + interval '24 hours'),
  media_transfer_status text not null default 'pending'
    check (
      media_transfer_status in (
        'pending',
        'not_available',
        'downloading',
        'uploading',
        'verified',
        'failed'
      )
    ),
  media_storage_path text,
  media_size_bytes bigint,
  media_checksum_sha256 text,
  provider_media_deleted_at timestamptz,
  post_call_requested_at timestamptz,
  post_call_completed_at timestamptz,
  post_call_error_code text
    check (post_call_error_code is null or length(post_call_error_code) <= 120),
  post_call_attempts integer not null default 0
    check (post_call_attempts between 0 and 10),
  post_call_locked_at timestamptz,
  post_call_locked_by text
    check (post_call_locked_by is null or length(post_call_locked_by) between 1 and 160),
  processing_locked_at timestamptz,
  processing_locked_by text
    check (processing_locked_by is null or length(processing_locked_by) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id, opportunity_id, call_id, id),
  unique (call_id, id),
  unique (opportunity_id, call_id, id),
  unique (client_request_id),
  unique (correlation_token),
  foreign key (workspace_id, account_id, opportunity_id, call_id)
    references public.calls(workspace_id, account_id, opportunity_id, id)
    on delete cascade,
  foreign key (workspace_id, requested_by_user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete set null (requested_by_user_id),
  constraint meeting_bot_sessions_recall_bot_id_length_check
    check (recall_bot_id is null or length(recall_bot_id) between 1 and 200),
  constraint meeting_bot_sessions_recall_recording_id_length_check
    check (recall_recording_id is null or length(recall_recording_id) between 1 and 200),
  constraint meeting_bot_sessions_recall_transcript_id_length_check
    check (recall_transcript_id is null or length(recall_transcript_id) between 1 and 200),
  constraint meeting_bot_sessions_provider_absence_check
    check (
      provider_absence_confirmed_at is null
      or (
        recall_bot_id is null
        and status in ('completed', 'failed')
        and ended_at is not null
        and provider_absence_confirmed_at >= started_at
      )
    ),
  constraint meeting_bot_sessions_lifecycle_order_check
    check (
      (joined_at is null or joined_at >= started_at)
      and (recording_started_at is null or recording_started_at >= started_at)
      and (ended_at is null or ended_at >= started_at)
      and (status not in ('completed', 'failed') or ended_at is not null)
    ),
  constraint meeting_bot_sessions_disconnect_grace_check
    check (
      (disconnect_requested_at is null and disconnect_grace_expires_at is null)
      or (
        disconnect_requested_at is not null
        and disconnect_grace_expires_at is not null
        and disconnect_grace_expires_at >= disconnect_requested_at
        and disconnect_grace_expires_at <= disconnect_requested_at + interval '2 minutes'
      )
    ),
  constraint meeting_bot_sessions_retention_check
    check (
      retention_expires_at > created_at
      and retention_expires_at <= created_at + interval '24 hours'
    ),
  constraint meeting_bot_sessions_transcript_completion_check
    check (
      (transcript_completed_at is null or transcript_completed_at >= started_at)
      and (
        (
          final_transcript_watermark_ms is null
          and transcript_artifact_sha256 is null
        )
        or (
          transcript_completed_at is not null
          and final_transcript_watermark_ms is not null
          and transcript_artifact_sha256 is not null
        )
      )
    ),
  constraint meeting_bot_sessions_media_receipt_check
    check (
      num_nonnulls(media_storage_path, media_size_bytes, media_checksum_sha256) in (0, 3)
      and (
        media_storage_path is null
        or media_storage_path = (
          workspace_id::text || '/' || call_id::text || '/recall-' || id::text || '.mp3'
        )
      )
      and (
        media_size_bytes is null
        or media_size_bytes between 1 and 262144000
      )
      and (
        media_checksum_sha256 is null
        or media_checksum_sha256 ~ '^[0-9a-f]{64}$'
      )
      and (
        media_transfer_status <> 'verified'
        or num_nonnulls(media_storage_path, media_size_bytes, media_checksum_sha256) = 3
      )
    ),
  constraint meeting_bot_sessions_post_call_order_check
    check (
      (
        post_call_requested_at is null
        or (
          media_transfer_status = 'verified'
          and transcript_completed_at is not null
          and final_transcript_watermark_ms is not null
          and transcript_artifact_sha256 is not null
        )
      )
      and (post_call_completed_at is null or post_call_requested_at is not null)
      and (post_call_error_code is null or post_call_requested_at is not null)
      and not (post_call_completed_at is not null and post_call_error_code is not null)
      and ((post_call_locked_at is null) = (post_call_locked_by is null))
      and (post_call_completed_at is null or post_call_locked_at is null)
      and (post_call_error_code is null or post_call_locked_at is null)
      and (
        post_call_completed_at is null
        or post_call_completed_at >= post_call_requested_at
      )
    ),
  constraint meeting_bot_sessions_processing_lock_check
    check ((processing_locked_at is null) = (processing_locked_by is null))
);

create unique index meeting_bot_sessions_recall_bot_id_key
  on public.meeting_bot_sessions(recall_bot_id)
  where recall_bot_id is not null;

create unique index meeting_bot_sessions_one_active_call_idx
  on public.meeting_bot_sessions(call_id)
  where status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving');

create index meeting_bot_sessions_active_user_idx
  on public.meeting_bot_sessions(requested_by_user_id)
  where requested_by_user_id is not null
    and status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving');

create index meeting_bot_sessions_workspace_active_idx
  on public.meeting_bot_sessions(workspace_id, started_at)
  where status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving');

create index meeting_bot_sessions_recovery_idx
  on public.meeting_bot_sessions(status, disconnect_grace_expires_at, last_heartbeat_at)
  where status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving');

create index meeting_bot_sessions_media_recovery_idx
  on public.meeting_bot_sessions(media_transfer_status, retention_expires_at)
  where provider_media_deleted_at is null;

-- This append-only billing/abuse ledger intentionally has no foreign key to
-- calls or meeting_bot_sessions. A seller cannot erase rolling usage by
-- deleting a completed call after each bot finishes.
create table public.meeting_bot_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  reserved_minutes integer not null
    check (reserved_minutes between 1 and 120),
  consumed_minutes integer not null default 0
    check (consumed_minutes between 0 and 1440),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint meeting_bot_usage_finalization_check
    check (
      (finalized_at is null and consumed_minutes = 0)
      or (
        finalized_at is not null
        and finalized_at >= created_at
      )
    )
);

create index meeting_bot_usage_user_created_idx
  on public.meeting_bot_usage_ledger(requested_by_user_id, created_at desc)
  where requested_by_user_id is not null;

create index meeting_bot_usage_workspace_created_idx
  on public.meeting_bot_usage_ledger(workspace_id, created_at desc);

create or replace function public.protect_meeting_bot_parent_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removal_pending boolean := false;
begin
  if tg_table_schema <> 'public'
     or tg_table_name not in ('accounts', 'opportunities', 'calls')
     or tg_op not in ('DELETE', 'UPDATE') then
    raise exception 'Unexpected meeting-bot parent mutation guard target.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name in ('accounts', 'opportunities') then
      if not (old.archived_at is null and new.archived_at is not null) then
        return new;
      end if;
    elsif tg_table_name = 'calls' then
      if not (old.status::text <> 'archived' and new.status::text = 'archived') then
        return new;
      end if;
    end if;
  end if;

  if tg_table_name = 'accounts' then
    select exists (
      select 1
      from public.meeting_bot_sessions session
      where session.workspace_id = old.workspace_id
        and session.account_id = old.id
        and (
          session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
          or session.safe_error_code in (
            'provider_state_reconciling',
            'provider_state_reconciling_abandoned'
          )
          or (
            session.recall_bot_id is not null
            and session.provider_media_deleted_at is null
          )
        )
    ) into removal_pending;
  elsif tg_table_name = 'opportunities' then
    select exists (
      select 1
      from public.meeting_bot_sessions session
      where session.workspace_id = old.workspace_id
        and session.opportunity_id = old.id
        and (
          session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
          or session.safe_error_code in (
            'provider_state_reconciling',
            'provider_state_reconciling_abandoned'
          )
          or (
            session.recall_bot_id is not null
            and session.provider_media_deleted_at is null
          )
        )
    ) into removal_pending;
  else
    select exists (
      select 1
      from public.meeting_bot_sessions session
      where session.workspace_id = old.workspace_id
        and session.call_id = old.id
        and (
          session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
          or session.safe_error_code in (
            'provider_state_reconciling',
            'provider_state_reconciling_abandoned'
          )
          or (
            session.recall_bot_id is not null
            and session.provider_media_deleted_at is null
          )
        )
    ) into removal_pending;
  end if;

  if removal_pending then
    raise exception 'Remove or reconcile the meeting bot before deleting or archiving this record.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger protect_account_with_live_meeting_bot
before delete or update of archived_at on public.accounts
for each row execute function public.protect_meeting_bot_parent_mutation();

create trigger protect_opportunity_with_live_meeting_bot
before delete or update of archived_at on public.opportunities
for each row execute function public.protect_meeting_bot_parent_mutation();

create trigger protect_call_with_live_meeting_bot
before delete or update of status on public.calls
for each row execute function public.protect_meeting_bot_parent_mutation();

create or replace function public.settle_meeting_bot_usage_on_end()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  settled_rows integer;
  actual_minutes integer := 0;
begin
  if tg_table_schema <> 'public'
     or tg_table_name <> 'meeting_bot_sessions'
     or tg_op <> 'UPDATE'
     or old.ended_at is not null
     or new.ended_at is null then
    return new;
  end if;

  if new.recording_started_at is not null then
    actual_minutes := greatest(
      1,
      ceil(
        greatest(
          0,
          extract(epoch from (new.ended_at - new.recording_started_at))
        ) / 60.0
      )::integer
    );
  end if;

  update public.meeting_bot_usage_ledger usage
  set consumed_minutes = actual_minutes,
      finalized_at = now()
  where usage.session_id = new.id
    and usage.workspace_id = new.workspace_id
    and usage.finalized_at is null;

  get diagnostics settled_rows = row_count;
  if settled_rows <> 1 then
    raise exception 'Meeting-bot usage reservation was missing or already finalized.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger settle_meeting_bot_usage_after_end
after update of ended_at on public.meeting_bot_sessions
for each row
when (old.ended_at is null and new.ended_at is not null)
execute function public.settle_meeting_bot_usage_on_end();

alter table public.post_call_outputs
  add column if not exists source_meeting_bot_session_id uuid;

alter table public.post_call_outputs
  add column if not exists generation_result jsonb;

alter table public.post_call_outputs
  add constraint post_call_outputs_generation_result_check
  check (generation_result is null or jsonb_typeof(generation_result) = 'object');

alter table public.post_call_outputs
  add constraint post_call_outputs_meeting_bot_call_fkey
  foreign key (call_id, source_meeting_bot_session_id)
  references public.meeting_bot_sessions(call_id, id)
  on delete set null (source_meeting_bot_session_id);

create unique index post_call_outputs_source_meeting_bot_session_key
  on public.post_call_outputs(source_meeting_bot_session_id);

alter table public.next_call_briefs
  add column if not exists source_meeting_bot_session_id uuid,
  add constraint next_call_briefs_meeting_bot_previous_call_check
    check (
      source_meeting_bot_session_id is null
      or previous_call_id is not null
    );

alter table public.next_call_briefs
  add constraint next_call_briefs_meeting_bot_call_fkey
  foreign key (opportunity_id, previous_call_id, source_meeting_bot_session_id)
  references public.meeting_bot_sessions(opportunity_id, call_id, id)
  on delete set null (source_meeting_bot_session_id);

create unique index next_call_briefs_source_meeting_bot_session_key
  on public.next_call_briefs(source_meeting_bot_session_id);

create table public.meeting_bot_provisioning_private (
  session_id uuid primary key,
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  call_id uuid not null,
  encrypted_meeting_url text not null
    check (length(encrypted_meeting_url) between 1 and 8192),
  encryption_iv text not null check (length(encryption_iv) between 8 and 256),
  encryption_auth_tag text not null check (length(encryption_auth_tag) between 8 and 256),
  url_fingerprint text not null check (length(url_fingerprint) between 32 and 256),
  status text not null default 'queued'
    check (status in ('queued', 'provisioning', 'retry_wait', 'succeeded', 'failed', 'expired')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or length(locked_by) between 1 and 160),
  expires_at timestamptz not null default (now() + interval '125 seconds'),
  last_http_status integer check (last_http_status is null or last_http_status between 100 and 599),
  last_safe_error_code text
    check (last_safe_error_code is null or length(last_safe_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, account_id, opportunity_id, call_id, session_id)
    references public.meeting_bot_sessions(workspace_id, account_id, opportunity_id, call_id, id)
    on delete cascade,
  constraint meeting_bot_provisioning_attempts_check
    check (
      attempt_count >= 0
      and max_attempts = 5
      and attempt_count <= max_attempts
    ),
  constraint meeting_bot_provisioning_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '3 minutes'
    ),
  constraint meeting_bot_provisioning_lock_check
    check ((locked_at is null) = (locked_by is null))
);

create index meeting_bot_provisioning_due_idx
  on public.meeting_bot_provisioning_private(next_attempt_at, expires_at)
  where status in ('queued', 'provisioning', 'retry_wait');

create table public.meeting_bot_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  call_id uuid not null,
  session_id uuid not null,
  provider_participant_id text not null
    check (length(provider_participant_id) between 1 and 240),
  display_name text
    check (display_name is null or length(btrim(display_name)) between 1 and 240),
  platform text not null
    check (platform in ('zoom', 'google_meet', 'microsoft_teams', 'webex')),
  is_host boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  speech_started_at timestamptz,
  speech_ended_at timestamptz,
  last_spoke_at timestamptz,
  is_speaking boolean not null default false,
  call_speaker_id uuid,
  matched_contact_id uuid,
  party text not null default 'unknown'
    check (party in ('seller', 'customer', 'unknown')),
  match_provenance text not null default 'none'
    check (
      match_provenance in (
        'none',
        'automatic_email',
        'automatic_exact_name',
        'automatic_fuzzy_name',
        'seller_corrected'
      )
    ),
  match_confidence numeric(4,3)
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  matched_at timestamptz,
  corrected_by_user_id uuid references auth.users(id) on delete set null,
  correction_locked boolean not null default false,
  correction_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, provider_participant_id),
  unique (workspace_id, account_id, opportunity_id, call_id, session_id, id),
  foreign key (workspace_id, account_id, opportunity_id, call_id, session_id)
    references public.meeting_bot_sessions(workspace_id, account_id, opportunity_id, call_id, id)
    on delete cascade,
  foreign key (call_id, call_speaker_id)
    references public.call_speakers(call_id, id)
    on delete set null (call_speaker_id),
  foreign key (workspace_id, account_id, matched_contact_id)
    references public.contacts(workspace_id, account_id, id)
    on delete set null (matched_contact_id),
  constraint meeting_bot_participants_speech_order_check
    check (
      (left_at is null or joined_at is null or left_at >= joined_at)
      and (
        speech_ended_at is null
        or speech_started_at is null
        or speech_ended_at >= speech_started_at
      )
    ),
  constraint meeting_bot_participants_match_check
    check (
      (match_provenance = 'none' and match_confidence is null and matched_at is null)
      or (match_provenance <> 'none' and match_confidence is not null and matched_at is not null)
    ),
  constraint meeting_bot_participants_correction_check
    check (
      not correction_locked
      or match_provenance in ('seller_corrected', 'none')
    )
);

create index meeting_bot_participants_session_idx
  on public.meeting_bot_participants(session_id, joined_at, created_at);

create index meeting_bot_participants_contact_idx
  on public.meeting_bot_participants(matched_contact_id, call_id)
  where matched_contact_id is not null;

create index meeting_bot_participants_speaker_idx
  on public.meeting_bot_participants(call_speaker_id)
  where call_speaker_id is not null;

create or replace function public.is_valid_meeting_bot_utterances(value jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  utterance jsonb;
  start_value numeric;
  end_value numeric;
begin
  if jsonb_typeof(value) <> 'array'
     or jsonb_array_length(value) > 500
     or pg_column_size(value) > 262144 then
    return false;
  end if;

  for utterance in
    select element
    from jsonb_array_elements(value) as elements(element)
  loop
    if jsonb_typeof(utterance) <> 'object'
       or not (utterance ?& array['eventId', 'startMs', 'endMs', 'text'])
       or (utterance - 'eventId' - 'startMs' - 'endMs' - 'text') <> '{}'::jsonb
       or jsonb_typeof(utterance -> 'eventId') <> 'string'
       or jsonb_typeof(utterance -> 'startMs') <> 'number'
       or jsonb_typeof(utterance -> 'endMs') <> 'number'
       or jsonb_typeof(utterance -> 'text') <> 'string'
       or length(utterance ->> 'eventId') not between 1 and 200
       or length(btrim(utterance ->> 'text')) not between 1 and 10000 then
      return false;
    end if;

    start_value := (utterance ->> 'startMs')::numeric;
    end_value := (utterance ->> 'endMs')::numeric;
    if start_value <> trunc(start_value)
       or end_value <> trunc(end_value)
       or start_value < 0
       or end_value < start_value
       or end_value > 86400000 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.meeting_bot_turn_buffers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  call_id uuid not null,
  session_id uuid not null,
  participant_id uuid not null,
  status text not null default 'open'
    check (status in ('open', 'committing', 'committed', 'discarded')),
  utterances jsonb not null default '[]'::jsonb
    check (public.is_valid_meeting_bot_utterances(utterances)),
  buffered_text text not null default '',
  provider_event_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(provider_event_ids) = 'array'),
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= 0),
  last_utterance_at timestamptz,
  speech_ended_at timestamptz,
  commit_after timestamptz,
  committed_at timestamptz,
  committed_transcript_segment_id uuid,
  processing_locked_at timestamptz,
  processing_locked_by text
    check (processing_locked_by is null or length(processing_locked_by) between 1 and 160),
  version integer not null default 1 check (version > 0),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, account_id, opportunity_id, call_id, session_id, participant_id)
    references public.meeting_bot_participants(
      workspace_id,
      account_id,
      opportunity_id,
      call_id,
      session_id,
      id
    )
    on delete cascade,
  foreign key (call_id, committed_transcript_segment_id)
    references public.transcript_segments(call_id, id)
    on delete set null (committed_transcript_segment_id),
  constraint meeting_bot_turn_buffers_timing_check
    check (
      (end_ms is null or start_ms is null or end_ms >= start_ms)
      and (committed_at is null or status = 'committed')
    ),
  constraint meeting_bot_turn_buffers_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '24 hours'
    ),
  constraint meeting_bot_turn_buffers_lock_check
    check ((processing_locked_at is null) = (processing_locked_by is null))
);

create unique index meeting_bot_turn_buffers_one_open_participant_idx
  on public.meeting_bot_turn_buffers(session_id, participant_id)
  where status = 'open';

create index meeting_bot_turn_buffers_due_idx
  on public.meeting_bot_turn_buffers(commit_after, processing_locked_at)
  where status in ('open', 'committing');

create index meeting_bot_turn_buffers_committing_recovery_idx
  on public.meeting_bot_turn_buffers(processing_locked_at)
  where status = 'committing';

create table public.meeting_bot_webhook_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.meeting_bot_sessions(id) on delete set null,
  region text not null check (region = 'us-west-2'),
  webhook_id text not null check (length(webhook_id) between 1 and 240),
  event_type text not null check (length(event_type) between 1 and 160),
  recall_bot_id text check (recall_bot_id is null or length(recall_bot_id) between 1 and 200),
  event_timestamp timestamptz,
  payload_ciphertext text check (payload_ciphertext is null or length(payload_ciphertext) <= 1500000),
  payload_iv text check (payload_iv is null or length(payload_iv) between 8 and 256),
  payload_auth_tag text check (payload_auth_tag is null or length(payload_auth_tag) between 8 and 256),
  payload_hash text not null check (length(payload_hash) between 32 and 256),
  status text not null default 'received'
    check (status in ('received', 'queued', 'processing', 'processed', 'failed', 'expired')),
  attempts integer not null default 0,
  max_attempts integer not null default 10,
  next_attempt_at timestamptz default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or length(locked_by) between 1 and 160),
  processed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_safe_error_code text
    check (last_safe_error_code is null or length(last_safe_error_code) <= 120),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region, webhook_id),
  constraint meeting_bot_webhook_payload_check
    check (
      (
        payload_ciphertext is not null
        and payload_iv is not null
        and payload_auth_tag is not null
      )
      or (
        payload_ciphertext is null
        and payload_iv is null
        and payload_auth_tag is null
        and status in ('processed', 'expired')
      )
    ),
  constraint meeting_bot_webhook_attempts_check
    check (
      attempts >= 0
      and max_attempts between 1 and 20
      and attempts <= max_attempts
    ),
  constraint meeting_bot_webhook_expiry_check
    check (
      expires_at > received_at
      and expires_at <= received_at + interval '24 hours'
    ),
  constraint meeting_bot_webhook_lock_check
    check ((locked_at is null) = (locked_by is null))
);

create index meeting_bot_webhook_events_due_idx
  on public.meeting_bot_webhook_events(next_attempt_at, locked_at)
  where status in ('received', 'queued', 'processing', 'failed');

create index meeting_bot_webhook_events_bot_idx
  on public.meeting_bot_webhook_events(recall_bot_id, received_at)
  where recall_bot_id is not null;

drop trigger if exists set_meeting_bot_sessions_updated_at on public.meeting_bot_sessions;
create trigger set_meeting_bot_sessions_updated_at
before update on public.meeting_bot_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_meeting_bot_provisioning_updated_at on public.meeting_bot_provisioning_private;
create trigger set_meeting_bot_provisioning_updated_at
before update on public.meeting_bot_provisioning_private
for each row execute function public.set_updated_at();

drop trigger if exists set_meeting_bot_participants_updated_at on public.meeting_bot_participants;
create trigger set_meeting_bot_participants_updated_at
before update on public.meeting_bot_participants
for each row execute function public.set_updated_at();

drop trigger if exists set_meeting_bot_turn_buffers_updated_at on public.meeting_bot_turn_buffers;
create trigger set_meeting_bot_turn_buffers_updated_at
before update on public.meeting_bot_turn_buffers
for each row execute function public.set_updated_at();

drop trigger if exists set_meeting_bot_webhook_events_updated_at on public.meeting_bot_webhook_events;
create trigger set_meeting_bot_webhook_events_updated_at
before update on public.meeting_bot_webhook_events
for each row execute function public.set_updated_at();

create or replace function public.protect_meeting_bot_session_receipts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    old.transcript_completed_at is not null
    and new.transcript_completed_at is distinct from old.transcript_completed_at
  ) or (
    old.final_transcript_watermark_ms is not null
    and new.final_transcript_watermark_ms is distinct from old.final_transcript_watermark_ms
  ) or (
    old.transcript_artifact_sha256 is not null
    and new.transcript_artifact_sha256 is distinct from old.transcript_artifact_sha256
  ) or (
    old.provider_absence_confirmed_at is not null
    and new.provider_absence_confirmed_at is distinct from old.provider_absence_confirmed_at
  ) or (
    old.media_storage_path is not null
    and new.media_storage_path is distinct from old.media_storage_path
  ) or (
    old.media_size_bytes is not null
    and new.media_size_bytes is distinct from old.media_size_bytes
  ) or (
    old.media_checksum_sha256 is not null
    and new.media_checksum_sha256 is distinct from old.media_checksum_sha256
  ) then
    raise exception 'Meeting-bot transcript and media receipts are immutable once recorded.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger protect_meeting_bot_session_receipts
before update on public.meeting_bot_sessions
for each row execute function public.protect_meeting_bot_session_receipts();

create or replace function public.protect_meeting_bot_post_call_provenance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.source_meeting_bot_session_id is not null then
        raise exception 'Meeting-bot post-call provenance is server-owned.'
          using errcode = '42501';
      end if;
    elsif (
      old.source_meeting_bot_session_id is not null
      or new.source_meeting_bot_session_id is not null
    ) and new.source_meeting_bot_session_id is distinct from old.source_meeting_bot_session_id then
      raise exception 'Meeting-bot post-call provenance is server-owned.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_post_call_outputs_meeting_bot_provenance
before insert or update of source_meeting_bot_session_id on public.post_call_outputs
for each row execute function public.protect_meeting_bot_post_call_provenance();

create trigger protect_next_call_briefs_meeting_bot_provenance
before insert or update of source_meeting_bot_session_id on public.next_call_briefs
for each row execute function public.protect_meeting_bot_post_call_provenance();

create or replace function public.protect_meeting_bot_generation_result()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and old.generation_result is not null
     and new.generation_result is distinct from old.generation_result then
    raise exception 'Meeting-bot generation results are immutable once recorded.'
      using errcode = '23514';
  end if;

  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.generation_result is not null then
        raise exception 'Meeting-bot generation results are server-owned.'
          using errcode = '42501';
      end if;
    elsif (
      old.generation_result is not null
      or new.generation_result is not null
    ) and new.generation_result is distinct from old.generation_result then
      raise exception 'Meeting-bot generation results are server-owned.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_post_call_outputs_generation_result
before insert or update of generation_result on public.post_call_outputs
for each row execute function public.protect_meeting_bot_generation_result();

create or replace function public.sync_meeting_bot_participant_from_confirmed_speaker()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  correction_user_id uuid;
  correction_time timestamptz;
  participant_row public.meeting_bot_participants%rowtype;
begin
  if tg_table_schema <> 'public'
     or tg_table_name <> 'call_speakers'
     or tg_op not in ('INSERT', 'UPDATE') then
    raise exception 'Unexpected meeting-bot speaker synchronization target.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.contact_id is not distinct from new.contact_id then
    return new;
  end if;

  if tg_op = 'INSERT' and new.contact_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    correction_user_id := coalesce(new.contact_confirmed_by, auth.uid(), old.contact_confirmed_by);
  else
    correction_user_id := coalesce(new.contact_confirmed_by, auth.uid());
  end if;
  correction_time := coalesce(new.contact_confirmed_at, now());

  for participant_row in
    select participant.*
    from public.meeting_bot_participants participant
    where participant.call_speaker_id = new.id
      and participant.call_id = new.call_id
    for update
  loop
    if not exists (
      select 1
      from public.meeting_bot_sessions session
      join public.call_speakers speaker
        on speaker.call_id = session.call_id
       and speaker.id = new.id
      where session.id = participant_row.session_id
        and session.workspace_id = participant_row.workspace_id
        and session.account_id = participant_row.account_id
        and session.opportunity_id = participant_row.opportunity_id
        and session.call_id = participant_row.call_id
        and speaker.call_id = new.call_id
    ) then
      raise exception 'The meeting participant speaker scope is invalid.'
        using errcode = '23514';
    end if;

    if auth.role() = 'authenticated' and (
      auth.uid() is null
      or correction_user_id is distinct from auth.uid()
      or not exists (
        select 1
        from public.workspace_members member
        join public.workspace_session_activity session_activity
          on session_activity.workspace_id = member.workspace_id
         and session_activity.user_id = member.user_id
        where member.workspace_id = participant_row.workspace_id
          and member.user_id = auth.uid()
          and session_activity.session_key = public.current_salesframe_session_key()
          and session_activity.expired_at is null
          and session_activity.expires_at > now()
      )
    ) then
      raise exception 'An active seller workspace session is required.'
        using errcode = '42501';
    end if;

    if new.contact_id is not null and not exists (
      select 1
      from public.call_contacts call_contact
      join public.contacts contact
        on contact.workspace_id = call_contact.workspace_id
       and contact.account_id = call_contact.account_id
       and contact.id = call_contact.contact_id
      where call_contact.workspace_id = participant_row.workspace_id
        and call_contact.account_id = participant_row.account_id
        and call_contact.opportunity_id = participant_row.opportunity_id
        and call_contact.call_id = participant_row.call_id
        and call_contact.contact_id = new.contact_id
    ) then
      raise exception 'The confirmed contact is outside the meeting participant scope.'
        using errcode = '23514';
    end if;

    if new.contact_id is not null then
      update public.meeting_bot_participants participant
      set matched_contact_id = new.contact_id,
          party = 'customer',
          match_provenance = 'seller_corrected',
          match_confidence = 1,
          matched_at = correction_time,
          corrected_by_user_id = correction_user_id,
          correction_locked = true
      where participant.id = participant_row.id
        and participant.session_id = participant_row.session_id
        and participant.call_id = new.call_id
        and participant.call_speaker_id = new.id;
    else
      update public.meeting_bot_participants participant
      set matched_contact_id = null,
          party = 'unknown',
          match_provenance = 'none',
          match_confidence = null,
          matched_at = null,
          corrected_by_user_id = correction_user_id,
          correction_locked = true
      where participant.id = participant_row.id
        and participant.session_id = participant_row.session_id
        and participant.call_id = new.call_id
        and participant.call_speaker_id = new.id;
    end if;
  end loop;

  return new;
end;
$$;

create trigger sync_meeting_bot_participant_on_confirmed_speaker
after insert or update of contact_id on public.call_speakers
for each row execute function public.sync_meeting_bot_participant_from_confirmed_speaker();

create or replace function public.enforce_meeting_bot_scope_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  scope_key text;
begin
  foreach scope_key in array array[
    'id',
    'session_id',
    'workspace_id',
    'account_id',
    'opportunity_id',
    'call_id',
    'participant_id',
    'provider_participant_id',
    'requested_by_user_id',
    'client_request_id',
    'client_instance_id',
    'correlation_token',
    'platform',
    'region',
    'webhook_id',
    'event_type',
    'payload_hash',
    'created_at',
    'received_at'
  ] loop
    if tg_table_name = 'meeting_bot_webhook_events'
       and scope_key = 'session_id'
       and (
         old_row -> scope_key = 'null'::jsonb
         or new_row -> scope_key = 'null'::jsonb
       ) then
      continue;
    end if;

    if scope_key = 'requested_by_user_id'
       and new_row -> scope_key = 'null'::jsonb then
      continue;
    end if;

    if old_row ? scope_key
       and new_row ? scope_key
       and (old_row -> scope_key) is distinct from (new_row -> scope_key) then
      raise exception 'Meeting-bot record identity and scope cannot be changed.'
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

create trigger enforce_meeting_bot_sessions_scope
before update on public.meeting_bot_sessions
for each row execute function public.enforce_meeting_bot_scope_immutable();

create trigger enforce_meeting_bot_provisioning_scope
before update on public.meeting_bot_provisioning_private
for each row execute function public.enforce_meeting_bot_scope_immutable();

create trigger enforce_meeting_bot_participants_scope
before update on public.meeting_bot_participants
for each row execute function public.enforce_meeting_bot_scope_immutable();

create trigger enforce_meeting_bot_turn_buffers_scope
before update on public.meeting_bot_turn_buffers
for each row execute function public.enforce_meeting_bot_scope_immutable();

create trigger enforce_meeting_bot_webhook_events_scope
before update on public.meeting_bot_webhook_events
for each row execute function public.enforce_meeting_bot_scope_immutable();

create or replace function public.create_meeting_bot_session(
  target_call_id uuid,
  target_user_id uuid,
  target_client_request_id uuid,
  target_client_instance_id uuid,
  target_platform text,
  target_region text,
  target_url_ciphertext text,
  target_url_iv text,
  target_url_auth_tag text,
  target_url_fingerprint text,
  target_user_limit integer default 1,
  target_workspace_limit integer default 5,
  target_global_limit integer default 25,
  target_rate_window_minutes integer default 60,
  target_user_rolling_creation_limit integer default 3,
  target_workspace_rolling_creation_limit integer default 15,
  target_user_daily_bot_limit integer default 12,
  target_workspace_daily_bot_limit integer default 60,
  target_user_daily_minute_limit integer default 480,
  target_workspace_daily_minute_limit integer default 2400,
  target_reserved_bot_minutes integer default 120
)
returns setof public.meeting_bot_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_call public.calls%rowtype;
  existing_session public.meeting_bot_sessions%rowtype;
  new_session public.meeting_bot_sessions%rowtype;
  rolling_started_at timestamptz;
  daily_started_at timestamptz := now() - interval '24 hours';
  user_daily_minutes bigint;
  workspace_daily_minutes bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('salesframe_meeting_bot_capacity', 0));

  select session.*
  into existing_session
  from public.meeting_bot_sessions session
  where session.client_request_id = target_client_request_id;

  if found then
    if existing_session.call_id is distinct from target_call_id
       or existing_session.requested_by_user_id is distinct from target_user_id
       or existing_session.client_instance_id is distinct from target_client_instance_id then
      raise exception 'The meeting-bot idempotency key is already in use.'
        using errcode = '23505';
    end if;

    return next existing_session;
    return;
  end if;

  if target_region <> 'us-west-2' then
    raise exception 'The configured Recall region is not supported.'
      using errcode = '22023';
  end if;

  if target_user_limit not between 1 and 5
     or target_workspace_limit not between target_user_limit and 25
     or target_global_limit not between target_workspace_limit and 100 then
    raise exception 'Meeting-bot capacity limits are invalid.'
      using errcode = '22023';
  end if;

  if target_rate_window_minutes not between 10 and 1440
     or target_user_rolling_creation_limit not between 1 and 50
     or target_workspace_rolling_creation_limit not between target_user_rolling_creation_limit and 500
     or target_user_daily_bot_limit not between 1 and 200
     or target_workspace_daily_bot_limit not between target_user_daily_bot_limit and 5000
     or target_reserved_bot_minutes not between 1 and 120
     or target_user_daily_minute_limit not between target_reserved_bot_minutes and 1440
     or target_workspace_daily_minute_limit not between target_user_daily_minute_limit and 100000 then
    raise exception 'Meeting-bot rate and usage limits are invalid.'
      using errcode = '22023';
  end if;

  rolling_started_at := now() - make_interval(mins => target_rate_window_minutes);

  if target_platform not in ('zoom', 'google_meet', 'microsoft_teams', 'webex') then
    raise exception 'The meeting platform is not supported.'
      using errcode = '22023';
  end if;

  select call_record.*
  into target_call
  from public.calls call_record
  where call_record.id = target_call_id
  for update;

  if not found then
    raise exception 'Call was not found.' using errcode = 'P0002';
  end if;

  if target_call.status <> 'active'
     or target_call.started_at is null
     or target_call.ended_at is not null then
    raise exception 'Meeting bots can only be created for a live call.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_call.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'The user is not a member of this call workspace.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.meeting_bot_sessions session
    where session.call_id = target_call_id
      and session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
  ) then
    raise exception 'This call already has an active meeting bot.'
      using errcode = '23505';
  end if;

  if (
    select count(*)
    from public.meeting_bot_sessions session
    where session.requested_by_user_id = target_user_id
      and session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
  ) >= target_user_limit then
    raise exception 'This user already has an active meeting bot.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_usage_ledger usage
    where usage.requested_by_user_id = target_user_id
      and usage.created_at >= rolling_started_at
  ) >= target_user_rolling_creation_limit then
    raise exception 'Meeting-bot creation is temporarily limited for this user.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_usage_ledger usage
    where usage.workspace_id = target_call.workspace_id
      and usage.created_at >= rolling_started_at
  ) >= target_workspace_rolling_creation_limit then
    raise exception 'Meeting-bot creation is temporarily limited for this workspace.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_usage_ledger usage
    where usage.requested_by_user_id = target_user_id
      and usage.created_at >= daily_started_at
  ) >= target_user_daily_bot_limit then
    raise exception 'This user has reached the rolling daily meeting-bot allowance.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_usage_ledger usage
    where usage.workspace_id = target_call.workspace_id
      and usage.created_at >= daily_started_at
  ) >= target_workspace_daily_bot_limit then
    raise exception 'This workspace has reached the rolling daily meeting-bot allowance.'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(
    case
      when usage.finalized_at is null then usage.reserved_minutes
      else usage.consumed_minutes
    end
  ), 0)
  into user_daily_minutes
  from public.meeting_bot_usage_ledger usage
  where usage.requested_by_user_id = target_user_id
    and usage.created_at >= daily_started_at;

  if user_daily_minutes + target_reserved_bot_minutes > target_user_daily_minute_limit then
    raise exception 'This user has reached the rolling daily meeting-bot minute allowance.'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(
    case
      when usage.finalized_at is null then usage.reserved_minutes
      else usage.consumed_minutes
    end
  ), 0)
  into workspace_daily_minutes
  from public.meeting_bot_usage_ledger usage
  where usage.workspace_id = target_call.workspace_id
    and usage.created_at >= daily_started_at;

  if workspace_daily_minutes + target_reserved_bot_minutes > target_workspace_daily_minute_limit then
    raise exception 'This workspace has reached the rolling daily meeting-bot minute allowance.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_sessions session
    where session.workspace_id = target_call.workspace_id
      and session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
  ) >= target_workspace_limit then
    raise exception 'This workspace has reached its active meeting-bot limit.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.meeting_bot_sessions session
    where session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
  ) >= target_global_limit then
    raise exception 'Meeting-bot capacity is temporarily unavailable.'
      using errcode = 'P0001';
  end if;

  insert into public.meeting_bot_sessions (
    workspace_id,
    account_id,
    opportunity_id,
    call_id,
    requested_by_user_id,
    region,
    platform,
    client_request_id,
    client_instance_id
  ) values (
    target_call.workspace_id,
    target_call.account_id,
    target_call.opportunity_id,
    target_call.id,
    target_user_id,
    target_region,
    target_platform,
    target_client_request_id,
    target_client_instance_id
  )
  returning * into new_session;

  insert into public.meeting_bot_usage_ledger (
    session_id,
    workspace_id,
    requested_by_user_id,
    reserved_minutes,
    created_at
  ) values (
    new_session.id,
    new_session.workspace_id,
    target_user_id,
    target_reserved_bot_minutes,
    new_session.created_at
  );

  insert into public.meeting_bot_provisioning_private (
    session_id,
    workspace_id,
    account_id,
    opportunity_id,
    call_id,
    encrypted_meeting_url,
    encryption_iv,
    encryption_auth_tag,
    url_fingerprint
  ) values (
    new_session.id,
    new_session.workspace_id,
    new_session.account_id,
    new_session.opportunity_id,
    new_session.call_id,
    target_url_ciphertext,
    target_url_iv,
    target_url_auth_tag,
    target_url_fingerprint
  );

  update public.calls
  set capture_method = 'recall_meeting_bot'
  where id = target_call.id;

  return next new_session;
end;
$$;

create or replace function public.reconnect_meeting_bot_session(
  target_session_id uuid,
  target_user_id uuid,
  target_client_instance_id uuid
)
returns setof public.meeting_bot_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_session public.meeting_bot_sessions%rowtype;
  reconnected_session public.meeting_bot_sessions%rowtype;
begin
  if target_session_id is null
     or target_user_id is null
     or target_client_instance_id is null then
    raise exception 'A session, user, and client instance are required.'
      using errcode = '22023';
  end if;

  select session.*
  into existing_session
  from public.meeting_bot_sessions session
  where session.id = target_session_id
  for update;

  if not found then
    raise exception 'Meeting-bot session was not found.' using errcode = 'P0002';
  end if;

  if existing_session.requested_by_user_id is distinct from target_user_id then
    raise exception 'Only the seller who started this meeting bot can reconnect it.'
      using errcode = '42501';
  end if;

  if existing_session.ended_at is not null
     or existing_session.status not in ('provisioning', 'joining', 'waiting_room', 'recording') then
    raise exception 'This meeting-bot session is no longer live.'
      using errcode = '23514';
  end if;

  if not (
    (
      existing_session.disconnect_grace_expires_at is not null
      and existing_session.disconnect_grace_expires_at > now()
    )
    or existing_session.last_heartbeat_at <= now() - interval '20 seconds'
  ) then
    raise exception 'The existing cockpit is still connected.'
      using errcode = '23514';
  end if;

  update public.meeting_bot_sessions session
  set client_instance_id = target_client_instance_id,
      client_visibility = 'visible',
      client_visibility_updated_at = now(),
      last_heartbeat_at = now(),
      disconnect_requested_at = null,
      disconnect_grace_expires_at = null
  where session.id = existing_session.id
  returning session.* into reconnected_session;

  return next reconnected_session;
end;
$$;

create or replace function public.transition_meeting_bot_call_to_browser_capture(
  target_call_id uuid,
  target_session_id uuid,
  target_capture_method text
)
returns setof public.calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  call_record public.calls%rowtype;
  session_record public.meeting_bot_sessions%rowtype;
  updated_call public.calls%rowtype;
begin
  if target_capture_method not in ('browser_one_channel', 'browser_two_channel') then
    raise exception 'The fallback capture method is not supported.'
      using errcode = '22023';
  end if;

  select call_row.*
  into call_record
  from public.calls call_row
  where call_row.id = target_call_id
  for update;

  if not found then
    raise exception 'Call was not found.' using errcode = 'P0002';
  end if;

  select session.*
  into session_record
  from public.meeting_bot_sessions session
  where session.id = target_session_id
    and session.call_id = call_record.id
    and session.workspace_id = call_record.workspace_id
    and session.account_id = call_record.account_id
    and session.opportunity_id = call_record.opportunity_id
  for update;

  if not found then
    raise exception 'Meeting-bot session was not found for this call.'
      using errcode = 'P0002';
  end if;

  if session_record.status not in ('completed', 'failed')
     or session_record.ended_at is null
     or session_record.safe_error_code in (
       'provider_state_reconciling',
       'provider_state_reconciling_abandoned'
     ) then
    raise exception 'Meeting bot must reach a safe terminal state before browser fallback.'
      using errcode = '23514';
  end if;

  if session_record.recall_bot_id is not null then
    if session_record.provider_media_deleted_at is null then
      raise exception 'Provider bot removal has not been confirmed.'
        using errcode = '23514';
    end if;
  elsif session_record.provider_absence_confirmed_at is null
        and coalesce(session_record.safe_error_code, '') not in (
          'meeting_link_invalid',
          'meeting_not_found',
          'provider_auth_failed',
          'provider_capacity'
        ) then
    raise exception 'Provider bot absence has not been confirmed.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.meeting_bot_sessions other_session
    where other_session.call_id = call_record.id
      and other_session.id <> session_record.id
      and (
        other_session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
        or other_session.safe_error_code in (
          'provider_state_reconciling',
          'provider_state_reconciling_abandoned'
        )
        or (
          other_session.recall_bot_id is not null
          and other_session.provider_media_deleted_at is null
        )
      )
  ) then
    raise exception 'Another meeting bot still owns this call capture scope.'
      using errcode = '23514';
  end if;

  if call_record.recording_storage_path is not null
     or call_record.recording_status = 'ready'
     or session_record.media_transfer_status = 'verified' then
    raise exception 'This call already has a verified recording and cannot be reused for fallback.'
      using errcode = '23514';
  end if;

  if call_record.capture_method = target_capture_method then
    return next call_record;
    return;
  end if;

  if call_record.capture_method <> 'recall_meeting_bot' then
    raise exception 'Only a meeting-bot call can transition to browser capture.'
      using errcode = '23514';
  end if;

  update public.calls call_row
  set capture_method = target_capture_method,
      status = 'active',
      started_at = now(),
      ended_at = null,
      ended_reason = 'seller_stopped',
      duration_seconds = null,
      recording_error = null,
      recording_mime_type = null,
      recording_ready_at = null,
      recording_size_bytes = null,
      recording_status = 'none',
      recording_storage_path = null,
      recording_url = null,
      audio_preflight = '{}'::jsonb,
      audio_source_summary = '{}'::jsonb,
      guidance_readiness = '{}'::jsonb
  where call_row.id = call_record.id
    and call_row.workspace_id = call_record.workspace_id
    and call_row.capture_method = 'recall_meeting_bot'
  returning call_row.* into updated_call;

  if not found then
    raise exception 'Call capture transition could not be completed.'
      using errcode = '40001';
  end if;

  return next updated_call;
end;
$$;

create or replace function public.claim_due_meeting_bot_provisioning(
  worker_id text,
  batch_limit integer default 10,
  lease_seconds integer default 90
)
returns setof public.meeting_bot_provisioning_private
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(worker_id), '') is null
     or batch_limit not between 1 and 100
     or lease_seconds not between 15 and 300 then
    raise exception 'Invalid meeting-bot provisioning claim.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select provisioning.session_id
    from public.meeting_bot_provisioning_private provisioning
    join public.meeting_bot_sessions session
      on session.id = provisioning.session_id
    where provisioning.status in ('queued', 'provisioning', 'retry_wait')
      and provisioning.attempt_count < provisioning.max_attempts
      and provisioning.next_attempt_at <= now()
      and provisioning.expires_at > now()
      and session.status = 'provisioning'
      and (
        provisioning.locked_at is null
        or provisioning.locked_at < now() - make_interval(secs => lease_seconds)
      )
    order by provisioning.next_attempt_at, provisioning.created_at
    for update of provisioning skip locked
    limit batch_limit
  ), claimed as (
    update public.meeting_bot_provisioning_private provisioning
    set status = 'provisioning',
        attempt_count = provisioning.attempt_count + 1,
        locked_at = now(),
        locked_by = worker_id
    from candidates
    where provisioning.session_id = candidates.session_id
    returning provisioning.*
  )
  select * from claimed;
end;
$$;

create or replace function public.claim_meeting_bot_post_call(
  target_session_id uuid,
  worker_id text,
  lease_seconds integer default 300,
  force_retry boolean default false
)
returns setof public.meeting_bot_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(worker_id), '') is null
     or lease_seconds not between 30 and 900 then
    raise exception 'Invalid meeting-bot post-call claim.' using errcode = '22023';
  end if;

  return query
  update public.meeting_bot_sessions session
  set post_call_requested_at = coalesce(session.post_call_requested_at, now()),
      post_call_error_code = null,
      post_call_attempts = session.post_call_attempts + 1,
      post_call_locked_at = now(),
      post_call_locked_by = worker_id
  where session.id = target_session_id
    and session.media_transfer_status = 'verified'
    and session.provider_media_deleted_at is not null
    and session.post_call_completed_at is null
    and session.post_call_attempts < 10
    and (session.post_call_error_code is null or force_retry)
    and (
      session.post_call_locked_at is null
      or session.post_call_locked_at < now() - make_interval(secs => lease_seconds)
      or (force_retry and session.post_call_error_code is not null)
    )
  returning session.*;
end;
$$;

create or replace function public.correct_meeting_bot_participant_attribution(
  target_session_id uuid,
  target_participant_id uuid,
  target_user_id uuid,
  target_contact_id uuid,
  target_party text
)
returns setof public.meeting_bot_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  participant public.meeting_bot_participants%rowtype;
  corrected_participant public.meeting_bot_participants%rowtype;
  corrected_at timestamptz := now();
  corrected_role public.speaker_role;
begin
  if target_party is null or target_party not in ('seller', 'customer', 'unknown') then
    raise exception 'The participant party is not supported.' using errcode = '22023';
  end if;

  if target_contact_id is not null and target_party <> 'customer' then
    raise exception 'A canonical contact can only be assigned to a customer participant.'
      using errcode = '22023';
  end if;

  select participant_row.*
  into participant
  from public.meeting_bot_participants participant_row
  where participant_row.id = target_participant_id
    and participant_row.session_id = target_session_id
  for update;

  if not found then
    raise exception 'Meeting participant was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = participant.workspace_id
      and member.user_id = target_user_id
  ) or not exists (
    select 1
    from public.workspace_session_activity session_activity
    where session_activity.workspace_id = participant.workspace_id
      and session_activity.user_id = target_user_id
      and session_activity.expired_at is null
      and session_activity.expires_at > now()
  ) then
    raise exception 'An active workspace session is required.' using errcode = '42501';
  end if;

  if participant.call_speaker_id is null then
    raise exception 'The participant does not have a call speaker mapping.'
      using errcode = '23514';
  end if;

  if target_contact_id is not null then
    if not exists (
      select 1
      from public.contacts contact
      where contact.id = target_contact_id
        and contact.workspace_id = participant.workspace_id
        and contact.account_id = participant.account_id
        and contact.archived_at is null
    ) then
      raise exception 'The selected contact is not active on this account.'
        using errcode = '23514';
    end if;

    insert into public.call_contacts (
      workspace_id,
      account_id,
      opportunity_id,
      call_id,
      contact_id,
      attendance_status,
      is_primary,
      created_by_user_id
    ) values (
      participant.workspace_id,
      participant.account_id,
      participant.opportunity_id,
      participant.call_id,
      target_contact_id,
      'attended',
      false,
      target_user_id
    )
    on conflict (call_id, contact_id) do update
    set attendance_status = 'attended';
  end if;

  corrected_role := case target_party
    when 'seller' then 'seller'::public.speaker_role
    when 'customer' then 'customer'::public.speaker_role
    else 'unknown'::public.speaker_role
  end;

  update public.call_speakers
  set role = corrected_role,
      contact_id = target_contact_id,
      contact_confirmed_at = case when target_contact_id is null then null else corrected_at end,
      contact_confirmed_by = case when target_contact_id is null then null else target_user_id end
  where id = participant.call_speaker_id
    and call_id = participant.call_id;

  if not found then
    raise exception 'The participant call speaker mapping is no longer available.'
      using errcode = '23514';
  end if;

  update public.meeting_bot_participants participant_row
  set party = target_party,
      matched_contact_id = target_contact_id,
      match_provenance = 'seller_corrected',
      match_confidence = 1,
      matched_at = corrected_at,
      corrected_by_user_id = target_user_id,
      correction_locked = true
  where participant_row.id = participant.id
    and participant_row.session_id = participant.session_id
  returning participant_row.* into corrected_participant;

  return next corrected_participant;
end;
$$;

create or replace function public.claim_due_meeting_bot_turn_buffers(
  worker_id text,
  batch_limit integer default 25,
  lease_seconds integer default 30
)
returns setof public.meeting_bot_turn_buffers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(worker_id), '') is null
     or batch_limit not between 1 and 100
     or lease_seconds not between 5 and 300 then
    raise exception 'Invalid meeting-bot turn claim.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select turn_buffer.id
    from public.meeting_bot_turn_buffers turn_buffer
    where turn_buffer.status in ('open', 'committing')
      and (
        (
          turn_buffer.status = 'open'
          and turn_buffer.commit_after is not null
          and turn_buffer.commit_after <= now()
        )
        or turn_buffer.status = 'committing'
      )
      and turn_buffer.expires_at > now()
      and (
        turn_buffer.processing_locked_at is null
        or turn_buffer.processing_locked_at < now() - make_interval(secs => lease_seconds)
      )
    order by turn_buffer.commit_after, turn_buffer.created_at
    for update of turn_buffer skip locked
    limit batch_limit
  ), claimed as (
    update public.meeting_bot_turn_buffers turn_buffer
    set status = 'committing',
        processing_locked_at = now(),
        processing_locked_by = worker_id
    from candidates
    where turn_buffer.id = candidates.id
    returning turn_buffer.*
  )
  select * from claimed;
end;
$$;

create or replace function public.claim_due_meeting_bot_recovery(
  worker_id text,
  batch_limit integer default 25,
  lease_seconds integer default 90
)
returns setof public.meeting_bot_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(worker_id), '') is null
     or batch_limit not between 1 and 100
     or lease_seconds not between 15 and 300 then
    raise exception 'Invalid meeting-bot recovery claim.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select session.id
    from public.meeting_bot_sessions session
    where (
      (
        session.status in ('provisioning', 'joining', 'waiting_room', 'recording', 'leaving')
        and (
          session.status = 'leaving'
          or session.disconnect_grace_expires_at <= now()
          or (
            session.client_visibility = 'visible'
            and session.last_heartbeat_at <= now() - interval '1 minute'
          )
        )
      )
      or (
        session.status = 'provisioning'
        and session.recall_bot_id is null
        and session.safe_error_code in (
          'provider_state_reconciling',
          'provider_state_reconciling_abandoned'
        )
      )
      or (
        session.status in ('processing', 'completed', 'failed')
        and (
          (
            session.recall_bot_id is not null
            and (
              (
                session.retention_expires_at <= now()
                and session.provider_media_deleted_at is null
              )
              or session.media_transfer_status in ('pending', 'downloading', 'uploading', 'failed')
              or (
                session.media_transfer_status = 'verified'
                and session.provider_media_deleted_at is null
              )
            )
          )
          or (
            session.post_call_requested_at is not null
            and session.post_call_completed_at is null
          )
          or (
            session.media_transfer_status = 'verified'
            and session.provider_media_deleted_at is not null
            and session.post_call_completed_at is null
          )
        )
      )
    )
      and (
        session.processing_locked_at is null
        or session.processing_locked_at < now() - make_interval(secs => lease_seconds)
      )
    order by coalesce(
      session.disconnect_grace_expires_at,
      session.last_heartbeat_at,
      session.ended_at,
      session.started_at
    )
    for update of session skip locked
    limit batch_limit
  ), claimed as (
    update public.meeting_bot_sessions session
    set processing_locked_at = now(),
        processing_locked_by = worker_id
    from candidates
    where session.id = candidates.id
    returning session.*
  )
  select * from claimed;
end;
$$;

create or replace function public.claim_meeting_bot_webhook_event(
  target_region text,
  target_webhook_id text,
  worker_id text,
  lease_seconds integer default 90
)
returns setof public.meeting_bot_webhook_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(worker_id), '') is null
     or lease_seconds not between 15 and 300 then
    raise exception 'Invalid meeting-bot webhook claim.' using errcode = '22023';
  end if;

  return query
  update public.meeting_bot_webhook_events webhook
  set status = 'processing',
      attempts = webhook.attempts + 1,
      locked_at = now(),
      locked_by = worker_id
  where webhook.region = target_region
    and webhook.webhook_id = target_webhook_id
    and webhook.status in ('received', 'queued', 'processing', 'failed')
    and webhook.attempts < webhook.max_attempts
    and webhook.next_attempt_at <= now()
    and webhook.expires_at > now()
    and (
      webhook.locked_at is null
      or webhook.locked_at < now() - make_interval(secs => lease_seconds)
    )
  returning webhook.*;
end;
$$;

create or replace function public.expire_meeting_bot_private_data(
  batch_limit integer default 100
)
returns table (
  provisioning_deleted integer,
  webhook_scrubbed integer,
  turn_buffers_scrubbed integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer := 0;
  scrubbed_count integer := 0;
  turn_buffer_count integer := 0;
begin
  if batch_limit not between 1 and 500 then
    raise exception 'Invalid meeting-bot private-data cleanup batch.' using errcode = '22023';
  end if;

  with expired_provisioning as (
    select provisioning.session_id
    from public.meeting_bot_provisioning_private provisioning
    where provisioning.expires_at <= now()
    order by provisioning.expires_at
    for update of provisioning skip locked
    limit batch_limit
  ), failed_sessions as (
    update public.meeting_bot_sessions session
    set status = 'failed',
        ended_at = coalesce(session.ended_at, now()),
        provider_subcode = coalesce(session.provider_subcode, 'bot_join_timeout'),
        safe_error_code = coalesce(session.safe_error_code, 'bot_join_timeout')
    from expired_provisioning expired
    where session.id = expired.session_id
      and session.recall_bot_id is null
      and session.status = 'provisioning'
      and coalesce(session.safe_error_code, '') not in (
        'provider_state_reconciling',
        'provider_state_reconciling_abandoned'
      )
    returning session.id
  ), deleted as (
    delete from public.meeting_bot_provisioning_private provisioning
    using expired_provisioning expired
    where provisioning.session_id = expired.session_id
    returning provisioning.session_id
  )
  select count(*)::integer
  into deleted_count
  from deleted;

  with expired_webhooks as (
    select webhook.id
    from public.meeting_bot_webhook_events webhook
    where webhook.expires_at <= now()
      and webhook.payload_ciphertext is not null
    order by webhook.expires_at
    for update of webhook skip locked
    limit batch_limit
  ), scrubbed as (
    update public.meeting_bot_webhook_events webhook
    set status = 'expired',
        payload_ciphertext = null,
        payload_iv = null,
        payload_auth_tag = null,
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        processed_at = coalesce(webhook.processed_at, now())
    from expired_webhooks expired
    where webhook.id = expired.id
    returning webhook.id
  )
  select count(*)::integer
  into scrubbed_count
  from scrubbed;

  with expired_turn_buffers as (
    select turn_buffer.id
    from public.meeting_bot_turn_buffers turn_buffer
    where turn_buffer.expires_at <= now()
      and (
        turn_buffer.utterances <> '[]'::jsonb
        or
        turn_buffer.buffered_text <> ''
        or turn_buffer.provider_event_ids <> '[]'::jsonb
        or turn_buffer.status in ('open', 'committing')
      )
    order by turn_buffer.expires_at
    for update of turn_buffer skip locked
    limit batch_limit
  ), scrubbed_turn_buffers as (
    update public.meeting_bot_turn_buffers turn_buffer
    set status = case
          when turn_buffer.status in ('open', 'committing') then 'discarded'
          else turn_buffer.status
        end,
        utterances = '[]'::jsonb,
        buffered_text = '',
        provider_event_ids = '[]'::jsonb,
        processing_locked_at = null,
        processing_locked_by = null
    from expired_turn_buffers expired
    where turn_buffer.id = expired.id
    returning turn_buffer.id
  )
  select count(*)::integer
  into turn_buffer_count
  from scrubbed_turn_buffers;

  return query select deleted_count, scrubbed_count, turn_buffer_count;
end;
$$;

alter table public.meeting_bot_sessions enable row level security;
alter table public.meeting_bot_usage_ledger enable row level security;
alter table public.meeting_bot_provisioning_private enable row level security;
alter table public.meeting_bot_participants enable row level security;
alter table public.meeting_bot_turn_buffers enable row level security;
alter table public.meeting_bot_webhook_events enable row level security;

create policy "Workspace members can read meeting bot sessions"
on public.meeting_bot_sessions for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

create policy "Workspace members can read meeting bot participants"
on public.meeting_bot_participants for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

revoke all on table public.meeting_bot_sessions from public, anon, authenticated;
revoke all on table public.meeting_bot_usage_ledger from public, anon, authenticated;
revoke all on table public.meeting_bot_provisioning_private from public, anon, authenticated;
revoke all on table public.meeting_bot_participants from public, anon, authenticated;
revoke all on table public.meeting_bot_turn_buffers from public, anon, authenticated;
revoke all on table public.meeting_bot_webhook_events from public, anon, authenticated;

grant select (
  id,
  workspace_id,
  account_id,
  opportunity_id,
  call_id,
  region,
  platform,
  status,
  provider_status,
  provider_subcode,
  safe_error_code,
  started_at,
  joined_at,
  recording_started_at,
  transcript_completed_at,
  final_transcript_watermark_ms,
  ended_at,
  created_at,
  updated_at
)
  on table public.meeting_bot_sessions
  to authenticated;
grant select on table public.meeting_bot_participants to authenticated;

grant select, insert, update, delete
  on table public.meeting_bot_sessions,
           public.meeting_bot_usage_ledger,
           public.meeting_bot_provisioning_private,
           public.meeting_bot_participants,
           public.meeting_bot_turn_buffers,
           public.meeting_bot_webhook_events
  to service_role;

revoke all on function public.enforce_meeting_bot_scope_immutable() from public;
revoke all on function public.is_valid_meeting_bot_utterances(jsonb) from public, anon, authenticated;
revoke all on function public.protect_meeting_bot_parent_mutation() from public, anon, authenticated, service_role;
revoke all on function public.settle_meeting_bot_usage_on_end() from public, anon, authenticated, service_role;
revoke all on function public.protect_meeting_bot_session_receipts() from public, anon, authenticated, service_role;
revoke all on function public.protect_meeting_bot_post_call_provenance() from public, anon, authenticated;
revoke all on function public.protect_meeting_bot_generation_result() from public, anon, authenticated;
revoke all on function public.sync_meeting_bot_participant_from_confirmed_speaker() from public, anon, authenticated, service_role;
revoke all on function public.create_meeting_bot_session(uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.reconnect_meeting_bot_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.transition_meeting_bot_call_to_browser_capture(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.claim_due_meeting_bot_provisioning(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_meeting_bot_post_call(uuid, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.claim_due_meeting_bot_turn_buffers(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_due_meeting_bot_recovery(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_meeting_bot_webhook_event(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.correct_meeting_bot_participant_attribution(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.expire_meeting_bot_private_data(integer) from public, anon, authenticated;

grant execute on function public.is_valid_meeting_bot_utterances(jsonb) to service_role;
grant execute on function public.create_meeting_bot_session(uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.reconnect_meeting_bot_session(uuid, uuid, uuid) to service_role;
grant execute on function public.transition_meeting_bot_call_to_browser_capture(uuid, uuid, text) to service_role;
grant execute on function public.claim_due_meeting_bot_provisioning(text, integer, integer) to service_role;
grant execute on function public.claim_meeting_bot_post_call(uuid, text, integer, boolean) to service_role;
grant execute on function public.claim_due_meeting_bot_turn_buffers(text, integer, integer) to service_role;
grant execute on function public.claim_due_meeting_bot_recovery(text, integer, integer) to service_role;
grant execute on function public.claim_meeting_bot_webhook_event(text, text, text, integer) to service_role;
grant execute on function public.correct_meeting_bot_participant_attribution(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.expire_meeting_bot_private_data(integer) to service_role;
