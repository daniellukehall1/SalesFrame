-- Security hardening identified during the launch-readiness audit.
--
-- This migration does not rewrite existing business rows, but it deliberately
-- narrows grants and policies after a controlled compatibility window. Run the
-- matching read-only preflight before applying it in any environment.

-- The database migration is deployed before the dependent browser bundle. Keep
-- legacy recording uploads working for a short, explicit compatibility window
-- so calls that were already open can finish. Only a privileged operator may
-- extend or shorten this deadline; authenticated clients can only ask the
-- policy helper whether registration is already mandatory.
create table if not exists public.recording_upload_rollout_control (
  singleton_id smallint primary key default 1,
  enforce_after timestamptz not null default (now() + interval '6 hours'),
  updated_at timestamptz not null default now(),
  constraint recording_upload_rollout_control_singleton_check
    check (singleton_id = 1)
);

insert into public.recording_upload_rollout_control (singleton_id)
values (1)
on conflict (singleton_id) do nothing;

alter table public.recording_upload_rollout_control enable row level security;

revoke all
  on table public.recording_upload_rollout_control
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.recording_upload_rollout_control
  to service_role;

create or replace function public.is_recording_upload_registration_enforced()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select now() >= rollout.enforce_after
      from public.recording_upload_rollout_control rollout
      where rollout.singleton_id = 1
    ),
    true
  );
$$;

revoke all
  on function public.is_recording_upload_registration_enforced()
  from public, anon, authenticated, service_role;

grant execute
  on function public.is_recording_upload_registration_enforced()
  to authenticated, service_role;

-- Register every browser recording upload before Storage accepts the object.
-- This ledger intentionally has no foreign keys: an unlinked object still
-- needs to be discoverable after its call, workspace, or user is deleted.
-- It is created before the call trigger so function creation never depends on
-- deferred relation resolution.
create table if not exists public.recording_upload_reconciliations (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  workspace_id uuid not null,
  call_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  cleanup_started_at timestamptz,
  constraint recording_upload_reconciliations_path_length_check
    check (length(storage_path) between 1 and 512),
  constraint recording_upload_reconciliations_path_scope_check
    check (
      public.workspace_id_from_storage_path(storage_path)
        is not distinct from workspace_id
      and public.call_id_from_storage_path(storage_path)
        is not distinct from call_id
      and nullif(split_part(storage_path, '/', 3), '') is not null
      and split_part(storage_path, '/', 3) not in ('.', '..')
      and split_part(storage_path, '/', 4) = ''
      and storage_path is not distinct from (
        workspace_id::text
        || '/'
        || call_id::text
        || '/'
        || split_part(storage_path, '/', 3)
      )
    ),
  constraint recording_upload_reconciliations_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '72 hours'
    )
);

