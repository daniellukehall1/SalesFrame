-- Calm, evidence-linked opportunity preparation briefs.
--
-- Successful briefs stay readable while a separate attempt is queued or running.
-- Existing v1 JSON fields remain intact for compatibility; v2 writes normalized
-- items and sources and refreshes the legacy projection in one transaction.
-- Authenticated users receive active-session SELECT access only. All writes are
-- performed by explicitly authorized service-role functions.
--
-- Rollback: stop calling the v2 endpoints and continue reading the legacy fields.
-- This migration is additive apart from replacing the overly broad legacy RLS
-- policy. Do not drop the new audit/provenance rows as part of a rollback.

set check_function_bodies = off;

alter table public.next_call_briefs
  add column if not exists workspace_id uuid,
  add column if not exists account_id uuid,
  add column if not exists schema_version smallint not null default 1,
  add column if not exists generated_at timestamptz,
  add column if not exists completed_context_fingerprint text,
  add column if not exists applied_next_step text,
  add column if not exists applied_next_step_by uuid references auth.users(id) on delete set null,
  add column if not exists applied_next_step_at timestamptz;

update public.next_call_briefs brief
set workspace_id = opportunity.workspace_id,
    account_id = opportunity.account_id,
    generated_at = coalesce(brief.generated_at, brief.created_at)
from public.opportunities opportunity
where opportunity.id = brief.opportunity_id
  and (
    brief.workspace_id is null
    or brief.account_id is null
    or brief.generated_at is null
  );

alter table public.next_call_briefs
  alter column workspace_id set not null,
  alter column account_id set not null,
  alter column generated_at set default now(),
  alter column generated_at set not null,
  add constraint next_call_briefs_schema_version_check
    check (schema_version in (1, 2)),
  add constraint next_call_briefs_context_fingerprint_check
    check (
      completed_context_fingerprint is null
      or completed_context_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  add constraint next_call_briefs_applied_step_audit_check
    check (
      num_nonnulls(applied_next_step, applied_next_step_by, applied_next_step_at) in (0, 3)
      and (applied_next_step is null or char_length(btrim(applied_next_step)) between 1 and 2000)
    ),
  add constraint next_call_briefs_workspace_account_opportunity_id_key
    unique (workspace_id, account_id, opportunity_id, id),
  add constraint next_call_briefs_workspace_account_opportunity_fkey
    foreign key (workspace_id, account_id, opportunity_id)
    references public.opportunities(workspace_id, account_id, id)
    on delete cascade,
  add constraint next_call_briefs_workspace_account_opportunity_call_fkey
    foreign key (workspace_id, account_id, opportunity_id, previous_call_id)
    references public.calls(workspace_id, account_id, opportunity_id, id)
    on delete set null (previous_call_id)
    not valid;

alter table public.next_call_briefs
  validate constraint next_call_briefs_workspace_account_opportunity_call_fkey;

create unique index next_call_briefs_v2_source_call_key
  on public.next_call_briefs(opportunity_id, previous_call_id)
  where schema_version = 2 and previous_call_id is not null;

create index next_call_briefs_workspace_opportunity_updated_idx
  on public.next_call_briefs(workspace_id, opportunity_id, updated_at desc);

create table public.next_call_brief_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  source_call_id uuid not null,
  brief_id uuid,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  client_request_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  pending_context_fingerprint text not null
    check (pending_context_fingerprint ~ '^[0-9a-f]{64}$'),
  safe_error_code text check (
    safe_error_code is null
    or safe_error_code ~ '^[a-z0-9_]{1,120}$'
  ),
  worker_locked_at timestamptz,
  worker_locked_by text check (
    worker_locked_by is null
    or char_length(worker_locked_by) between 1 and 160
  ),
  dispatch_locked_at timestamptz,
  dispatch_locked_by text check (
    dispatch_locked_by is null
    or char_length(dispatch_locked_by) between 1 and 160
  ),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id, opportunity_id, source_call_id, id),
  unique (workspace_id, client_request_id),
  foreign key (workspace_id, account_id, opportunity_id)
    references public.opportunities(workspace_id, account_id, id)
    on delete cascade,
  foreign key (workspace_id, account_id, opportunity_id, source_call_id)
    references public.calls(workspace_id, account_id, opportunity_id, id)
    on delete cascade,
  foreign key (workspace_id, account_id, opportunity_id, brief_id)
    references public.next_call_briefs(workspace_id, account_id, opportunity_id, id)
    on delete set null (brief_id),
  constraint next_call_brief_attempts_lock_check
    check ((worker_locked_at is null) = (worker_locked_by is null)),
  constraint next_call_brief_attempts_dispatch_lock_check
    check ((dispatch_locked_at is null) = (dispatch_locked_by is null)),
  constraint next_call_brief_attempts_lifecycle_check
    check (
      (status <> 'queued' or (started_at is null and completed_at is null and safe_error_code is null))
      and (status <> 'processing' or (started_at is not null and completed_at is null and safe_error_code is null))
      and (status <> 'completed' or (started_at is not null and completed_at is not null and brief_id is not null and safe_error_code is null))
      and (status <> 'failed' or (completed_at is not null and safe_error_code is not null and brief_id is null))
    )
);

