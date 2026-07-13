-- Durable native artifacts, thread context, workflow steps, and task references
-- for Conversation Mode. Authenticated clients may read only their own rows
-- while an active workspace session exists; every mutation remains server-owned.
--
-- Rollback: disable native Conversation Mode artifacts, deploy a reader that no
-- longer depends on these relations, then drop the functions and tables below.
-- This migration is additive and does not rewrite CRM or conversation content.

alter table public.contacts
  add constraint contacts_workspace_id_key unique (workspace_id, id);

create table public.assistant_artifacts (
  id uuid primary key,
  workspace_id uuid not null,
  thread_id uuid not null,
  owner_user_id uuid not null,
  message_id uuid not null,
  kind text not null check (
    kind in ('collection', 'record', 'summary', 'relationship', 'evidence', 'form', 'workflow', 'task')
  ),
  schema_version smallint not null default 1 check (schema_version = 1),
  position smallint not null check (position between 0 and 15),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  status text check (
    status is null or status in ('ready', 'loading', 'stale', 'queued', 'running', 'completed', 'failed')
  ),
  data jsonb not null default '{}'::jsonb check (
    jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, owner_user_id, thread_id, id),
  unique (workspace_id, owner_user_id, thread_id, message_id, id),
  unique (message_id, position),
  foreign key (workspace_id, owner_user_id, thread_id, message_id)
    references public.assistant_messages(workspace_id, owner_user_id, thread_id, id)
    on delete cascade
);

create index assistant_artifacts_message_position_idx
  on public.assistant_artifacts(message_id, position);

create table public.assistant_artifact_actions (
  id uuid primary key,
  workspace_id uuid not null,
  thread_id uuid not null,
  owner_user_id uuid not null,
  artifact_id uuid not null,
  position smallint not null check (position between 0 and 63),
  record_key text check (record_key is null or char_length(record_key) between 1 and 160),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  capability_id text not null check (char_length(btrim(capability_id)) between 1 and 120),
  behavior text not null check (
    behavior in ('open_artifact', 'open_form', 'submit_prompt', 'prepare_action', 'secure_handoff')
  ),
  risk text not null default 'none' check (risk in ('none', 'standard', 'costed', 'destructive')),
  prompt text check (prompt is null or char_length(prompt) <= 2000),
  target_artifact_id uuid,
  target_account_id uuid,
  target_opportunity_id uuid,
  target_contact_id uuid,
  target_call_id uuid,
  created_at timestamptz not null default now(),
  unique (artifact_id, position),
  foreign key (workspace_id, owner_user_id, thread_id, artifact_id)
    references public.assistant_artifacts(workspace_id, owner_user_id, thread_id, id)
    on delete cascade,
  foreign key (workspace_id, owner_user_id, thread_id, target_artifact_id)
    references public.assistant_artifacts(workspace_id, owner_user_id, thread_id, id)
    on delete cascade,
  -- Domain target IDs are immutable tombstone references. They are validated
  -- on creation and every use, but deliberately have no foreign keys so
  -- conversation history cannot block CRM deletion/privacy workflows.
  check (
    behavior <> 'open_artifact' or target_artifact_id is not null or prompt is not null
  )
);

create table public.assistant_thread_context (
  workspace_id uuid not null,
  thread_id uuid not null,
  owner_user_id uuid not null,
  account_id uuid,
  opportunity_id uuid,
  contact_id uuid,
  call_id uuid,
  last_artifact_id uuid,
  source text not null check (source in ('explicit', 'selection', 'route', 'thread')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, owner_user_id, thread_id),
  foreign key (workspace_id, owner_user_id, thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete cascade,
  foreign key (workspace_id, account_id)
    references public.accounts(workspace_id, id)
    on delete set null (account_id),
  foreign key (workspace_id, opportunity_id)
    references public.opportunities(workspace_id, id)
    on delete set null (opportunity_id),
  foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id)
    on delete set null (contact_id),
  foreign key (workspace_id, call_id)
    references public.calls(workspace_id, id)
    on delete set null (call_id),
  foreign key (workspace_id, owner_user_id, thread_id, last_artifact_id)
    references public.assistant_artifacts(workspace_id, owner_user_id, thread_id, id)
    on delete set null (last_artifact_id)
);

