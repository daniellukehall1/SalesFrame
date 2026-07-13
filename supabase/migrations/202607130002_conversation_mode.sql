-- Private, per-user Conversation mode state and approval-gated assistant actions.
--
-- The assistant can read bounded workspace context, but all domain writes are
-- staged as short-lived proposals and executed atomically by a service-role RPC.
-- Authenticated clients receive active-session SELECT access only.
--
-- Rollback: disable Conversation mode, then drop the assistant tables and the
-- service-role functions below. Domain records created through confirmed
-- proposals are normal CRM records and must never be removed by a rollback.

create table public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  created_by_user_id uuid not null,
  title text not null default 'New conversation'
    check (char_length(btrim(title)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, created_by_user_id, id),
  foreign key (workspace_id, created_by_user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete cascade
);

create index assistant_threads_owner_activity_idx
  on public.assistant_threads(workspace_id, created_by_user_id, updated_at desc);

create table public.workspace_member_preferences (
  workspace_id uuid not null,
  user_id uuid not null,
  interface_mode text not null default 'workspace'
    check (interface_mode in ('workspace', 'conversation')),
  active_thread_id uuid,
  last_standard_path text not null default '/'
    check (
      char_length(last_standard_path) between 1 and 2048
      and left(last_standard_path, 1) = '/'
      and left(last_standard_path, 2) <> '//'
      and position(chr(92) in last_standard_path) = 0
      and last_standard_path !~ '[[:cntrl:]]'
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete cascade,
  foreign key (workspace_id, user_id, active_thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete set null (active_thread_id)
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  owner_user_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'action', 'status')),
  content text not null default '' check (char_length(content) <= 12000),
  client_request_id uuid,
  ordinal bigint generated always as identity,
  created_at timestamptz not null default now(),
  unique (workspace_id, owner_user_id, thread_id, id),
  foreign key (workspace_id, owner_user_id, thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete cascade,
  constraint assistant_messages_user_request_shape_check check (
    (role = 'user' and client_request_id is not null and char_length(btrim(content)) between 1 and 8000)
    or (role <> 'user' and client_request_id is null)
  )
);

create unique index assistant_messages_thread_client_request_key
  on public.assistant_messages(thread_id, client_request_id)
  where client_request_id is not null;

create index assistant_messages_thread_ordinal_idx
  on public.assistant_messages(thread_id, ordinal desc);

create table public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  user_id uuid not null,
  client_request_id uuid not null,
  user_message_id uuid not null,
  assistant_message_id uuid,
  model text not null check (char_length(model) between 1 and 120),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  safe_error_code text check (
    safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,120}$'
  ),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  tool_rounds smallint not null default 0 check (tool_rounds between 0 and 4),
  read_operations smallint not null default 0 check (read_operations between 0 and 8),
  started_at timestamptz not null default now(),
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, client_request_id),
  unique (workspace_id, user_id, thread_id, id),
  foreign key (workspace_id, user_id, thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, user_message_id)
    references public.assistant_messages(workspace_id, owner_user_id, thread_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, assistant_message_id)
    references public.assistant_messages(workspace_id, owner_user_id, thread_id, id)
    on delete cascade,
  constraint assistant_runs_lifecycle_check check (
    (status = 'running' and completed_at is null and safe_error_code is null and assistant_message_id is null)
    or (status = 'completed' and completed_at is not null and safe_error_code is null and assistant_message_id is not null)
    or (status = 'failed' and completed_at is not null and safe_error_code is not null)
  )
);

create index assistant_runs_owner_rate_idx
  on public.assistant_runs(workspace_id, user_id, created_at desc);

create unique index assistant_runs_one_running_user_key
  on public.assistant_runs(workspace_id, user_id)
  where status = 'running';

-- Content-free quota records deliberately survive conversation deletion so a
-- seller cannot reset distributed turn limits by deleting and recreating a
-- thread. They are removed automatically after the enforcement window.
create table public.assistant_turn_rate_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, client_request_id)
);

create index assistant_turn_rate_ledger_owner_activity_idx
  on public.assistant_turn_rate_ledger(workspace_id, user_id, created_at desc);

create index assistant_turn_rate_ledger_cleanup_idx
  on public.assistant_turn_rate_ledger(created_at);

create table public.assistant_action_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  user_id uuid not null,
  run_id uuid not null,
  capability_id text not null check (
    capability_id in (
      'create_account', 'update_account', 'archive_account',
      'create_opportunity', 'update_opportunity', 'archive_opportunity',
      'create_contact', 'update_contact', 'archive_contact'
    )
  ),
  arguments jsonb not null check (jsonb_typeof(arguments) = 'object'),
  preview jsonb not null check (jsonb_typeof(preview) = 'object'),
  expected_record_updated_at timestamptz,
  target_resource_type text check (
    target_resource_type is null or target_resource_type in ('account', 'opportunity', 'contact')
  ),
  target_resource_id uuid,
  risk text not null default 'standard' check (risk in ('standard', 'costed', 'destructive')),
  status text not null default 'staged'
    check (status in ('staged', 'pending', 'completed', 'cancelled', 'expired', 'failed')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  safe_error_code text check (
    safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,120}$'
  ),
  result_resource_type text check (
    result_resource_type is null or result_resource_type in ('account', 'opportunity', 'contact')
  ),
  result_resource_id uuid,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, idempotency_key),
  unique (workspace_id, user_id, id),
  unique (workspace_id, user_id, thread_id, id),
  foreign key (workspace_id, user_id, thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, run_id)
    references public.assistant_runs(workspace_id, user_id, thread_id, id)
    on delete cascade,
  constraint assistant_action_proposals_target_shape_check check (
    (target_resource_type is null) = (target_resource_id is null)
  ),
  constraint assistant_action_proposals_result_shape_check check (
    (result_resource_type is null) = (result_resource_id is null)
  ),
  constraint assistant_action_proposals_lifecycle_check check (
    (status in ('staged', 'pending') and confirmed_at is null and cancelled_at is null and executed_at is null and safe_error_code is null)
    or (status = 'completed' and confirmed_at is not null and executed_at is not null and cancelled_at is null and safe_error_code is null and result_resource_id is not null)
    or (status = 'cancelled' and cancelled_at is not null and confirmed_at is null and executed_at is null)
    or (status = 'expired' and confirmed_at is null and executed_at is null)
    or (status = 'failed' and confirmed_at is not null and executed_at is null and safe_error_code is not null)
  )
);