create or replace function public.enforce_call_recording_storage_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registration_id uuid;
  registration_workspace_id uuid;
  registration_call_id uuid;
  registration_user_id uuid;
  registration_expires_at timestamptz;
  registration_cleanup_started_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and (
       new.id is distinct from old.id
       or new.workspace_id is distinct from old.workspace_id
     ) then
    raise exception 'Calls cannot change IDs or move between workspaces.'
      using errcode = '23514';
  end if;

  if new.recording_storage_path is not null
     and (
       public.workspace_id_from_storage_path(new.recording_storage_path)
         is distinct from new.workspace_id
       or public.call_id_from_storage_path(new.recording_storage_path)
         is distinct from new.id
       or nullif(split_part(new.recording_storage_path, '/', 3), '') is null
     ) then
    raise exception 'Recording path must match the call workspace and ID.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and auth.role() = 'authenticated'
     and old.recording_storage_path is not null
     and new.recording_storage_path is distinct from old.recording_storage_path then
    raise exception 'An attached recording path cannot be replaced or cleared by workspace members.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and auth.role() = 'authenticated'
     and new.retention_expires_at is distinct from old.retention_expires_at then
    raise exception 'Recording retention expiry cannot be changed by workspace members.'
      using errcode = '23514';
  end if;

  -- Registration is bound at the same transaction boundary as the call
  -- pointer. The row lock coordinates with orphan-cleanup claims: either this
  -- trigger consumes the registration, or cleanup marks it claimed, never both.
  if auth.role() = 'authenticated'
     and new.recording_storage_path is not null
     and (
       tg_op = 'INSERT'
       or old.recording_storage_path is null
     ) then
    perform 1
    from storage.objects storage_object
    where storage_object.bucket_id = 'call-recordings'
      and storage_object.name = new.recording_storage_path
    for key share;

    if not found then
      raise exception 'Recording object must exist before attachment.'
        using errcode = '23503';
    end if;

    select
      registration.id,
      registration.workspace_id,
      registration.call_id,
      registration.user_id,
      registration.expires_at,
      registration.cleanup_started_at
    into
      registration_id,
      registration_workspace_id,
      registration_call_id,
      registration_user_id,
      registration_expires_at,
      registration_cleanup_started_at
    from public.recording_upload_reconciliations registration
    where registration.storage_path = new.recording_storage_path
    for update;

    if found then
      if registration_workspace_id is distinct from new.workspace_id
         or registration_call_id is distinct from new.id
         or registration_user_id is distinct from auth.uid()
         or registration_expires_at <= now()
         or registration_cleanup_started_at is not null then
        raise exception 'Recording upload registration is not available for attachment.'
          using errcode = '42501';
      end if;

      -- Consume the registration in the pointer-update transaction. If any
      -- later part of the call update fails, this delete rolls back with it.
      -- Cleanup cannot claim the same row while this FOR UPDATE lock is held.
      delete from public.recording_upload_reconciliations
      where id = registration_id;
    elsif public.is_recording_upload_registration_enforced() then
      raise exception 'Recording upload registration is required before attachment.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_call_recording_storage_integrity_trigger
  on public.calls;

create trigger enforce_call_recording_storage_integrity_trigger
before insert or update of
  id,
  workspace_id,
  recording_storage_path,
  retention_expires_at
on public.calls
for each row
execute function public.enforce_call_recording_storage_integrity();

revoke all
  on function public.enforce_call_recording_storage_integrity()
  from public;

grant execute
  on function public.workspace_id_from_storage_path(text)
  to service_role;

grant execute
  on function public.call_id_from_storage_path(text)
  to service_role;

alter table public.calls
  drop constraint if exists calls_recording_storage_path_scope_check;

alter table public.calls
  add constraint calls_recording_storage_path_scope_check
  check (
    recording_storage_path is null
    or (
      public.workspace_id_from_storage_path(recording_storage_path)
        is not distinct from workspace_id
      and public.call_id_from_storage_path(recording_storage_path)
        is not distinct from id
      and nullif(split_part(recording_storage_path, '/', 3), '') is not null
    )
  ) not valid;

revoke update
  on table public.calls
  from public, anon, authenticated;

grant update (
  title,
  call_type,
  status,
  started_at,
  ended_at,
  ended_reason,
  duration_limit_seconds,
  duration_seconds,
  recording_error,
  recording_mime_type,
  recording_ready_at,
  recording_size_bytes,
  recording_status,
  recording_storage_path,
  audio_preflight,
  audio_source_summary,
  guidance_readiness
)
  on table public.calls
  to authenticated;

grant update
  on table public.calls
  to service_role;

-- Queue mutations are server-owned. Browser clients can inspect status through
-- the existing workspace-scoped read policy but cannot forge job ownership,
-- priority, retry, or lock state.
drop policy if exists "Workspace members can create ai enrichment jobs"
  on public.ai_enrichment_jobs;

drop policy if exists "Workspace members can update ai enrichment jobs"
  on public.ai_enrichment_jobs;

revoke insert, update, delete
  on table public.ai_enrichment_jobs
  from anon, authenticated;

grant select
  on table public.ai_enrichment_jobs
  to authenticated;