create unique index next_call_brief_attempts_one_active_opportunity_idx
  on public.next_call_brief_attempts(opportunity_id)
  where status in ('queued', 'processing');

create index next_call_brief_attempts_opportunity_created_idx
  on public.next_call_brief_attempts(opportunity_id, created_at desc);

create index next_call_brief_attempts_recovery_idx
  on public.next_call_brief_attempts(worker_locked_at)
  where status = 'processing';

create index next_call_brief_attempts_dispatch_idx
  on public.next_call_brief_attempts(dispatch_locked_at, created_at)
  where status in ('queued', 'processing');

create table public.next_call_brief_refresh_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, client_request_id),
  foreign key (workspace_id, account_id, opportunity_id)
    references public.opportunities(workspace_id, account_id, id)
    on delete cascade
);

create index next_call_brief_refresh_requests_rate_idx
  on public.next_call_brief_refresh_requests(
    requested_by_user_id,
    opportunity_id,
    created_at desc
  );

create table public.next_call_brief_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  brief_id uuid not null,
  kind text not null check (kind in ('opening', 'question', 'watch')),
  position smallint not null,
  text text not null check (char_length(btrim(text)) between 1 and 1200),
  intent_cluster_id text check (
    intent_cluster_id is null
    or intent_cluster_id ~ '^[a-z0-9_]{1,120}$'
  ),
  related_playbook_field_id uuid references public.playbook_fields(id) on delete set null,
  learning_target text check (
    learning_target is null
    or char_length(btrim(learning_target)) between 1 and 240
  ),
  why_it_matters text check (
    why_it_matters is null
    or char_length(btrim(why_it_matters)) between 1 and 800
  ),
  suggested_response text check (
    suggested_response is null
    or char_length(btrim(suggested_response)) between 1 and 800
  ),
  basis text not null check (
    basis in ('transcript', 'methodology_gap', 'seller_context', 'inference')
  ),
  needs_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id, opportunity_id, brief_id, id),
  unique (brief_id, kind, position),
  foreign key (workspace_id, account_id, opportunity_id, brief_id)
    references public.next_call_briefs(workspace_id, account_id, opportunity_id, id)
    on delete cascade,
  constraint next_call_brief_items_position_check
    check (
      (kind = 'opening' and position = 1)
      or (kind = 'question' and position between 1 and 3)
      or (kind = 'watch' and position between 1 and 2)
    ),
  constraint next_call_brief_items_kind_shape_check
    check (
      (kind <> 'question' or learning_target is not null)
      and (
        kind <> 'watch'
        or (why_it_matters is not null and suggested_response is not null)
      )
      and (basis <> 'inference' or needs_confirmation)
    )
);

alter table public.call_notes
  add constraint call_notes_call_id_id_key unique (call_id, id);

alter table public.transcript_segments
  add constraint transcript_segments_call_id_speaker_id_fkey
  foreign key (call_id, speaker_id)
  references public.call_speakers(call_id, id)
  on delete set null (speaker_id)
  not valid;

alter table public.transcript_segments
  validate constraint transcript_segments_call_id_speaker_id_fkey;

alter table public.opportunity_field_evidence
  add constraint opportunity_field_evidence_opportunity_id_id_key
  unique (opportunity_id, id);