create table public.assistant_action_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  user_id uuid not null,
  proposal_id uuid not null,
  position smallint not null check (position between 0 and 31),
  capability_id text not null check (char_length(btrim(capability_id)) between 1 and 120),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  risk text not null default 'standard' check (risk in ('none', 'standard', 'costed', 'destructive')),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  arguments jsonb not null default '{}'::jsonb check (
    jsonb_typeof(arguments) = 'object' and octet_length(arguments::text) <= 12000
  ),
  preview jsonb not null default '{}'::jsonb check (
    jsonb_typeof(preview) = 'object' and octet_length(preview::text) <= 12000
  ),
  result_resource_type text check (
    result_resource_type is null or result_resource_type in ('account', 'opportunity', 'contact', 'call')
  ),
  result_resource_id uuid,
  safe_error_code text check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,120}$'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, position),
  unique (workspace_id, user_id, thread_id, proposal_id, id),
  foreign key (workspace_id, user_id, thread_id, proposal_id)
    references public.assistant_action_proposals(workspace_id, user_id, thread_id, id)
    on delete cascade,
  check ((result_resource_type is null) = (result_resource_id is null))
);

create table public.assistant_task_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  user_id uuid not null,
  proposal_id uuid,
  step_id uuid,
  artifact_id uuid,
  task_type text not null check (char_length(btrim(task_type)) between 1 and 80),
  task_id text not null check (
    char_length(btrim(task_id)) between 1 and 160
    and task_id ~ '^[A-Za-z0-9:_-]+$'
  ),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  progress smallint check (progress is null or progress between 0 and 100),
  detail text check (detail is null or char_length(detail) <= 1000),
  safe_error_code text check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,120}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, thread_id, task_type, task_id),
  foreign key (workspace_id, user_id, thread_id)
    references public.assistant_threads(workspace_id, created_by_user_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, proposal_id)
    references public.assistant_action_proposals(workspace_id, user_id, thread_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, proposal_id, step_id)
    references public.assistant_action_steps(workspace_id, user_id, thread_id, proposal_id, id)
    on delete cascade,
  foreign key (workspace_id, user_id, thread_id, artifact_id)
    references public.assistant_artifacts(workspace_id, owner_user_id, thread_id, id)
    on delete set null (artifact_id),
  check (step_id is null or proposal_id is not null)
);

drop trigger if exists set_assistant_artifacts_updated_at on public.assistant_artifacts;
create trigger set_assistant_artifacts_updated_at
before update on public.assistant_artifacts
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_thread_context_updated_at on public.assistant_thread_context;
create trigger set_assistant_thread_context_updated_at
before update on public.assistant_thread_context
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_action_steps_updated_at on public.assistant_action_steps;
create trigger set_assistant_action_steps_updated_at
before update on public.assistant_action_steps
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_task_references_updated_at on public.assistant_task_references;
create trigger set_assistant_task_references_updated_at
before update on public.assistant_task_references
for each row execute function public.set_updated_at();