create index assistant_action_proposals_owner_status_idx
  on public.assistant_action_proposals(workspace_id, user_id, status, created_at desc);

create table public.assistant_action_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null,
  user_id uuid not null,
  capability_id text not null check (
    capability_id in (
      'create_account', 'update_account', 'archive_account',
      'create_opportunity', 'update_opportunity', 'archive_opportunity',
      'create_contact', 'update_contact', 'archive_contact'
    )
  ),
  target_resource_type text check (
    target_resource_type is null or target_resource_type in ('account', 'opportunity', 'contact')
  ),
  target_resource_id uuid,
  result_resource_type text check (
    result_resource_type is null or result_resource_type in ('account', 'opportunity', 'contact')
  ),
  result_resource_id uuid,
  event_type text not null
    check (event_type in ('proposed', 'confirmed', 'cancelled', 'completed', 'failed', 'expired')),
  safe_code text check (safe_code is null or safe_code ~ '^[a-z0-9_]{1,120}$'),
  created_at timestamptz not null default now(),
  check ((target_resource_type is null) = (target_resource_id is null)),
  check ((result_resource_type is null) = (result_resource_id is null))
);

comment on table public.assistant_action_events is
  'Content-minimized audit events intentionally survive deletion of their proposal or conversation.';

create index assistant_action_events_proposal_idx
  on public.assistant_action_events(proposal_id, created_at);

create index assistant_action_events_owner_activity_idx
  on public.assistant_action_events(workspace_id, user_id, created_at desc);

create table public.assistant_message_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  owner_user_id uuid not null,
  message_id uuid not null,
  reference_type text not null check (
    reference_type in (
      'account', 'opportunity', 'contact', 'call', 'transcript_segment',
      'methodology_evidence', 'next_call_brief'
    )
  ),
  reference_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 180),
  route text not null check (
    char_length(route) between 1 and 2048
    and left(route, 1) = '/'
    and left(route, 2) <> '//'
    and route !~ '[[:cntrl:]]'
  ),
  created_at timestamptz not null default now(),
  unique (message_id, reference_type, reference_id),
  foreign key (workspace_id, owner_user_id, thread_id, message_id)
    references public.assistant_messages(workspace_id, owner_user_id, thread_id, id)
    on delete cascade
);

create table public.assistant_voice_token_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  issued_at timestamptz not null default now(),
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete cascade
);

create index assistant_voice_token_grants_rate_idx
  on public.assistant_voice_token_grants(workspace_id, user_id, issued_at desc);

create index assistant_voice_token_grants_cleanup_idx
  on public.assistant_voice_token_grants(issued_at);

drop trigger if exists set_assistant_threads_updated_at on public.assistant_threads;
create trigger set_assistant_threads_updated_at
before update on public.assistant_threads
for each row execute function public.set_updated_at();

create or replace function public.clear_archived_assistant_thread_preference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.archived_at is not null and old.archived_at is distinct from new.archived_at then
    update public.workspace_member_preferences preference
    set active_thread_id = null, updated_at = now()
    where preference.workspace_id = new.workspace_id
      and preference.user_id = new.created_by_user_id
      and preference.active_thread_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_archived_assistant_thread_preference on public.assistant_threads;
create trigger clear_archived_assistant_thread_preference
after update of archived_at on public.assistant_threads
for each row execute function public.clear_archived_assistant_thread_preference();

drop trigger if exists set_workspace_member_preferences_updated_at on public.workspace_member_preferences;
create trigger set_workspace_member_preferences_updated_at
before update on public.workspace_member_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_runs_updated_at on public.assistant_runs;
create trigger set_assistant_runs_updated_at
before update on public.assistant_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_action_proposals_updated_at on public.assistant_action_proposals;
create trigger set_assistant_action_proposals_updated_at
before update on public.assistant_action_proposals
for each row execute function public.set_updated_at();

create or replace function public.ensure_assistant_default_thread(
  target_workspace_id uuid,
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_record public.assistant_threads%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant conversations are server-owned.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('assistant-default-thread:' || target_workspace_id::text || ':' || target_user_id::text, 0)
  );

  select thread.* into thread_record
  from public.workspace_member_preferences preference
  join public.assistant_threads thread
    on thread.id = preference.active_thread_id
   and thread.workspace_id = preference.workspace_id
   and thread.created_by_user_id = preference.user_id
  where preference.workspace_id = target_workspace_id
    and preference.user_id = target_user_id
    and thread.archived_at is null
  for share of thread;

  if not found then
    select * into thread_record
    from public.assistant_threads thread
    where thread.workspace_id = target_workspace_id
      and thread.created_by_user_id = target_user_id
      and thread.archived_at is null
    order by thread.updated_at desc, thread.created_at desc
    limit 1
    for share;
  end if;

  if not found then
    insert into public.assistant_threads(workspace_id, created_by_user_id, title)
    values (target_workspace_id, target_user_id, 'New conversation')
    returning * into thread_record;
  end if;

  insert into public.workspace_member_preferences(
    workspace_id, user_id, interface_mode, active_thread_id
  ) values (
    target_workspace_id, target_user_id, 'conversation', thread_record.id
  )
  on conflict (workspace_id, user_id) do update
  set interface_mode = 'conversation',
      active_thread_id = excluded.active_thread_id,
      updated_at = now();

  return to_jsonb(thread_record);
end;
$$;