create table public.next_call_brief_item_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid not null,
  brief_id uuid not null,
  item_id uuid not null,
  position smallint not null check (position between 1 and 3),
  source_kind text not null
    check (source_kind in ('transcript_segment', 'call_note', 'opportunity_field_evidence')),
  source_call_id uuid,
  transcript_segment_id uuid,
  call_note_id uuid,
  opportunity_field_evidence_id uuid,
  created_at timestamptz not null default now(),
  unique (item_id, position),
  foreign key (workspace_id, account_id, opportunity_id, brief_id, item_id)
    references public.next_call_brief_items(
      workspace_id,
      account_id,
      opportunity_id,
      brief_id,
      id
    )
    on delete cascade,
  foreign key (workspace_id, account_id, opportunity_id, source_call_id)
    references public.calls(workspace_id, account_id, opportunity_id, id)
    on delete no action,
  foreign key (source_call_id, transcript_segment_id)
    references public.transcript_segments(call_id, id)
    on delete set null (transcript_segment_id),
  foreign key (source_call_id, call_note_id)
    references public.call_notes(call_id, id)
    on delete set null (call_note_id),
  foreign key (opportunity_id, opportunity_field_evidence_id)
    references public.opportunity_field_evidence(opportunity_id, id)
    on delete set null (opportunity_field_evidence_id),
  constraint next_call_brief_item_sources_shape_check
    check (
      (source_kind = 'transcript_segment'
       and call_note_id is null
       and opportunity_field_evidence_id is null
       and (
         (source_call_id is not null and transcript_segment_id is not null)
         or source_call_id is null
         or transcript_segment_id is null
       ))
      or
      (source_kind = 'call_note'
       and transcript_segment_id is null
       and opportunity_field_evidence_id is null
       and (
         (source_call_id is not null and call_note_id is not null)
         or source_call_id is null
         or call_note_id is null
       ))
      or
      (source_kind = 'opportunity_field_evidence'
       and call_note_id is null
       and (transcript_segment_id is null or source_call_id is not null))
    )
);

create or replace function public.detach_next_call_brief_sources_on_call_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.next_call_brief_item_sources
  set source_call_id = null,
      transcript_segment_id = null,
      call_note_id = null
  where source_call_id = old.id;
  return old;
end;
$$;

drop trigger if exists detach_next_call_brief_sources_on_call_delete on public.calls;
create trigger detach_next_call_brief_sources_on_call_delete
before delete on public.calls
for each row execute function public.detach_next_call_brief_sources_on_call_delete();

revoke all on function public.detach_next_call_brief_sources_on_call_delete()
  from public, anon, authenticated;

create index next_call_brief_item_sources_item_idx
  on public.next_call_brief_item_sources(item_id, position);

create or replace function public.resolve_next_call_source_call(
  target_opportunity_id uuid
)
returns setof public.calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call source resolution is server-owned.' using errcode = '42501';
  end if;

  return query
  select call_record.*
  from public.calls call_record
  where call_record.opportunity_id = target_opportunity_id
    and call_record.ended_at is not null
    and call_record.retention_expires_at > now()
    and call_record.status not in ('planned', 'active')
    and exists (
      select 1
      from public.transcript_segments segment
      join public.call_speakers speaker
        on speaker.id = segment.speaker_id
       and speaker.call_id = segment.call_id
      where segment.call_id = call_record.id
        and segment.is_final
        and not segment.speaker_needs_review
        and char_length(btrim(segment.text)) > 0
        and speaker.role in ('customer', 'customer_2', 'customer_3')
    )
  order by call_record.ended_at desc, call_record.created_at desc
  limit 1;
end;
$$;