grant select, insert, update, delete
  on table public.ai_enrichment_jobs
  to service_role;

drop policy if exists "Workspace members can create csv import runs"
  on public.csv_import_runs;

drop policy if exists "Workspace members can update csv import runs"
  on public.csv_import_runs;

revoke insert, update, delete
  on table public.csv_import_runs
  from anon, authenticated;

grant select
  on table public.csv_import_runs
  to authenticated;

grant select, insert, update, delete
  on table public.csv_import_runs
  to service_role;

alter table public.ai_enrichment_jobs
  add column if not exists server_authorized_at timestamptz;

alter table public.ai_enrichment_jobs
  drop constraint if exists ai_enrichment_jobs_attempts_bounds_check;

alter table public.ai_enrichment_jobs
  add constraint ai_enrichment_jobs_attempts_bounds_check
  check (
    attempts >= 0
    and max_attempts between 1 and 5
    and attempts <= max_attempts
  ) not valid;

alter table public.ai_enrichment_jobs
  drop constraint if exists ai_enrichment_jobs_priority_bounds_check;

alter table public.ai_enrichment_jobs
  add constraint ai_enrichment_jobs_priority_bounds_check
  check (priority between 1 and 1000) not valid;

-- Workspace session timestamps are written only by authenticated Netlify
-- functions using the service role. Direct client mutation would make idle
-- expiry client-forgeable.
drop policy if exists "Users can create own workspace sessions"
  on public.workspace_session_activity;

drop policy if exists "Users can update own workspace sessions"
  on public.workspace_session_activity;

revoke insert, update, delete
  on table public.workspace_session_activity
  from anon, authenticated;

grant select
  on table public.workspace_session_activity
  to authenticated;

grant select, insert, update, delete
  on table public.workspace_session_activity
  to service_role;

-- Deepgram token issuance uses a durable, transactionally claimed quota. The
-- in-memory function limiter remains a first line of defense, while this table
-- prevents cold starts or multiple isolates from resetting the user/call cap.
create table if not exists public.deepgram_token_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  call_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  foreign key (workspace_id, call_id)
    references public.calls(workspace_id, id)
    on delete cascade
);

create index if not exists deepgram_token_grants_scope_issued_idx
  on public.deepgram_token_grants(user_id, call_id, issued_at desc);

-- Supports the scheduled global expiry sweep in retention-cleanup.
create index if not exists deepgram_token_grants_issued_at_idx
  on public.deepgram_token_grants(issued_at);

alter table public.deepgram_token_grants enable row level security;

revoke all
  on table public.deepgram_token_grants
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.deepgram_token_grants
  to service_role;

create or replace function public.claim_deepgram_token_grant(
  target_user_id uuid,
  target_workspace_id uuid,
  target_call_id uuid,
  grant_limit integer default 40,
  window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent_grant_count integer;
begin
  if grant_limit < 1 or grant_limit > 100
     or window_seconds < 60 or window_seconds > 3600 then
    return false;
  end if;

  if not exists (
    select 1
    from public.calls call
    join public.workspace_members member
      on member.workspace_id = call.workspace_id
     and member.user_id = target_user_id
    where call.id = target_call_id
      and call.workspace_id = target_workspace_id
      and call.status = 'active'
      and call.started_at is not null
      and call.ended_at is null
  ) then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_user_id::text || ':' || target_call_id::text, 0)
  );

  delete from public.deepgram_token_grants
  where user_id = target_user_id
    and call_id = target_call_id
    and issued_at < now() - interval '24 hours';

  select count(*)::integer
  into recent_grant_count
  from public.deepgram_token_grants
  where user_id = target_user_id
    and call_id = target_call_id
    and issued_at >= now() - make_interval(secs => window_seconds);

  if recent_grant_count >= grant_limit then
    return false;
  end if;

  insert into public.deepgram_token_grants (
    workspace_id,
    call_id,
    user_id
  ) values (
    target_workspace_id,
    target_call_id,
    target_user_id
  );

  return true;