create or replace function public.begin_assistant_run(
  target_thread_id uuid,
  target_user_id uuid,
  target_client_request_id uuid,
  target_model text,
  target_content text,
  target_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_record public.assistant_threads%rowtype;
  message_record public.assistant_messages%rowtype;
  run_record public.assistant_runs%rowtype;
  recent_run_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant runs are server-owned.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(target_content, ''))) not between 1 and 8000
     or char_length(btrim(coalesce(target_model, ''))) not between 1 and 120
     or char_length(btrim(coalesce(target_title, ''))) not between 1 and 120 then
    raise exception 'Assistant run input is invalid.' using errcode = '22023';
  end if;

  select * into thread_record
  from public.assistant_threads
  where id = target_thread_id
    and created_by_user_id = target_user_id
  for update;

  if not found or thread_record.archived_at is not null then
    raise exception 'Assistant conversation was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = thread_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('assistant-run:' || thread_record.workspace_id::text || ':' || target_user_id::text || ':' || target_client_request_id::text, 0)
  );

  select * into run_record
  from public.assistant_runs
  where workspace_id = thread_record.workspace_id
    and user_id = target_user_id
    and client_request_id = target_client_request_id;

  if found then
    if run_record.thread_id <> thread_record.id then
      raise exception 'Assistant request ID belongs to another conversation.' using errcode = '22023';
    end if;
    select * into message_record
    from public.assistant_messages
    where id = run_record.user_message_id
      and workspace_id = run_record.workspace_id
      and thread_id = run_record.thread_id
      and owner_user_id = target_user_id;

    if not found
       or btrim(message_record.content) <> btrim(target_content)
       or run_record.model <> btrim(target_model) then
      raise exception 'Assistant request ID was reused with different input.' using errcode = '22023';
    end if;
    if run_record.status = 'running' and run_record.lease_expires_at <= now() then
      update public.assistant_runs
      set status = 'failed',
          safe_error_code = 'assistant_run_expired',
          completed_at = now(),
          updated_at = now()
      where id = run_record.id
      returning * into run_record;

      with expired as (
        update public.assistant_action_proposals proposal
        set status = 'expired', updated_at = now()
        where proposal.run_id = run_record.id
          and proposal.user_id = target_user_id
          and proposal.status in ('staged', 'pending')
        returning proposal.workspace_id, proposal.id, proposal.user_id,
          proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
      )
      insert into public.assistant_action_events(
        workspace_id, proposal_id, user_id, capability_id,
        target_resource_type, target_resource_id, event_type, safe_code
      )
      select workspace_id, id, user_id, capability_id,
        target_resource_type, target_resource_id, 'expired', 'assistant_run_expired'
      from expired;
    end if;
    return jsonb_build_object('created', false, 'run', to_jsonb(run_record));
  end if;

  update public.assistant_runs
  set status = 'failed',
      safe_error_code = 'assistant_run_expired',
      completed_at = now(),
      updated_at = now()
  where workspace_id = thread_record.workspace_id
    and user_id = target_user_id
    and status = 'running'
    and lease_expires_at <= now();

  with expired as (
    update public.assistant_action_proposals proposal
    set status = 'expired', updated_at = now()
    where proposal.user_id = target_user_id
      and proposal.status in ('staged', 'pending')
      and exists (
        select 1 from public.assistant_runs expired_run
        where expired_run.id = proposal.run_id
          and expired_run.workspace_id = thread_record.workspace_id
          and expired_run.user_id = target_user_id
          and expired_run.status = 'failed'
          and expired_run.safe_error_code = 'assistant_run_expired'
      )
    returning proposal.workspace_id, proposal.id, proposal.user_id,
      proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
  )
  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type, safe_code
  )
  select workspace_id, id, user_id, capability_id,
    target_resource_type, target_resource_id, 'expired', 'assistant_run_expired'
  from expired;

  if exists (
    select 1 from public.assistant_runs
    where workspace_id = thread_record.workspace_id
      and user_id = target_user_id
      and status = 'running'
  ) then
    raise exception 'Another assistant turn is already active.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('assistant-rate:' || thread_record.workspace_id::text || ':' || target_user_id::text, 0)
  );

  if exists (
    select 1
    from public.assistant_turn_rate_ledger ledger
    where ledger.workspace_id = thread_record.workspace_id
      and ledger.user_id = target_user_id
      and ledger.client_request_id = target_client_request_id
  ) then
    raise exception 'Assistant request ID was already used.' using errcode = '22023';
  end if;

  select count(*)::integer into recent_run_count
  from public.assistant_turn_rate_ledger
  where workspace_id = thread_record.workspace_id
    and user_id = target_user_id
    and created_at >= now() - interval '10 minutes';

  if recent_run_count >= 30 then
    raise exception 'Assistant turn rate limit reached.' using errcode = 'P0001';
  end if;

  insert into public.assistant_turn_rate_ledger(
    workspace_id, user_id, client_request_id
  ) values (
    thread_record.workspace_id, target_user_id, target_client_request_id
  );

  insert into public.assistant_messages(
    workspace_id, thread_id, owner_user_id, role, content, client_request_id
  ) values (
    thread_record.workspace_id, thread_record.id, target_user_id,
    'user', btrim(target_content), target_client_request_id
  ) returning * into message_record;

  insert into public.assistant_runs(
    workspace_id, thread_id, user_id, client_request_id, user_message_id, model
  ) values (
    thread_record.workspace_id, thread_record.id, target_user_id,
    target_client_request_id, message_record.id, btrim(target_model)
  ) returning * into run_record;

  if thread_record.title = 'New conversation' then
    update public.assistant_threads
    set title = btrim(target_title), updated_at = now()
    where id = thread_record.id;
  end if;

  return jsonb_build_object('created', true, 'run', to_jsonb(run_record));
end;
$$;