create or replace function public.claim_next_call_brief_refresh_request(
  target_opportunity_id uuid,
  target_user_id uuid,
  target_client_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opportunity_record public.opportunities%rowtype;
  existing_request public.next_call_brief_refresh_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call refresh limiting is server-owned.' using errcode = '42501';
  end if;

  select * into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    raise exception 'Opportunity was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = opportunity_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this opportunity.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_user_id::text || ':' || opportunity_record.id::text, 0)
  );

  select * into existing_request
  from public.next_call_brief_refresh_requests
  where workspace_id = opportunity_record.workspace_id
    and client_request_id = target_client_request_id;

  if found then
    if existing_request.opportunity_id <> opportunity_record.id
       or existing_request.requested_by_user_id <> target_user_id then
      raise exception 'Client request id is already in use.' using errcode = '23505';
    end if;
    return false;
  end if;

  if (
    select count(*)
    from public.next_call_brief_refresh_requests request
    where request.opportunity_id = opportunity_record.id
      and request.requested_by_user_id = target_user_id
      and request.created_at >= now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Next-call refresh rate limit reached.' using errcode = 'P0001';
  end if;

  insert into public.next_call_brief_refresh_requests (
    workspace_id,
    account_id,
    opportunity_id,
    requested_by_user_id,
    client_request_id
  ) values (
    opportunity_record.workspace_id,
    opportunity_record.account_id,
    opportunity_record.id,
    target_user_id,
    target_client_request_id
  );

  return true;
end;
$$;

create or replace function public.claim_next_call_brief_generation(
  target_opportunity_id uuid,
  target_user_id uuid,
  target_client_request_id uuid,
  target_context_fingerprint text
)
returns setof public.next_call_brief_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opportunity_record public.opportunities%rowtype;
  source_call_record public.calls%rowtype;
  existing_attempt public.next_call_brief_attempts%rowtype;
  attempt_record public.next_call_brief_attempts%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call generation is server-owned.' using errcode = '42501';
  end if;

  if target_context_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid next-call context fingerprint.' using errcode = '22023';
  end if;

  select * into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    raise exception 'Opportunity was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = opportunity_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this opportunity.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      opportunity_record.workspace_id::text || ':' || opportunity_record.id::text,
      0
    )
  );

  select * into existing_attempt
  from public.next_call_brief_attempts
  where workspace_id = opportunity_record.workspace_id
    and client_request_id = target_client_request_id;

  if found then
    if existing_attempt.opportunity_id <> opportunity_record.id
       or existing_attempt.requested_by_user_id is distinct from target_user_id then
      raise exception 'Client request id is already in use.' using errcode = '23505';
    end if;
    return next existing_attempt;
    return;
  end if;

  select * into source_call_record
  from public.resolve_next_call_source_call(opportunity_record.id);

  if not found then
    raise exception 'No completed customer conversation is available.' using errcode = 'P0002';
  end if;

  select * into existing_attempt
  from public.next_call_brief_attempts
  where opportunity_id = opportunity_record.id
    and status in ('queued', 'processing')
  order by created_at desc
  limit 1;

  if found then
    return next existing_attempt;
    return;
  end if;

  if (
    select count(*)
    from public.next_call_brief_attempts
    where opportunity_id = opportunity_record.id
      and requested_by_user_id = target_user_id
      and created_at >= now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Next-call refresh rate limit reached.' using errcode = 'P0001';
  end if;

  insert into public.next_call_brief_attempts (
    workspace_id,
    account_id,
    opportunity_id,
    source_call_id,
    requested_by_user_id,
    client_request_id,
    pending_context_fingerprint
  ) values (
    opportunity_record.workspace_id,
    opportunity_record.account_id,
    opportunity_record.id,
    source_call_record.id,
    target_user_id,
    target_client_request_id,
    target_context_fingerprint
  )
  returning * into attempt_record;

  return next attempt_record;
end;
$$;

create or replace function public.claim_next_call_brief_attempt(
  target_attempt_id uuid,
  worker_id text,
  lease_seconds integer default 90
)
returns setof public.next_call_brief_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_record public.next_call_brief_attempts%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call generation is server-owned.' using errcode = '42501';
  end if;

  update public.next_call_brief_attempts attempt
  set status = 'failed',
      safe_error_code = 'next_call_retry_exhausted',
      completed_at = now(),
      worker_locked_at = null,
      worker_locked_by = null,
      dispatch_locked_at = null,
      dispatch_locked_by = null,
      updated_at = now()
  where attempt.id = target_attempt_id
    and attempt.status = 'processing'
    and attempt.attempt_count >= 3
    and attempt.worker_locked_at < now() - make_interval(secs => greatest(30, least(300, lease_seconds)));

  update public.next_call_brief_attempts attempt
  set status = 'processing',
      attempt_count = attempt.attempt_count + 1,
      started_at = coalesce(attempt.started_at, now()),
      worker_locked_at = now(),
      worker_locked_by = left(worker_id, 160),
      dispatch_locked_at = null,
      dispatch_locked_by = null,
      updated_at = now()
  where attempt.id = target_attempt_id
    and attempt.attempt_count < 3
    and (
      attempt.status = 'queued'
      or (
        attempt.status = 'processing'
        and attempt.worker_locked_at < now() - make_interval(secs => greatest(30, least(300, lease_seconds)))
      )
    )
  returning * into attempt_record;

  if found then return next attempt_record; end if;
end;
$$;

create or replace function public.claim_due_next_call_brief_dispatches(
  worker_id text,
  batch_limit integer default 10,
  lease_seconds integer default 120
)
returns setof public.next_call_brief_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call recovery is server-owned.' using errcode = '42501';
  end if;

  return query
  with due as (
    select attempt.id
    from public.next_call_brief_attempts attempt
    where (
      attempt.status = 'queued'
      or (
        attempt.status = 'processing'
        and attempt.worker_locked_at < now() - make_interval(secs => greatest(30, least(300, lease_seconds)))
      )
    )
      and (
        attempt.dispatch_locked_at is null
        or attempt.dispatch_locked_at < now() - make_interval(secs => greatest(30, least(300, lease_seconds)))
      )
    order by attempt.created_at
    for update skip locked
    limit greatest(1, least(25, batch_limit))
  )
  update public.next_call_brief_attempts attempt
  set dispatch_locked_at = now(),
      dispatch_locked_by = left(worker_id, 160),
      updated_at = now()
  from due
  where attempt.id = due.id
  returning attempt.*;
end;
$$;

create or replace function public.complete_next_call_brief_generation(
  target_attempt_id uuid,
  target_worker_id text,
  target_outcome text,
  target_leave_with text,
  target_items jsonb
)
returns setof public.next_call_briefs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_record public.next_call_brief_attempts%rowtype;
  brief_record public.next_call_briefs%rowtype;
  item_value jsonb;
  source_value jsonb;
  item_record public.next_call_brief_items%rowtype;
  item_kind text;
  item_position integer;
  source_kind text;
  source_id uuid;
  source_call_id uuid;
  source_segment_id uuid;
  source_count integer;
  transcript_source_count integer;
  seller_source_count integer;
  question_count integer;
  watch_count integer;
  opening_count integer;
  legacy_opening text;
  legacy_questions jsonb;
  legacy_risks jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call generation is server-owned.' using errcode = '42501';
  end if;

  select * into attempt_record
  from public.next_call_brief_attempts
  where id = target_attempt_id
    and worker_locked_by = left(target_worker_id, 160)
  for update;

  if not found or attempt_record.status <> 'processing' then
    raise exception 'Next-call generation attempt is not processing.' using errcode = '55000';
  end if;

  if char_length(btrim(coalesce(target_outcome, ''))) not between 1 and 1200
     or char_length(btrim(coalesce(target_leave_with, ''))) not between 1 and 1200
     or jsonb_typeof(target_items) <> 'array' then
    raise exception 'Next-call generation payload is invalid.' using errcode = '22023';
  end if;

  select count(*) filter (where value->>'kind' = 'question'),
         count(*) filter (where value->>'kind' = 'watch'),
         count(*) filter (where value->>'kind' = 'opening')
  into question_count, watch_count, opening_count
  from jsonb_array_elements(target_items);

  if question_count not between 1 and 3 or watch_count > 2 or opening_count > 1 then
    raise exception 'Next-call item limits were exceeded.' using errcode = '22023';
  end if;

  select * into brief_record
  from public.next_call_briefs
  where opportunity_id = attempt_record.opportunity_id
    and previous_call_id = attempt_record.source_call_id
    and schema_version = 2
  for update;

  if found then
    update public.next_call_briefs
    set objective = btrim(target_outcome),
        suggested_opening = null,
        focus_questions = '[]'::jsonb,
        missing_evidence = '[]'::jsonb,
        risk_notes = '[]'::jsonb,
        recommended_next_step = btrim(target_leave_with),
        completed_context_fingerprint = attempt_record.pending_context_fingerprint,
        generated_at = now(),
        updated_at = now()
    where id = brief_record.id
    returning * into brief_record;

    delete from public.next_call_brief_items where brief_id = brief_record.id;
  else
    insert into public.next_call_briefs (
      workspace_id,
      account_id,
      opportunity_id,
      previous_call_id,
      schema_version,
      objective,
      recommended_next_step,
      completed_context_fingerprint
    ) values (
      attempt_record.workspace_id,
      attempt_record.account_id,
      attempt_record.opportunity_id,
      attempt_record.source_call_id,
      2,
      btrim(target_outcome),
      btrim(target_leave_with),
      attempt_record.pending_context_fingerprint
    ) returning * into brief_record;
  end if;

  for item_value in select value from jsonb_array_elements(target_items)
  loop
    item_kind := item_value->>'kind';
    item_position := (item_value->>'position')::integer;

    insert into public.next_call_brief_items (
      workspace_id,
      account_id,
      opportunity_id,
      brief_id,
      kind,
      position,
      text,
      intent_cluster_id,
      related_playbook_field_id,
      learning_target,
      why_it_matters,
      suggested_response,
      basis,
      needs_confirmation
    ) values (
      attempt_record.workspace_id,
      attempt_record.account_id,
      attempt_record.opportunity_id,
      brief_record.id,
      item_kind,
      item_position,
      btrim(item_value->>'text'),
      nullif(btrim(item_value->>'intentClusterId'), ''),
      nullif(item_value->>'relatedPlaybookFieldId', '')::uuid,
      nullif(btrim(item_value->>'learningTarget'), ''),
      nullif(btrim(item_value->>'whyItMatters'), ''),
      nullif(btrim(item_value->>'suggestedResponse'), ''),
      item_value->>'basis',
      coalesce((item_value->>'needsConfirmation')::boolean, false)
    ) returning * into item_record;

    if jsonb_typeof(coalesce(item_value->'sources', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(item_value->'sources', '[]'::jsonb)) > 3 then
      raise exception 'Next-call item sources are invalid.' using errcode = '22023';
    end if;

    source_count := 0;
    transcript_source_count := 0;
    seller_source_count := 0;
    for source_value in
      select value from jsonb_array_elements(coalesce(item_value->'sources', '[]'::jsonb))
    loop
      source_count := source_count + 1;
      source_kind := source_value->>'kind';
      source_id := (source_value->>'id')::uuid;
      source_call_id := null;
      source_segment_id := null;

      if source_kind = 'transcript_segment' then
        transcript_source_count := transcript_source_count + 1;
        select segment.call_id into source_call_id
        from public.transcript_segments segment
        join public.calls source_call on source_call.id = segment.call_id
        join public.call_speakers speaker on speaker.id = segment.speaker_id
        where segment.id = source_id
          and segment.is_final
          and not segment.speaker_needs_review
          and char_length(btrim(segment.text)) > 0
          and speaker.role in ('customer', 'customer_2', 'customer_3')
          and speaker.call_id = segment.call_id
          and source_call.retention_expires_at > now()
          and source_call.workspace_id = attempt_record.workspace_id
          and source_call.account_id = attempt_record.account_id
          and source_call.opportunity_id = attempt_record.opportunity_id;
        if not found then
          raise exception 'Transcript source is invalid.' using errcode = '23503';
        end if;

        insert into public.next_call_brief_item_sources (
          workspace_id, account_id, opportunity_id, brief_id, item_id,
          position, source_kind, source_call_id, transcript_segment_id
        ) values (
          attempt_record.workspace_id, attempt_record.account_id,
          attempt_record.opportunity_id, brief_record.id, item_record.id,
          source_count, source_kind, source_call_id, source_id
        );
      elsif source_kind = 'call_note' then
        seller_source_count := seller_source_count + 1;
        select note.call_id into source_call_id
        from public.call_notes note
        join public.calls source_call on source_call.id = note.call_id
        where note.id = source_id
          and note.note_type = 'manual_note'
          and source_call.retention_expires_at > now()
          and source_call.workspace_id = attempt_record.workspace_id
          and source_call.account_id = attempt_record.account_id
          and source_call.opportunity_id = attempt_record.opportunity_id;
        if not found then
          raise exception 'Call-note source is invalid.' using errcode = '23503';
        end if;

        insert into public.next_call_brief_item_sources (
          workspace_id, account_id, opportunity_id, brief_id, item_id,
          position, source_kind, source_call_id, call_note_id
        ) values (
          attempt_record.workspace_id, attempt_record.account_id,
          attempt_record.opportunity_id, brief_record.id, item_record.id,
          source_count, source_kind, source_call_id, source_id
        );
      elsif source_kind = 'opportunity_field_evidence' then
        seller_source_count := seller_source_count + 1;
        select evidence.source_call_id, evidence.source_transcript_segment_id
        into source_call_id, source_segment_id
        from public.opportunity_field_evidence evidence
          left join public.calls evidence_call on evidence_call.id = evidence.source_call_id
        where evidence.id = source_id
          and evidence.opportunity_id = attempt_record.opportunity_id
          and (
            evidence.source_call_id is null
            or (
              evidence_call.workspace_id = attempt_record.workspace_id
              and evidence_call.account_id = attempt_record.account_id
              and evidence_call.opportunity_id = attempt_record.opportunity_id
              and evidence_call.retention_expires_at > now()
            )
          )
          and (
            evidence.source_transcript_segment_id is null
            or exists (
              select 1 from public.transcript_segments source_segment
              where source_segment.id = evidence.source_transcript_segment_id
                and source_segment.call_id = evidence.source_call_id
            )
          );
        if not found then
          raise exception 'Methodology evidence source is invalid.' using errcode = '23503';
        end if;

        insert into public.next_call_brief_item_sources (
          workspace_id, account_id, opportunity_id, brief_id, item_id,
          position, source_kind, source_call_id, transcript_segment_id,
          opportunity_field_evidence_id
        ) values (
          attempt_record.workspace_id, attempt_record.account_id,
          attempt_record.opportunity_id, brief_record.id, item_record.id,
          source_count, source_kind, source_call_id, source_segment_id, source_id
        );
      else
        raise exception 'Next-call source kind is invalid.' using errcode = '22023';
      end if;
    end loop;

    if item_record.basis = 'inference' and source_count < 2 then
      raise exception 'AI inferences require at least two sources.' using errcode = '22023';
    end if;

    if item_record.basis = 'transcript' and transcript_source_count < 1 then
      raise exception 'Transcript-based guidance requires customer transcript evidence.' using errcode = '22023';
    end if;

    if item_record.basis = 'seller_context' and seller_source_count < 1 then
      raise exception 'Seller-context guidance requires seller-maintained evidence.' using errcode = '22023';
    end if;

    if item_record.kind = 'watch' and source_count < 1 then
      raise exception 'Watch items require evidence.' using errcode = '22023';
    end if;

    if item_record.basis = 'methodology_gap' and (
      item_record.related_playbook_field_id is null
      or not exists (
        select 1
        from public.opportunity_playbooks assignment
        join public.playbook_fields field
          on field.playbook_id = assignment.playbook_id
         and field.id = item_record.related_playbook_field_id
        left join public.opportunity_field_evidence evidence
          on evidence.opportunity_id = attempt_record.opportunity_id
         and evidence.playbook_field_id = field.id
        where assignment.opportunity_id = attempt_record.opportunity_id
          and coalesce(evidence.status, 'missing'::public.field_evidence_status) in ('missing', 'weak')
      )
    ) then
      raise exception 'Methodology-gap guidance requires a selected weak or missing field.' using errcode = '22023';
    end if;
  end loop;

  select item.text into legacy_opening
  from public.next_call_brief_items item
  where item.brief_id = brief_record.id and item.kind = 'opening';

  select coalesce(jsonb_agg(item.text order by item.position), '[]'::jsonb)
  into legacy_questions
  from public.next_call_brief_items item
  where item.brief_id = brief_record.id and item.kind = 'question';

  select coalesce(jsonb_agg(item.text order by item.position), '[]'::jsonb)
  into legacy_risks
  from public.next_call_brief_items item
  where item.brief_id = brief_record.id and item.kind = 'watch';

  update public.next_call_briefs
  set suggested_opening = legacy_opening,
      focus_questions = legacy_questions,
      risk_notes = legacy_risks,
      updated_at = now()
  where id = brief_record.id
  returning * into brief_record;

  update public.next_call_brief_attempts
  set status = 'completed',
      brief_id = brief_record.id,
      completed_at = now(),
      worker_locked_at = null,
      worker_locked_by = null,
      dispatch_locked_at = null,
      dispatch_locked_by = null,
      safe_error_code = null,
      updated_at = now()
  where id = attempt_record.id;

  return next brief_record;
end;
$$;

create or replace function public.fail_next_call_brief_generation(
  target_attempt_id uuid,
  target_worker_id text,
  target_safe_error_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call generation is server-owned.' using errcode = '42501';
  end if;

  if target_safe_error_code !~ '^[a-z0-9_]{1,120}$' then
    raise exception 'Next-call error code is invalid.' using errcode = '22023';
  end if;

  update public.next_call_brief_attempts
  set status = 'failed',
      brief_id = null,
      safe_error_code = target_safe_error_code,
      completed_at = now(),
      worker_locked_at = null,
      worker_locked_by = null,
      dispatch_locked_at = null,
      dispatch_locked_by = null,
      updated_at = now()
  where id = target_attempt_id
    and status = 'processing'
    and worker_locked_by = left(target_worker_id, 160);
end;
$$;

create or replace function public.release_next_call_brief_generation(
  target_attempt_id uuid,
  target_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call generation is server-owned.' using errcode = '42501';
  end if;

  update public.next_call_brief_attempts
  set status = 'queued',
      brief_id = null,
      safe_error_code = null,
      started_at = null,
      completed_at = null,
      worker_locked_at = null,
      worker_locked_by = null,
      dispatch_locked_at = null,
      dispatch_locked_by = null,
      updated_at = now()
  where id = target_attempt_id
    and status = 'processing'
    and worker_locked_by = left(target_worker_id, 160)
    and attempt_count < 3;

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function public.apply_next_call_brief_step(
  target_brief_id uuid,
  target_user_id uuid,
  target_next_step text,
  expected_opportunity_updated_at timestamptz
)
returns setof public.opportunities
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  brief_record public.next_call_briefs%rowtype;
  opportunity_record public.opportunities%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call application is server-owned.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(target_next_step, ''))) not between 1 and 2000 then
    raise exception 'Opportunity next step is invalid.' using errcode = '22023';
  end if;

  select * into brief_record
  from public.next_call_briefs
  where id = target_brief_id
  for update;

  if not found then
    raise exception 'Next-call brief was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = brief_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this opportunity.' using errcode = '42501';
  end if;

  update public.opportunities opportunity
  set next_step = btrim(target_next_step),
      updated_at = now()
  where opportunity.id = brief_record.opportunity_id
    and opportunity.workspace_id = brief_record.workspace_id
    and opportunity.updated_at = expected_opportunity_updated_at
  returning * into opportunity_record;

  if not found then
    raise exception 'Opportunity changed before the next step was applied.' using errcode = '40001';
  end if;

  update public.next_call_briefs
  set applied_next_step = btrim(target_next_step),
      applied_next_step_by = target_user_id,
      applied_next_step_at = now(),
      updated_at = now()
  where id = brief_record.id;

  return next opportunity_record;
end;
$$;

create or replace function public.refresh_next_call_brief_fingerprint(
  target_brief_id uuid,
  target_context_fingerprint text,
  expected_opportunity_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Next-call fingerprinting is server-owned.' using errcode = '42501';
  end if;

  if target_context_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid next-call context fingerprint.' using errcode = '22023';
  end if;

  update public.next_call_briefs brief
  set completed_context_fingerprint = target_context_fingerprint,
      updated_at = now()
  where brief.id = target_brief_id
    and brief.schema_version = 2
    and exists (
      select 1
      from public.opportunities opportunity
      where opportunity.id = brief.opportunity_id
        and opportunity.workspace_id = brief.workspace_id
        and opportunity.updated_at = expected_opportunity_updated_at
    );

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

drop trigger if exists set_next_call_brief_attempts_updated_at on public.next_call_brief_attempts;
create trigger set_next_call_brief_attempts_updated_at
before update on public.next_call_brief_attempts
for each row execute function public.set_updated_at();

drop trigger if exists set_next_call_brief_items_updated_at on public.next_call_brief_items;
create trigger set_next_call_brief_items_updated_at
before update on public.next_call_brief_items
for each row execute function public.set_updated_at();

alter table public.next_call_briefs enable row level security;
alter table public.next_call_brief_attempts enable row level security;
alter table public.next_call_brief_refresh_requests enable row level security;
alter table public.next_call_brief_items enable row level security;
alter table public.next_call_brief_item_sources enable row level security;

drop policy if exists "Workspace members can manage next call briefs" on public.next_call_briefs;
drop policy if exists "Workspace members can read next call briefs" on public.next_call_briefs;
create policy "Workspace members can read next call briefs"
on public.next_call_briefs for select
to authenticated
using (
  public.is_workspace_member_with_active_session(workspace_id)
  and public.can_access_opportunity(opportunity_id)
);

create policy "Workspace members can read next call brief attempts"
on public.next_call_brief_attempts for select
to authenticated
using (
  public.is_workspace_member_with_active_session(workspace_id)
  and public.can_access_opportunity(opportunity_id)
);

create policy "Workspace members can read next call brief items"
on public.next_call_brief_items for select
to authenticated
using (
  public.is_workspace_member_with_active_session(workspace_id)
  and public.can_access_opportunity(opportunity_id)
);

create policy "Workspace members can read next call brief item sources"
on public.next_call_brief_item_sources for select
to authenticated
using (
  public.is_workspace_member_with_active_session(workspace_id)
  and public.can_access_opportunity(opportunity_id)
);

revoke all on table public.next_call_briefs from public, anon, authenticated;
revoke all on table public.next_call_brief_attempts from public, anon, authenticated;
revoke all on table public.next_call_brief_refresh_requests from public, anon, authenticated;
revoke all on table public.next_call_brief_items from public, anon, authenticated;
revoke all on table public.next_call_brief_item_sources from public, anon, authenticated;

grant select on table public.next_call_briefs to authenticated;
grant select (
  id,
  workspace_id,
  account_id,
  opportunity_id,
  source_call_id,
  brief_id,
  status,
  safe_error_code,
  started_at,
  completed_at,
  created_at,
  updated_at
) on public.next_call_brief_attempts to authenticated;
grant select on table public.next_call_brief_items to authenticated;
grant select on table public.next_call_brief_item_sources to authenticated;

revoke all on function public.claim_next_call_brief_generation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_next_call_brief_refresh_request(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_next_call_source_call(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_next_call_brief_attempt(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_due_next_call_brief_dispatches(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_next_call_brief_generation(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_next_call_brief_generation(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.release_next_call_brief_generation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_next_call_brief_step(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.refresh_next_call_brief_fingerprint(uuid, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.claim_next_call_brief_generation(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.claim_next_call_brief_refresh_request(uuid, uuid, uuid)
  to service_role;
grant execute on function public.resolve_next_call_source_call(uuid)
  to service_role;
grant execute on function public.claim_next_call_brief_attempt(uuid, text, integer)
  to service_role;
grant execute on function public.claim_due_next_call_brief_dispatches(text, integer, integer)
  to service_role;
grant execute on function public.complete_next_call_brief_generation(uuid, text, text, text, jsonb)
  to service_role;
grant execute on function public.fail_next_call_brief_generation(uuid, text, text)
  to service_role;
grant execute on function public.release_next_call_brief_generation(uuid, text)
  to service_role;
grant execute on function public.apply_next_call_brief_step(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.refresh_next_call_brief_fingerprint(uuid, text, timestamptz)
  to service_role;