end;
$$;

revoke all
  on function public.claim_deepgram_token_grant(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;

grant execute
  on function public.claim_deepgram_token_grant(uuid, uuid, uuid, integer, integer)
  to service_role;

alter table public.recording_upload_reconciliations
  add column if not exists cleanup_started_at timestamptz;

create index if not exists recording_upload_reconciliations_expires_idx
  on public.recording_upload_reconciliations(expires_at, created_at);

create index if not exists recording_upload_reconciliations_user_call_idx
  on public.recording_upload_reconciliations(user_id, call_id, expires_at desc);

create index if not exists recording_upload_reconciliations_user_expiry_idx
  on public.recording_upload_reconciliations(user_id, expires_at desc);

create index if not exists recording_upload_reconciliations_workspace_expiry_idx
  on public.recording_upload_reconciliations(workspace_id, expires_at desc);

alter table public.recording_upload_reconciliations enable row level security;

revoke all
  on table public.recording_upload_reconciliations
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.recording_upload_reconciliations
  to service_role;

create or replace function public.register_call_recording_upload(
  target_workspace_id uuid,
  target_call_id uuid,
  target_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requesting_user_id uuid := auth.uid();
  existing_registration public.recording_upload_reconciliations%rowtype;
  pending_call_attempt_count integer;
  pending_user_attempt_count integer;
  pending_workspace_attempt_count integer;
  pending_call_attempt_limit constant integer := 3;
  pending_user_attempt_limit constant integer := 12;
  pending_workspace_attempt_limit constant integer := 100;
begin
  if auth.role() <> 'authenticated' or requesting_user_id is null then
    return false;
  end if;

  if target_workspace_id is null
     or target_call_id is null
     or target_storage_path is null
     or length(target_storage_path) not between 1 and 512
     or public.workspace_id_from_storage_path(target_storage_path)
       is distinct from target_workspace_id
     or public.call_id_from_storage_path(target_storage_path)
       is distinct from target_call_id
     or nullif(split_part(target_storage_path, '/', 3), '') is null
     or split_part(target_storage_path, '/', 3) in ('.', '..')
     or split_part(target_storage_path, '/', 4) <> ''
     or target_storage_path is distinct from (
       target_workspace_id::text
       || '/'
       || target_call_id::text
       || '/'
       || split_part(target_storage_path, '/', 3)
     ) then
    return false;
  end if;

  if not public.is_workspace_member_with_active_session(target_workspace_id)
     or not public.can_access_call(target_call_id)
     or not exists (
       select 1
       from public.calls call
       where call.id = target_call_id
         and call.workspace_id = target_workspace_id
         and call.recording_storage_path is null
     ) then
    return false;
  end if;

  -- Every registration takes the same workspace-then-user lock order. The
  -- workspace lock serializes all three counters, preventing concurrent calls,
  -- users, or function isolates from stepping around the pending limits.
  -- Every unconsumed ledger row counts until cleanup actually deletes it, so
  -- expiry or a stalled cleanup claim cannot be used to mint more attempts.
  perform pg_advisory_xact_lock(
    hashtextextended('recording-workspace:' || target_workspace_id::text, 0)
  );

  perform pg_advisory_xact_lock(
    hashtextextended('recording-user:' || requesting_user_id::text, 0)
  );

  select registration.*
  into existing_registration
  from public.recording_upload_reconciliations registration
  where registration.storage_path = target_storage_path;

  if found then
    return existing_registration.workspace_id = target_workspace_id
      and existing_registration.call_id = target_call_id
      and existing_registration.user_id = requesting_user_id
      and existing_registration.expires_at > now()
      and existing_registration.cleanup_started_at is null;
  end if;

  select count(*)::integer
  into pending_call_attempt_count
  from public.recording_upload_reconciliations registration
  where registration.workspace_id = target_workspace_id
    and registration.call_id = target_call_id;

  if pending_call_attempt_count >= pending_call_attempt_limit then
    return false;
  end if;

  select count(*)::integer
  into pending_user_attempt_count
  from public.recording_upload_reconciliations registration
  where registration.user_id = requesting_user_id;

  if pending_user_attempt_count >= pending_user_attempt_limit then
    return false;
  end if;

  select count(*)::integer
  into pending_workspace_attempt_count
  from public.recording_upload_reconciliations registration
  where registration.workspace_id = target_workspace_id;

  if pending_workspace_attempt_count >= pending_workspace_attempt_limit then
    return false;
  end if;

  insert into public.recording_upload_reconciliations (
    storage_path,
    workspace_id,
    call_id,
    user_id
  ) values (
    target_storage_path,
    target_workspace_id,
    target_call_id,
    requesting_user_id
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all
  on function public.register_call_recording_upload(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.register_call_recording_upload(uuid, uuid, text)
  to authenticated;

create or replace function public.has_active_recording_upload_registration(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.recording_upload_reconciliations registration
      where registration.storage_path = object_name
        and registration.user_id = auth.uid()
        and registration.expires_at > now()
        and registration.cleanup_started_at is null
    );
$$;

revoke all
  on function public.has_active_recording_upload_registration(text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.has_active_recording_upload_registration(text)
  to authenticated;

-- Atomically reserve expired ambiguous registrations for reconciliation. A
-- stale claim can be retried after a bounded delay. The attach trigger locks
-- and consumes the same ledger row, so Storage deletion can never race a
-- winning call-pointer update. Referenced rows can still occur through legacy
-- or service-role workflows and are retained by the worker.
create or replace function public.claim_expired_recording_upload_reconciliations(
  batch_limit integer default 50,
  stale_claim_seconds integer default 900
)
returns table (
  id uuid,
  workspace_id uuid,
  call_id uuid,
  storage_path text,
  cleanup_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if batch_limit < 1 or batch_limit > 100
     or stale_claim_seconds < 60 or stale_claim_seconds > 86400 then
    return;
  end if;

  return query
  with claimable as (
    select registration.id
    from public.recording_upload_reconciliations registration
    where registration.expires_at <= now()
      and (
        registration.cleanup_started_at is null
        or registration.cleanup_started_at
          <= now() - make_interval(secs => stale_claim_seconds)
      )
    order by registration.expires_at asc, registration.created_at asc
    for update skip locked
    limit batch_limit
  )
  update public.recording_upload_reconciliations registration
  set cleanup_started_at = now()
  from claimable
  where registration.id = claimable.id
  returning
    registration.id,
    registration.workspace_id,
    registration.call_id,
    registration.storage_path,
    registration.cleanup_started_at;
end;
$$;

revoke all
  on function public.claim_expired_recording_upload_reconciliations(integer, integer)
  from public, anon, authenticated, service_role;

grant execute
  on function public.claim_expired_recording_upload_reconciliations(integer, integer)
  to service_role;

drop policy if exists "Workspace members can upload call recordings"
  on storage.objects;

drop policy if exists "Workspace members can upload registered call recordings"
  on storage.objects;

-- Recording objects are immutable; replacing bytes at an attached path would
-- bypass the call-pointer integrity checks.
drop policy if exists "Workspace members can update call recordings"
  on storage.objects;

drop policy if exists "Workspace members can update call recordings during rollout"
  on storage.objects;

create policy "Workspace members can upload registered call recordings"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'call-recordings'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
  and (
    not public.is_recording_upload_registration_enforced()
    or public.has_active_recording_upload_registration(name)
  )
);

-- Legacy clients used Storage upsert. This policy automatically stops
-- authorizing UPDATE when the compatibility deadline is reached; registered
-- clients use immutable INSERT keys and never rely on it.
create policy "Workspace members can update call recordings during rollout"
on storage.objects for update
to authenticated
using (
  bucket_id = 'call-recordings'
  and not public.is_recording_upload_registration_enforced()
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
)
with check (
  bucket_id = 'call-recordings'
  and not public.is_recording_upload_registration_enforced()
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);