create or replace function public.complete_assistant_run(
  target_run_id uuid,
  target_user_id uuid,
  target_content text,
  target_input_tokens integer,
  target_output_tokens integer,
  target_tool_rounds integer,
  target_read_operations integer,
  target_references jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_record public.assistant_runs%rowtype;
  message_record public.assistant_messages%rowtype;
  reference_record jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant runs are server-owned.' using errcode = '42501';
  end if;

  if char_length(coalesce(target_content, '')) > 12000
     or coalesce(target_input_tokens, 0) < 0
     or coalesce(target_output_tokens, 0) < 0
     or target_tool_rounds not between 0 and 4
     or target_read_operations not between 0 and 8
     or jsonb_typeof(target_references) <> 'array'
     or jsonb_array_length(target_references) > 20 then
    raise exception 'Assistant completion is invalid.' using errcode = '22023';
  end if;

  select * into run_record
  from public.assistant_runs
  where id = target_run_id
    and user_id = target_user_id
  for update;

  if not found then
    raise exception 'Assistant run was not found.' using errcode = 'P0002';
  end if;

  if run_record.status = 'completed' and run_record.assistant_message_id is not null then
    select * into message_record
    from public.assistant_messages
    where id = run_record.assistant_message_id;
    return to_jsonb(message_record);
  end if;

  if run_record.status <> 'running' then
    raise exception 'Assistant run is no longer active.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = run_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  insert into public.assistant_messages(
    workspace_id, thread_id, owner_user_id, role, content
  ) values (
    run_record.workspace_id, run_record.thread_id, target_user_id,
    'assistant', target_content
  ) returning * into message_record;

  for reference_record in select value from jsonb_array_elements(target_references)
  loop
    if (reference_record ->> 'referenceType') not in (
      'account', 'opportunity', 'contact', 'call', 'transcript_segment',
      'methodology_evidence', 'next_call_brief'
    )
       or coalesce(reference_record ->> 'referenceId', '') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or char_length(btrim(coalesce(reference_record ->> 'label', ''))) not between 1 and 180
       or char_length(coalesce(reference_record ->> 'route', '')) not between 1 and 2048
       or left(reference_record ->> 'route', 1) <> '/'
       or left(reference_record ->> 'route', 2) = '//'
       or (reference_record ->> 'route') ~ '[[:cntrl:]]' then
      raise exception 'Assistant reference is invalid.' using errcode = '22023';
    end if;

    insert into public.assistant_message_references(
      workspace_id, thread_id, owner_user_id, message_id,
      reference_type, reference_id, label, route
    ) values (
      run_record.workspace_id, run_record.thread_id, target_user_id, message_record.id,
      reference_record ->> 'referenceType',
      (reference_record ->> 'referenceId')::uuid,
      btrim(reference_record ->> 'label'),
      reference_record ->> 'route'
    ) on conflict (message_id, reference_type, reference_id) do nothing;
  end loop;

  update public.assistant_runs
  set assistant_message_id = message_record.id,
      status = 'completed',
      safe_error_code = null,
      input_tokens = target_input_tokens,
      output_tokens = target_output_tokens,
      tool_rounds = target_tool_rounds,
      read_operations = target_read_operations,
      completed_at = now(),
      updated_at = now()
  where id = run_record.id;

  update public.assistant_action_proposals
  set status = 'pending', updated_at = now()
  where run_id = run_record.id
    and user_id = target_user_id
    and status = 'staged';

  update public.assistant_threads
  set updated_at = now()
  where id = run_record.thread_id;

  return to_jsonb(message_record);
end;
$$;

create or replace function public.fail_assistant_run(
  target_run_id uuid,
  target_user_id uuid,
  target_safe_error_code text,
  target_tool_rounds integer,
  target_read_operations integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_record public.assistant_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant runs are server-owned.' using errcode = '42501';
  end if;

  if target_safe_error_code !~ '^[a-z0-9_]{1,120}$'
     or target_tool_rounds not between 0 and 4
     or target_read_operations not between 0 and 8 then
    raise exception 'Assistant failure state is invalid.' using errcode = '22023';
  end if;

  select * into run_record
  from public.assistant_runs
  where id = target_run_id
    and user_id = target_user_id
  for update;

  if not found then
    return false;
  end if;

  if run_record.status <> 'running' then
    return true;
  end if;

  update public.assistant_runs
  set status = 'failed',
      safe_error_code = target_safe_error_code,
      tool_rounds = target_tool_rounds,
      read_operations = target_read_operations,
      completed_at = now(),
      updated_at = now()
  where id = run_record.id;

  with expired as (
    update public.assistant_action_proposals proposal
    set status = 'expired', updated_at = now()
    where proposal.run_id = run_record.id
      and proposal.user_id = target_user_id
      and proposal.status in ('staged', 'pending')
    returning proposal.workspace_id, proposal.id, proposal.user_id,
      proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
  )
  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type, safe_code
  )
  select workspace_id, id, user_id, capability_id,
    target_resource_type, target_resource_id, 'expired', 'assistant_run_failed'
  from expired;

  return true;
end;
$$;