create or replace function public.assistant_artifact_target_is_valid(
  target_workspace_id uuid,
  target_account_id uuid,
  target_opportunity_id uuid,
  target_contact_id uuid,
  target_call_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (target_account_id is null or exists (
      select 1 from public.accounts account
      where account.workspace_id = target_workspace_id
        and account.id = target_account_id
        and account.archived_at is null
    ))
    and (target_opportunity_id is null or exists (
      select 1 from public.opportunities opportunity
      where opportunity.workspace_id = target_workspace_id
        and opportunity.id = target_opportunity_id
        and opportunity.archived_at is null
        and (target_account_id is null or opportunity.account_id = target_account_id)
    ))
    and (target_contact_id is null or exists (
      select 1 from public.contacts contact
      where contact.workspace_id = target_workspace_id
        and contact.id = target_contact_id
        and contact.archived_at is null
        and (target_account_id is null or contact.account_id = target_account_id)
    ))
    and (target_call_id is null or exists (
      select 1 from public.calls call_record
      where call_record.workspace_id = target_workspace_id
        and call_record.id = target_call_id
        and (target_account_id is null or call_record.account_id = target_account_id)
        and (target_opportunity_id is null or call_record.opportunity_id = target_opportunity_id)
    ))
    and (target_opportunity_id is null or target_contact_id is null or exists (
      select 1
      from public.opportunities opportunity
      join public.contacts contact
        on contact.workspace_id = opportunity.workspace_id
       and contact.account_id = opportunity.account_id
      where opportunity.workspace_id = target_workspace_id
        and opportunity.id = target_opportunity_id
        and contact.id = target_contact_id
        and opportunity.archived_at is null
        and contact.archived_at is null
    ))
    and (target_call_id is null or target_contact_id is null or exists (
      select 1
      from public.calls call_record
      join public.contacts contact
        on contact.workspace_id = call_record.workspace_id
       and contact.account_id = call_record.account_id
      where call_record.workspace_id = target_workspace_id
        and call_record.id = target_call_id
        and contact.id = target_contact_id
        and contact.archived_at is null
    ))
    and (target_call_id is null or target_opportunity_id is null or exists (
      select 1 from public.calls call_record
      where call_record.workspace_id = target_workspace_id
        and call_record.id = target_call_id
        and call_record.opportunity_id = target_opportunity_id
    ));
$$;

create or replace function public.set_assistant_thread_context(
  target_thread_id uuid,
  target_user_id uuid,
  target_account_id uuid,
  target_opportunity_id uuid,
  target_contact_id uuid,
  target_call_id uuid,
  target_last_artifact_id uuid,
  target_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_record public.assistant_threads%rowtype;
  context_record public.assistant_thread_context%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant context is server-owned.' using errcode = '42501';
  end if;
  if target_source not in ('explicit', 'selection', 'route', 'thread') then
    raise exception 'Assistant context source is invalid.' using errcode = '22023';
  end if;

  select * into thread_record from public.assistant_threads
  where id = target_thread_id and created_by_user_id = target_user_id and archived_at is null;
  if not found then
    raise exception 'Assistant conversation was not found.' using errcode = 'P0002';
  end if;
  if not public.assistant_artifact_target_is_valid(
    thread_record.workspace_id, target_account_id, target_opportunity_id, target_contact_id, target_call_id
  ) then
    raise exception 'Assistant context is inconsistent.' using errcode = '22023';
  end if;
  if target_last_artifact_id is not null and not exists (
    select 1 from public.assistant_artifacts artifact
    where artifact.id = target_last_artifact_id
      and artifact.workspace_id = thread_record.workspace_id
      and artifact.thread_id = thread_record.id
      and artifact.owner_user_id = target_user_id
  ) then
    raise exception 'Assistant context artifact is invalid.' using errcode = '22023';
  end if;

  insert into public.assistant_thread_context(
    workspace_id, thread_id, owner_user_id, account_id, opportunity_id,
    contact_id, call_id, last_artifact_id, source
  ) values (
    thread_record.workspace_id, thread_record.id, target_user_id, target_account_id,
    target_opportunity_id, target_contact_id, target_call_id, target_last_artifact_id, target_source
  ) on conflict (workspace_id, owner_user_id, thread_id) do update
  set account_id = excluded.account_id,
      opportunity_id = excluded.opportunity_id,
      contact_id = excluded.contact_id,
      call_id = excluded.call_id,
      last_artifact_id = excluded.last_artifact_id,
      source = excluded.source,
      updated_at = now()
  returning * into context_record;
  return to_jsonb(context_record);
end;
$$;

create or replace function public.complete_assistant_run_v2(
  target_run_id uuid,
  target_user_id uuid,
  target_content text,
  target_input_tokens integer,
  target_output_tokens integer,
  target_tool_rounds integer,
  target_read_operations integer,
  target_references jsonb default '[]'::jsonb,
  target_artifacts jsonb default '[]'::jsonb,
  target_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_message jsonb;
  run_record public.assistant_runs%rowtype;
  artifact_record jsonb;
  action_record jsonb;
  artifact_position integer;
  action_position integer;
  artifact_id uuid;
  action_id uuid;
  context_source text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant runs are server-owned.' using errcode = '42501';
  end if;
  if jsonb_typeof(target_artifacts) <> 'array'
     or jsonb_array_length(target_artifacts) > 12
     or jsonb_typeof(target_context) <> 'object'
     or octet_length(target_artifacts::text) > 262144
     or octet_length(target_context::text) > 4096 then
    raise exception 'Assistant artifacts are invalid.' using errcode = '22023';
  end if;

  result_message := public.complete_assistant_run(
    target_run_id, target_user_id, target_content, target_input_tokens,
    target_output_tokens, target_tool_rounds, target_read_operations, target_references
  );
  select * into run_record from public.assistant_runs
  where id = target_run_id and user_id = target_user_id;

  artifact_position := 0;
  for artifact_record in select value from jsonb_array_elements(target_artifacts)
  loop
    if coalesce(artifact_record ->> 'id', '') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (artifact_record ->> 'kind') not in (
         'collection', 'record', 'summary', 'relationship', 'evidence', 'form', 'workflow', 'task'
       )
       or coalesce((artifact_record ->> 'schemaVersion')::integer, 0) <> 1
       or char_length(btrim(coalesce(artifact_record ->> 'title', ''))) not between 1 and 160
       or jsonb_typeof(coalesce(artifact_record -> 'data', '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(artifact_record -> 'actions', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(artifact_record -> 'actions', '[]'::jsonb)) > 64 then
      raise exception 'Assistant artifact is invalid.' using errcode = '22023';
    end if;
    artifact_id := (artifact_record ->> 'id')::uuid;
    insert into public.assistant_artifacts(
      id, workspace_id, thread_id, owner_user_id, message_id, kind,
      schema_version, position, title, description, status, data
    ) values (
      artifact_id, run_record.workspace_id, run_record.thread_id, target_user_id,
      run_record.assistant_message_id, artifact_record ->> 'kind', 1, artifact_position,
      btrim(artifact_record ->> 'title'), nullif(artifact_record ->> 'description', ''),
      nullif(artifact_record ->> 'status', ''), coalesce(artifact_record -> 'data', '{}'::jsonb)
    ) on conflict (id) do nothing;
    artifact_position := artifact_position + 1;
  end loop;

  artifact_position := 0;
  for artifact_record in select value from jsonb_array_elements(target_artifacts)
  loop
    artifact_id := (artifact_record ->> 'id')::uuid;
    action_position := 0;
    for action_record in select value from jsonb_array_elements(coalesce(artifact_record -> 'actions', '[]'::jsonb))
    loop
      if coalesce(action_record ->> 'id', '') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or char_length(btrim(coalesce(action_record ->> 'label', ''))) not between 1 and 120
         or (action_record ->> 'capabilityId') not in (
           'workspace.search', 'workspace.switch', 'workspace.create', 'workspace.edit',
           'workspace.duplicate', 'workspace.import', 'workspace.import_accounts',
           'workspace.import_opportunities', 'workspace.onboarding', 'workspace.delete',
           'accounts.list', 'accounts.open', 'accounts.create', 'accounts.edit',
           'accounts.enrich', 'accounts.archive', 'accounts.restore', 'accounts.delete',
           'contacts.list', 'contacts.open', 'contacts.create', 'contacts.edit',
           'contacts.enrich', 'contacts.relationships', 'contacts.archive', 'contacts.restore',
           'opportunities.list', 'opportunities.open', 'opportunities.create',
           'opportunities.edit', 'opportunities.next_call', 'opportunities.methodology',
           'opportunities.contacts', 'opportunities.history', 'opportunities.archive',
           'opportunities.restore', 'opportunities.delete',
           'calls.list', 'calls.start', 'calls.open', 'calls.transcript', 'calls.notes',
           'calls.recording', 'calls.speakers', 'calls.outputs', 'calls.retry_outputs',
           'calls.feedback', 'calls.manual_question', 'calls.delete',
           'playbooks.list', 'playbooks.open', 'playbooks.create', 'playbooks.edit',
           'playbooks.assign', 'settings.open', 'settings.ai', 'settings.capture',
           'settings.retention', 'settings.session', 'settings.theme', 'settings.profile',
           'settings.billing', 'settings.support', 'settings.roadmap', 'settings.logout'
         )
         or ((action_record ->> 'capabilityId') in (
           'accounts.open', 'accounts.edit', 'accounts.enrich', 'accounts.archive', 'accounts.delete',
           'contacts.list', 'contacts.create', 'opportunities.create'
         ) and nullif(action_record #>> '{target,accountId}', '') is null)
         or ((action_record ->> 'capabilityId') in (
           'contacts.open', 'contacts.edit', 'contacts.enrich', 'contacts.archive'
         ) and nullif(action_record #>> '{target,contactId}', '') is null)
         or ((action_record ->> 'capabilityId') in (
           'contacts.relationships', 'opportunities.open', 'opportunities.edit',
           'opportunities.next_call', 'opportunities.methodology', 'opportunities.contacts',
           'opportunities.history', 'opportunities.archive', 'opportunities.delete',
           'playbooks.assign'
         ) and nullif(action_record #>> '{target,opportunityId}', '') is null)
         or ((action_record ->> 'capabilityId') in (
           'calls.open', 'calls.transcript', 'calls.notes', 'calls.recording',
           'calls.speakers', 'calls.outputs', 'calls.retry_outputs', 'calls.feedback',
           'calls.manual_question', 'calls.delete'
         ) and nullif(action_record #>> '{target,callId}', '') is null) then
        raise exception 'Assistant artifact action is invalid.' using errcode = '22023';
      end if;
      action_id := (action_record ->> 'id')::uuid;
      if not public.assistant_artifact_target_is_valid(
        run_record.workspace_id,
        nullif(action_record #>> '{target,accountId}', '')::uuid,
        nullif(action_record #>> '{target,opportunityId}', '')::uuid,
        nullif(action_record #>> '{target,contactId}', '')::uuid,
        nullif(action_record #>> '{target,callId}', '')::uuid
      ) then
        raise exception 'Assistant artifact action target is invalid.' using errcode = '22023';
      end if;
      insert into public.assistant_artifact_actions(
        id, workspace_id, thread_id, owner_user_id, artifact_id, position,
        record_key, label, capability_id, behavior, risk, prompt,
        target_artifact_id, target_account_id, target_opportunity_id,
        target_contact_id, target_call_id
      ) values (
        action_id, run_record.workspace_id, run_record.thread_id, target_user_id,
        artifact_id, action_position, nullif(action_record ->> 'recordId', ''),
        btrim(action_record ->> 'label'), btrim(action_record ->> 'capabilityId'),
        'secure_handoff', case
          when (action_record ->> 'capabilityId') in (
            'workspace.delete', 'accounts.delete', 'opportunities.delete', 'calls.delete'
          ) then 'destructive'
          when (action_record ->> 'capabilityId') in (
            'accounts.enrich', 'contacts.enrich', 'calls.retry_outputs'
          ) then 'costed'
          when (action_record ->> 'capabilityId') in (
            'workspace.create', 'workspace.edit', 'workspace.duplicate', 'workspace.import',
            'workspace.import_accounts', 'workspace.import_opportunities',
            'accounts.create', 'accounts.edit', 'accounts.archive', 'accounts.restore',
            'contacts.create', 'contacts.edit', 'contacts.relationships', 'contacts.archive',
            'contacts.restore', 'opportunities.create', 'opportunities.edit',
            'opportunities.archive', 'opportunities.restore', 'calls.start', 'calls.notes',
            'calls.speakers', 'calls.feedback', 'calls.manual_question', 'playbooks.create',
            'playbooks.edit', 'playbooks.assign', 'settings.ai', 'settings.capture',
            'settings.retention', 'settings.session', 'settings.theme', 'settings.profile',
            'settings.logout'
          ) then 'standard'
          else 'none'
        end,
        nullif(action_record ->> 'prompt', ''),
        nullif(action_record ->> 'artifactId', '')::uuid,
        nullif(action_record #>> '{target,accountId}', '')::uuid,
        nullif(action_record #>> '{target,opportunityId}', '')::uuid,
        nullif(action_record #>> '{target,contactId}', '')::uuid,
        nullif(action_record #>> '{target,callId}', '')::uuid
      ) on conflict (id) do nothing;
      action_position := action_position + 1;
    end loop;
    artifact_position := artifact_position + 1;
  end loop;

  if target_context <> '{}'::jsonb then
    context_source := coalesce(nullif(target_context ->> 'source', ''), 'thread');
    perform public.set_assistant_thread_context(
      run_record.thread_id, target_user_id,
      nullif(target_context ->> 'accountId', '')::uuid,
      nullif(target_context ->> 'opportunityId', '')::uuid,
      nullif(target_context ->> 'contactId', '')::uuid,
      nullif(target_context ->> 'callId', '')::uuid,
      nullif(target_context ->> 'artifactId', '')::uuid,
      context_source
    );
  end if;
  return result_message;
end;
$$;

create or replace function public.create_assistant_action_step(
  target_proposal_id uuid,
  target_user_id uuid,
  target_position integer,
  target_capability_id text,
  target_title text,
  target_risk text,
  target_arguments jsonb,
  target_preview jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal public.assistant_action_proposals%rowtype;
  step_record public.assistant_action_steps%rowtype;
  derived_risk text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant steps are server-owned.' using errcode = '42501';
  end if;
  select * into proposal from public.assistant_action_proposals
  where id = target_proposal_id and user_id = target_user_id
  for update;
  if not found then raise exception 'Assistant proposal was not found.' using errcode = 'P0002'; end if;
  if proposal.status <> 'staged' then
    raise exception 'Assistant proposal is no longer editable.' using errcode = '55000';
  end if;
  if target_capability_id not in (
    'create_account', 'update_account', 'archive_account',
    'create_opportunity', 'update_opportunity', 'archive_opportunity',
    'create_contact', 'update_contact', 'archive_contact'
  ) then
    raise exception 'Assistant step capability is invalid.' using errcode = '22023';
  end if;
  derived_risk := case when target_capability_id like 'archive_%' then 'destructive' else 'standard' end;
  if target_risk <> derived_risk then
    raise exception 'Assistant step risk is invalid.' using errcode = '22023';
  end if;
  if target_risk = 'destructive' and (
    target_position <> 0 or exists (
      select 1 from public.assistant_action_steps existing
      where existing.proposal_id = proposal.id and existing.position <> target_position
    )
  ) then
    raise exception 'Destructive assistant steps cannot be bundled.' using errcode = '22023';
  end if;
  if derived_risk <> 'destructive' and exists (
    select 1 from public.assistant_action_steps existing
    where existing.proposal_id = proposal.id and existing.risk = 'destructive'
  ) then
    raise exception 'Destructive assistant steps cannot be bundled.' using errcode = '22023';
  end if;
  insert into public.assistant_action_steps(
    workspace_id, thread_id, user_id, proposal_id, position,
    capability_id, title, risk, arguments, preview
  ) values (
    proposal.workspace_id, proposal.thread_id, target_user_id, proposal.id,
    target_position, target_capability_id, target_title, derived_risk,
    target_arguments, target_preview
  ) on conflict (proposal_id, position) do update
  set capability_id = excluded.capability_id, title = excluded.title,
      risk = excluded.risk, arguments = excluded.arguments,
      preview = excluded.preview, updated_at = now()
  returning * into step_record;

  -- The proposal is the seller-visible confirmation boundary. Keep its
  -- aggregate risk in lockstep with the staged steps so a destructive step
  -- can never be presented or confirmed as a standard action.
  update public.assistant_action_proposals target_proposal
  set risk = case
        when exists (
          select 1 from public.assistant_action_steps staged_step
          where staged_step.proposal_id = target_proposal.id
            and staged_step.risk = 'destructive'
        ) then 'destructive'
        when exists (
          select 1 from public.assistant_action_steps staged_step
          where staged_step.proposal_id = target_proposal.id
            and staged_step.risk = 'costed'
        ) then 'costed'
        else 'standard'
      end,
      updated_at = now()
  where target_proposal.id = proposal.id;

  return to_jsonb(step_record);
end;
$$;

create or replace function public.upsert_assistant_task_reference(
  target_thread_id uuid,
  target_user_id uuid,
  target_task_type text,
  target_task_id text,
  target_label text,
  target_status text,
  target_progress integer,
  target_detail text,
  target_proposal_id uuid default null,
  target_step_id uuid default null,
  target_artifact_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_record public.assistant_threads%rowtype;
  task_record public.assistant_task_references%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant tasks are server-owned.' using errcode = '42501';
  end if;
  select * into thread_record from public.assistant_threads
  where id = target_thread_id and created_by_user_id = target_user_id;
  if not found then raise exception 'Assistant conversation was not found.' using errcode = 'P0002'; end if;
  if target_proposal_id is not null and not exists (
    select 1 from public.assistant_action_proposals proposal
    where proposal.id = target_proposal_id
      and proposal.workspace_id = thread_record.workspace_id
      and proposal.thread_id = thread_record.id
      and proposal.user_id = target_user_id
  ) then
    raise exception 'Assistant task proposal is invalid.' using errcode = '22023';
  end if;
  if target_step_id is not null and not exists (
    select 1 from public.assistant_action_steps step_record
    where step_record.id = target_step_id
      and step_record.proposal_id = target_proposal_id
      and step_record.workspace_id = thread_record.workspace_id
      and step_record.thread_id = thread_record.id
      and step_record.user_id = target_user_id
  ) then
    raise exception 'Assistant task step is invalid.' using errcode = '22023';
  end if;
  if target_artifact_id is not null and not exists (
    select 1 from public.assistant_artifacts artifact
    where artifact.id = target_artifact_id
      and artifact.workspace_id = thread_record.workspace_id
      and artifact.thread_id = thread_record.id
      and artifact.owner_user_id = target_user_id
  ) then
    raise exception 'Assistant task artifact is invalid.' using errcode = '22023';
  end if;
  insert into public.assistant_task_references(
    workspace_id, thread_id, user_id, proposal_id, step_id, artifact_id,
    task_type, task_id, label, status, progress, detail
  ) values (
    thread_record.workspace_id, thread_record.id, target_user_id,
    target_proposal_id, target_step_id, target_artifact_id,
    target_task_type, target_task_id, target_label, target_status,
    target_progress, target_detail
  ) on conflict (workspace_id, user_id, thread_id, task_type, task_id) do update
  set status = excluded.status, progress = excluded.progress,
      detail = excluded.detail, artifact_id = coalesce(excluded.artifact_id, assistant_task_references.artifact_id),
      updated_at = now()
  returning * into task_record;
  return to_jsonb(task_record);
end;
$$;

alter table public.assistant_artifacts enable row level security;
alter table public.assistant_artifact_actions enable row level security;
alter table public.assistant_thread_context enable row level security;
alter table public.assistant_action_steps enable row level security;
alter table public.assistant_task_references enable row level security;

create policy "Users can read their own assistant artifacts"
on public.assistant_artifacts for select to authenticated
using (owner_user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

create policy "Users can read their own assistant artifact actions"
on public.assistant_artifact_actions for select to authenticated
using (owner_user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

create policy "Users can read their own assistant thread context"
on public.assistant_thread_context for select to authenticated
using (owner_user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

create policy "Users can read their own assistant action steps"
on public.assistant_action_steps for select to authenticated
using (user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

create policy "Users can read their own assistant task references"
on public.assistant_task_references for select to authenticated
using (user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

revoke all on table public.assistant_artifacts from public, anon, authenticated;
revoke all on table public.assistant_artifact_actions from public, anon, authenticated;
revoke all on table public.assistant_thread_context from public, anon, authenticated;
revoke all on table public.assistant_action_steps from public, anon, authenticated;
revoke all on table public.assistant_task_references from public, anon, authenticated;

grant select on table public.assistant_artifacts to authenticated;
grant select on table public.assistant_artifact_actions to authenticated;
grant select on table public.assistant_thread_context to authenticated;
grant select on table public.assistant_action_steps to authenticated;
grant select on table public.assistant_task_references to authenticated;

revoke all on function public.assistant_artifact_target_is_valid(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.set_assistant_thread_context(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_assistant_run_v2(uuid, uuid, text, integer, integer, integer, integer, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_assistant_action_step(uuid, uuid, integer, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.upsert_assistant_task_reference(uuid, uuid, text, text, text, text, integer, text, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.assistant_artifact_target_is_valid(uuid, uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.set_assistant_thread_context(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.complete_assistant_run_v2(uuid, uuid, text, integer, integer, integer, integer, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.create_assistant_action_step(uuid, uuid, integer, text, text, text, jsonb, jsonb)
  to service_role;
grant execute on function public.upsert_assistant_task_reference(uuid, uuid, text, text, text, text, integer, text, uuid, uuid, uuid)
  to service_role;