create or replace function public.renew_assistant_run_lease(
  target_run_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  renewed boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant runs are server-owned.' using errcode = '42501';
  end if;

  update public.assistant_runs run
  set lease_expires_at = now() + interval '2 minutes', updated_at = now()
  where run.id = target_run_id
    and run.user_id = target_user_id
    and run.status = 'running'
    and exists (
      select 1 from public.workspace_members member
      where member.workspace_id = run.workspace_id
        and member.user_id = target_user_id
    );

  renewed := found;
  return renewed;
end;
$$;

create or replace function public.create_assistant_action_proposal(
  target_run_id uuid,
  target_user_id uuid,
  target_capability_id text,
  target_arguments jsonb,
  target_preview jsonb,
  target_expected_record_updated_at timestamptz,
  target_resource_type text,
  target_resource_id uuid,
  target_risk text,
  target_idempotency_key text,
  target_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_record public.assistant_runs%rowtype;
  proposal_record public.assistant_action_proposals%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant actions are server-owned.' using errcode = '42501';
  end if;

  if jsonb_typeof(target_arguments) <> 'object'
     or jsonb_typeof(target_preview) <> 'object'
     or char_length(coalesce(target_idempotency_key, '')) not between 1 and 160
     or target_expires_at <= now()
     or target_expires_at > now() + interval '15 minutes' then
    raise exception 'Assistant proposal is invalid.' using errcode = '22023';
  end if;

  select * into run_record
  from public.assistant_runs
  where id = target_run_id
    and user_id = target_user_id
  for update;

  if not found then
    raise exception 'Assistant run was not found.' using errcode = 'P0002';
  end if;

  if run_record.status <> 'running' or run_record.lease_expires_at <= now() then
    raise exception 'Assistant run is no longer active.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = run_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'assistant-proposal:' || run_record.workspace_id::text || ':' ||
      target_user_id::text || ':' || target_idempotency_key,
      0
    )
  );

  select * into proposal_record
  from public.assistant_action_proposals
  where workspace_id = run_record.workspace_id
    and user_id = target_user_id
    and idempotency_key = target_idempotency_key;

  if found then
    return to_jsonb(proposal_record);
  end if;

  insert into public.assistant_action_proposals(
    workspace_id, thread_id, user_id, run_id, capability_id,
    arguments, preview, expected_record_updated_at, target_resource_type,
    target_resource_id, risk, status, idempotency_key, expires_at
  ) values (
    run_record.workspace_id, run_record.thread_id, target_user_id, run_record.id,
    target_capability_id, target_arguments, target_preview,
    target_expected_record_updated_at, target_resource_type,
    target_resource_id, target_risk, 'staged', target_idempotency_key, target_expires_at
  ) returning * into proposal_record;

  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type
  ) values (
    run_record.workspace_id, proposal_record.id, target_user_id,
    proposal_record.capability_id, proposal_record.target_resource_type,
    proposal_record.target_resource_id, 'proposed'
  );

  return to_jsonb(proposal_record);
end;
$$;

create or replace function public.cancel_assistant_action_proposal(
  target_proposal_id uuid,
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal_record public.assistant_action_proposals%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant actions are server-owned.' using errcode = '42501';
  end if;

  select * into proposal_record
  from public.assistant_action_proposals
  where id = target_proposal_id
    and user_id = target_user_id
  for update;

  if not found then
    raise exception 'Assistant action was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = proposal_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  if proposal_record.status <> 'pending' then
    return to_jsonb(proposal_record);
  end if;

  if proposal_record.expires_at <= now() then
    update public.assistant_action_proposals
    set status = 'expired', updated_at = now()
    where id = proposal_record.id
    returning * into proposal_record;

    insert into public.assistant_action_events(
      workspace_id, proposal_id, user_id, capability_id,
      target_resource_type, target_resource_id, event_type
    ) values (
      proposal_record.workspace_id, proposal_record.id, target_user_id,
      proposal_record.capability_id, proposal_record.target_resource_type,
      proposal_record.target_resource_id, 'expired'
    );
  else
    update public.assistant_action_proposals
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = proposal_record.id
    returning * into proposal_record;

    insert into public.assistant_action_events(
      workspace_id, proposal_id, user_id, capability_id,
      target_resource_type, target_resource_id, event_type
    ) values (
      proposal_record.workspace_id, proposal_record.id, target_user_id,
      proposal_record.capability_id, proposal_record.target_resource_type,
      proposal_record.target_resource_id, 'cancelled'
    );
  end if;

  return to_jsonb(proposal_record);
end;
$$;

create or replace function public.delete_assistant_thread(
  target_thread_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_record public.assistant_threads%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant conversations are server-owned.' using errcode = '42501';
  end if;

  select * into thread_record
  from public.assistant_threads
  where id = target_thread_id
    and created_by_user_id = target_user_id
  for update;

  if not found then
    return false;
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = thread_record.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  with cancelled as (
    update public.assistant_action_proposals proposal
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where proposal.workspace_id = thread_record.workspace_id
      and proposal.thread_id = thread_record.id
      and proposal.user_id = target_user_id
      and proposal.status in ('staged', 'pending')
    returning proposal.workspace_id, proposal.id, proposal.user_id,
      proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
  )
  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type, safe_code
  )
  select workspace_id, id, user_id, capability_id,
    target_resource_type, target_resource_id, 'cancelled', 'assistant_thread_deleted'
  from cancelled;

  delete from public.assistant_threads
  where id = thread_record.id
    and workspace_id = thread_record.workspace_id
    and created_by_user_id = target_user_id;

  return found;
end;
$$;

create or replace function public.recover_stale_assistant_state(
  batch_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_run_ids uuid[] := '{}'::uuid[];
  expired_run_count integer := 0;
  expired_run_proposal_count integer := 0;
  expired_proposal_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant recovery is server-owned.' using errcode = '42501';
  end if;

  if batch_limit < 1 or batch_limit > 500 then
    raise exception 'Assistant recovery limit is invalid.' using errcode = '22023';
  end if;

  select coalesce(array_agg(stale_run.id), '{}'::uuid[])
  into expired_run_ids
  from (
    select id
    from public.assistant_runs
    where status = 'running'
      and lease_expires_at <= now()
    order by lease_expires_at
    for update skip locked
    limit batch_limit
  ) stale_run;

  update public.assistant_runs run
  set status = 'failed',
      safe_error_code = 'assistant_run_expired',
      completed_at = now(),
      updated_at = now()
  where run.id = any(expired_run_ids);
  get diagnostics expired_run_count = row_count;

  with expired as (
    update public.assistant_action_proposals proposal
    set status = 'expired', updated_at = now()
    where proposal.status in ('staged', 'pending')
      and proposal.run_id = any(expired_run_ids)
    returning proposal.workspace_id, proposal.id, proposal.user_id,
      proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
  )
  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type, safe_code
  )
  select workspace_id, id, user_id, capability_id,
    target_resource_type, target_resource_id, 'expired', 'assistant_run_expired'
  from expired;
  get diagnostics expired_run_proposal_count = row_count;

  with stale_proposals as (
    select id
    from public.assistant_action_proposals
    where status in ('staged', 'pending')
      and expires_at <= now()
    order by expires_at
    for update skip locked
    limit batch_limit
  ), expired as (
    update public.assistant_action_proposals proposal
    set status = 'expired', updated_at = now()
    from stale_proposals
    where proposal.id = stale_proposals.id
    returning proposal.workspace_id, proposal.id, proposal.user_id,
      proposal.capability_id, proposal.target_resource_type, proposal.target_resource_id
  )
  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id, event_type
  )
  select workspace_id, id, user_id, capability_id,
    target_resource_type, target_resource_id, 'expired'
  from expired;
  get diagnostics expired_proposal_count = row_count;

  delete from public.assistant_voice_token_grants
  where issued_at < now() - interval '24 hours';

  delete from public.assistant_turn_rate_ledger
  where created_at < now() - interval '24 hours';

  return jsonb_build_object(
    'expiredRuns', expired_run_count,
    'expiredProposals', expired_run_proposal_count + expired_proposal_count
  );
end;
$$;

create or replace function public.claim_assistant_voice_token_grant(
  target_user_id uuid,
  target_workspace_id uuid,
  grant_limit integer default 12,
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
  if auth.role() <> 'service_role' then
    raise exception 'Assistant voice grants are server-owned.' using errcode = '42501';
  end if;

  if grant_limit < 1 or grant_limit > 60
     or window_seconds < 60 or window_seconds > 3600 then
    return false;
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = target_user_id
  ) then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('assistant-voice:' || target_workspace_id::text || ':' || target_user_id::text, 0)
  );

  delete from public.assistant_voice_token_grants
  where issued_at < now() - interval '24 hours';

  select count(*)::integer into recent_grant_count
  from public.assistant_voice_token_grants
  where workspace_id = target_workspace_id
    and user_id = target_user_id
    and issued_at >= now() - make_interval(secs => window_seconds);

  if recent_grant_count >= grant_limit then
    return false;
  end if;

  insert into public.assistant_voice_token_grants(workspace_id, user_id)
  values (target_workspace_id, target_user_id);

  return true;
end;
$$;

create or replace function public.execute_assistant_action_proposal(
  target_proposal_id uuid,
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal public.assistant_action_proposals%rowtype;
  values_object jsonb;
  result_id uuid;
  result_type text;
  result_updated_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant actions are server-owned.' using errcode = '42501';
  end if;

  select * into proposal
  from public.assistant_action_proposals
  where id = target_proposal_id
  for update;

  if not found or proposal.user_id <> target_user_id then
    raise exception 'Assistant action was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = proposal.workspace_id
      and member.user_id = target_user_id
  ) then
    raise exception 'User cannot access this workspace.' using errcode = '42501';
  end if;

  if proposal.status = 'completed' then
    return jsonb_build_object(
      'proposalId', proposal.id,
      'status', proposal.status,
      'resourceType', proposal.result_resource_type,
      'resourceId', proposal.result_resource_id,
      'executedAt', proposal.executed_at
    );
  end if;

  if proposal.status <> 'pending' then
    raise exception 'Assistant action is no longer available.' using errcode = '55000';
  end if;

  if proposal.expires_at <= now() then
    update public.assistant_action_proposals
    set status = 'expired', updated_at = now()
    where id = proposal.id;
    insert into public.assistant_action_events(
      workspace_id, proposal_id, user_id, capability_id,
      target_resource_type, target_resource_id, event_type
    ) values (
      proposal.workspace_id, proposal.id, target_user_id, proposal.capability_id,
      proposal.target_resource_type, proposal.target_resource_id, 'expired'
    );
    return jsonb_build_object(
      'proposalId', proposal.id,
      'status', 'expired'
    );
  end if;

  values_object := coalesce(proposal.arguments -> 'values', '{}'::jsonb);

  if proposal.capability_id = 'create_account' then
    insert into public.accounts (
      id, workspace_id, name, website, industry, employee_count, region, currency,
      owner_user_id, current_tools, strategic_initiatives, competitors, notes
    ) values (
      (proposal.arguments ->> 'newId')::uuid,
      proposal.workspace_id,
      values_object ->> 'name',
      values_object ->> 'website',
      values_object ->> 'industry',
      values_object ->> 'employeeCount',
      coalesce(values_object ->> 'region', 'Australia'),
      coalesce(
        values_object ->> 'currency',
        (select workspace.default_currency from public.workspaces workspace where workspace.id = proposal.workspace_id),
        'AUD'
      ),
      target_user_id,
      values_object ->> 'currentTools',
      values_object ->> 'strategicInitiatives',
      values_object ->> 'competitors',
      values_object ->> 'notes'
    ) returning id, updated_at into result_id, result_updated_at;
    result_type := 'account';

  elsif proposal.capability_id = 'update_account' then
    update public.accounts account
    set name = coalesce(values_object ->> 'name', account.name),
        website = case when values_object ? 'website' then values_object ->> 'website' else account.website end,
        industry = case when values_object ? 'industry' then values_object ->> 'industry' else account.industry end,
        employee_count = case when values_object ? 'employeeCount' then values_object ->> 'employeeCount' else account.employee_count end,
        region = coalesce(values_object ->> 'region', account.region),
        currency = coalesce(values_object ->> 'currency', account.currency),
        current_tools = case when values_object ? 'currentTools' then values_object ->> 'currentTools' else account.current_tools end,
        strategic_initiatives = case when values_object ? 'strategicInitiatives' then values_object ->> 'strategicInitiatives' else account.strategic_initiatives end,
        competitors = case when values_object ? 'competitors' then values_object ->> 'competitors' else account.competitors end,
        notes = case when values_object ? 'notes' then values_object ->> 'notes' else account.notes end,
        updated_at = now()
    where account.id = proposal.target_resource_id
      and account.workspace_id = proposal.workspace_id
      and account.updated_at = proposal.expected_record_updated_at
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'account';

  elsif proposal.capability_id = 'archive_account' then
    update public.accounts account
    set archived_at = now(), archived_by = target_user_id,
        archive_reason = nullif(btrim(values_object ->> 'reason'), ''), updated_at = now()
    where account.id = proposal.target_resource_id
      and account.workspace_id = proposal.workspace_id
      and account.updated_at = proposal.expected_record_updated_at
      and account.archived_at is null
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'account';

  elsif proposal.capability_id = 'create_opportunity' then
    perform 1
    from public.accounts account
    where account.id = (proposal.arguments ->> 'accountId')::uuid
      and account.workspace_id = proposal.workspace_id
      and account.archived_at is null
    for update;
    if not found then
      raise exception 'Parent account changed before the assistant action was confirmed.' using errcode = '40001';
    end if;

    insert into public.opportunities (
      id, workspace_id, account_id, name, stage, amount, close_date,
      close_date_note, owner_user_id, source, pain, decision_process, next_step,
      manual_notes, call_type
    ) values (
      (proposal.arguments ->> 'newId')::uuid,
      proposal.workspace_id,
      (proposal.arguments ->> 'accountId')::uuid,
      values_object ->> 'name',
      coalesce(values_object ->> 'stage', 'Discovery'),
      values_object ->> 'amount',
      nullif(values_object ->> 'closeDate', '')::date,
      values_object ->> 'closeDateNote',
      target_user_id,
      values_object ->> 'source',
      values_object ->> 'pain',
      values_object ->> 'decisionProcess',
      values_object ->> 'nextStep',
      values_object ->> 'manualNotes',
      coalesce(values_object ->> 'callType', 'Discovery')
    ) returning id, updated_at into result_id, result_updated_at;
    result_type := 'opportunity';

  elsif proposal.capability_id = 'update_opportunity' then
    update public.opportunities opportunity
    set name = coalesce(values_object ->> 'name', opportunity.name),
        stage = coalesce(values_object ->> 'stage', opportunity.stage),
        amount = case when values_object ? 'amount' then values_object ->> 'amount' else opportunity.amount end,
        close_date = case when values_object ? 'closeDate' then nullif(values_object ->> 'closeDate', '')::date else opportunity.close_date end,
        close_date_note = case when values_object ? 'closeDateNote' then values_object ->> 'closeDateNote' else opportunity.close_date_note end,
        source = case when values_object ? 'source' then values_object ->> 'source' else opportunity.source end,
        pain = case when values_object ? 'pain' then values_object ->> 'pain' else opportunity.pain end,
        decision_process = case when values_object ? 'decisionProcess' then values_object ->> 'decisionProcess' else opportunity.decision_process end,
        next_step = case when values_object ? 'nextStep' then values_object ->> 'nextStep' else opportunity.next_step end,
        manual_notes = case when values_object ? 'manualNotes' then values_object ->> 'manualNotes' else opportunity.manual_notes end,
        call_type = coalesce(values_object ->> 'callType', opportunity.call_type),
        updated_at = now()
    where opportunity.id = proposal.target_resource_id
      and opportunity.workspace_id = proposal.workspace_id
      and opportunity.updated_at = proposal.expected_record_updated_at
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'opportunity';

  elsif proposal.capability_id = 'archive_opportunity' then
    update public.opportunities opportunity
    set archived_at = now(), archived_by = target_user_id,
        archive_reason = nullif(btrim(values_object ->> 'reason'), ''), updated_at = now()
    where opportunity.id = proposal.target_resource_id
      and opportunity.workspace_id = proposal.workspace_id
      and opportunity.updated_at = proposal.expected_record_updated_at
      and opportunity.archived_at is null
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'opportunity';

  elsif proposal.capability_id = 'create_contact' then
    perform 1
    from public.accounts account
    where account.id = (proposal.arguments ->> 'accountId')::uuid
      and account.workspace_id = proposal.workspace_id
      and account.archived_at is null
    for update;
    if not found then
      raise exception 'Parent account changed before the assistant action was confirmed.' using errcode = '40001';
    end if;

    insert into public.contacts (
      id, workspace_id, account_id, full_name, preferred_name, job_title,
      department, seniority, work_email, business_phone, linkedin_url, location,
      timezone, employment_status, private_notes, source, created_by_user_id,
      updated_by_user_id
    ) values (
      (proposal.arguments ->> 'newId')::uuid,
      proposal.workspace_id,
      (proposal.arguments ->> 'accountId')::uuid,
      values_object ->> 'fullName',
      values_object ->> 'preferredName',
      values_object ->> 'jobTitle',
      values_object ->> 'department',
      values_object ->> 'seniority',
      values_object ->> 'workEmail',
      values_object ->> 'businessPhone',
      values_object ->> 'linkedinUrl',
      values_object ->> 'location',
      values_object ->> 'timezone',
      coalesce(values_object ->> 'employmentStatus', 'active'),
      values_object ->> 'privateNotes',
      'manual',
      target_user_id,
      target_user_id
    ) returning id, updated_at into result_id, result_updated_at;
    result_type := 'contact';

  elsif proposal.capability_id = 'update_contact' then
    update public.contacts contact
    set full_name = coalesce(values_object ->> 'fullName', contact.full_name),
        preferred_name = case when values_object ? 'preferredName' then values_object ->> 'preferredName' else contact.preferred_name end,
        job_title = case when values_object ? 'jobTitle' then values_object ->> 'jobTitle' else contact.job_title end,
        department = case when values_object ? 'department' then values_object ->> 'department' else contact.department end,
        seniority = case when values_object ? 'seniority' then values_object ->> 'seniority' else contact.seniority end,
        work_email = case when values_object ? 'workEmail' then values_object ->> 'workEmail' else contact.work_email end,
        business_phone = case when values_object ? 'businessPhone' then values_object ->> 'businessPhone' else contact.business_phone end,
        linkedin_url = case when values_object ? 'linkedinUrl' then values_object ->> 'linkedinUrl' else contact.linkedin_url end,
        location = case when values_object ? 'location' then values_object ->> 'location' else contact.location end,
        timezone = case when values_object ? 'timezone' then values_object ->> 'timezone' else contact.timezone end,
        employment_status = coalesce(values_object ->> 'employmentStatus', contact.employment_status),
        private_notes = case when values_object ? 'privateNotes' then values_object ->> 'privateNotes' else contact.private_notes end,
        updated_by_user_id = target_user_id,
        updated_at = now()
    where contact.id = proposal.target_resource_id
      and contact.workspace_id = proposal.workspace_id
      and contact.updated_at = proposal.expected_record_updated_at
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'contact';

  elsif proposal.capability_id = 'archive_contact' then
    update public.contacts contact
    set archived_at = now(), archived_by = target_user_id,
        archive_reason = nullif(btrim(values_object ->> 'reason'), ''),
        updated_by_user_id = target_user_id, updated_at = now()
    where contact.id = proposal.target_resource_id
      and contact.workspace_id = proposal.workspace_id
      and contact.updated_at = proposal.expected_record_updated_at
      and contact.archived_at is null
    returning id, updated_at into result_id, result_updated_at;
    result_type := 'contact';

  else
    raise exception 'Assistant capability is not supported.' using errcode = '22023';
  end if;

  if result_id is null then
    raise exception 'Record changed before the assistant action was confirmed.' using errcode = '40001';
  end if;

  update public.assistant_action_proposals
  set status = 'completed',
      confirmed_at = now(),
      executed_at = now(),
      result_resource_type = result_type,
      result_resource_id = result_id,
      updated_at = now()
  where id = proposal.id;

  insert into public.assistant_action_events(
    workspace_id, proposal_id, user_id, capability_id,
    target_resource_type, target_resource_id,
    result_resource_type, result_resource_id, event_type
  )
  values
    (
      proposal.workspace_id, proposal.id, target_user_id, proposal.capability_id,
      proposal.target_resource_type, proposal.target_resource_id,
      result_type, result_id, 'confirmed'
    ),
    (
      proposal.workspace_id, proposal.id, target_user_id, proposal.capability_id,
      proposal.target_resource_type, proposal.target_resource_id,
      result_type, result_id, 'completed'
    );

  return jsonb_build_object(
    'proposalId', proposal.id,
    'status', 'completed',
    'resourceType', result_type,
    'resourceId', result_id,
    'updatedAt', result_updated_at,
    'executedAt', now()
  );
end;
$$;

alter table public.assistant_threads enable row level security;
alter table public.workspace_member_preferences enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_turn_rate_ledger enable row level security;
alter table public.assistant_action_proposals enable row level security;
alter table public.assistant_action_events enable row level security;
alter table public.assistant_message_references enable row level security;
alter table public.assistant_voice_token_grants enable row level security;

create policy "Users can read their own assistant threads"
on public.assistant_threads for select to authenticated
using (
  created_by_user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own workspace preferences"
on public.workspace_member_preferences for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own assistant messages"
on public.assistant_messages for select to authenticated
using (
  owner_user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own assistant runs"
on public.assistant_runs for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own assistant proposals"
on public.assistant_action_proposals for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own assistant action events"
on public.assistant_action_events for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

create policy "Users can read their own assistant references"
on public.assistant_message_references for select to authenticated
using (
  owner_user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);

revoke all on table public.assistant_threads from public, anon, authenticated;
revoke all on table public.workspace_member_preferences from public, anon, authenticated;
revoke all on table public.assistant_messages from public, anon, authenticated;
revoke all on table public.assistant_runs from public, anon, authenticated;
revoke all on table public.assistant_turn_rate_ledger from public, anon, authenticated;
revoke all on table public.assistant_action_proposals from public, anon, authenticated;
revoke all on table public.assistant_action_events from public, anon, authenticated;
revoke all on table public.assistant_message_references from public, anon, authenticated;
revoke all on table public.assistant_voice_token_grants from public, anon, authenticated;

grant select on table public.assistant_threads to authenticated;
grant select on table public.workspace_member_preferences to authenticated;
grant select on table public.assistant_messages to authenticated;
grant select on table public.assistant_runs to authenticated;
grant select on table public.assistant_action_proposals to authenticated;
grant select on table public.assistant_action_events to authenticated;
grant select on table public.assistant_message_references to authenticated;

revoke all on function public.claim_assistant_voice_token_grant(uuid, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.clear_archived_assistant_thread_preference()
  from public, anon, authenticated;
revoke all on function public.ensure_assistant_default_thread(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.begin_assistant_run(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_assistant_run(uuid, uuid, text, integer, integer, integer, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_assistant_run(uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.renew_assistant_run_lease(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_assistant_action_proposal(uuid, uuid, text, jsonb, jsonb, timestamptz, text, uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cancel_assistant_action_proposal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_assistant_thread(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.recover_stale_assistant_state(integer)
  from public, anon, authenticated;
revoke all on function public.execute_assistant_action_proposal(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_assistant_voice_token_grant(uuid, uuid, integer, integer)
  to service_role;
grant execute on function public.ensure_assistant_default_thread(uuid, uuid)
  to service_role;
grant execute on function public.begin_assistant_run(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.complete_assistant_run(uuid, uuid, text, integer, integer, integer, integer, jsonb)
  to service_role;
grant execute on function public.fail_assistant_run(uuid, uuid, text, integer, integer)
  to service_role;
grant execute on function public.renew_assistant_run_lease(uuid, uuid)
  to service_role;
grant execute on function public.create_assistant_action_proposal(uuid, uuid, text, jsonb, jsonb, timestamptz, text, uuid, text, text, timestamptz)
  to service_role;
grant execute on function public.cancel_assistant_action_proposal(uuid, uuid)
  to service_role;
grant execute on function public.delete_assistant_thread(uuid, uuid)
  to service_role;
grant execute on function public.recover_stale_assistant_state(integer)
  to service_role;
grant execute on function public.execute_assistant_action_proposal(uuid, uuid)
  to service_role;
