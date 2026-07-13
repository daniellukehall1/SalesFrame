-- Persist the record produced by a confirmed Conversation Mode action on the
-- assistant message that proposed it. This makes the result clickable and
-- replayable without trusting model-authored routes or targets.
--
-- Rollback: deploy the confirmation endpoint without result persistence, then
-- drop public.persist_assistant_action_result_artifact(uuid, uuid, jsonb).

create or replace function public.persist_assistant_action_result_artifact(
  target_proposal_id uuid,
  target_user_id uuid,
  target_artifact jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal_record public.assistant_action_proposals%rowtype;
  run_record public.assistant_runs%rowtype;
  existing_artifact public.assistant_artifacts%rowtype;
  action_record jsonb;
  artifact_position integer;
  expected_capability text;
  expected_risk text;
  action_id uuid;
  target_account_id uuid;
  target_opportunity_id uuid;
  target_contact_id uuid;
  target_call_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Assistant action results are server-owned.' using errcode = '42501';
  end if;
  if jsonb_typeof(target_artifact) <> 'object'
     or octet_length(target_artifact::text) > 70000 then
    raise exception 'Assistant action result is invalid.' using errcode = '22023';
  end if;

  select * into proposal_record
  from public.assistant_action_proposals
  where id = target_proposal_id
  for update;
  if not found
     or proposal_record.user_id <> target_user_id
     or proposal_record.status <> 'completed'
     or proposal_record.result_resource_type not in ('account', 'opportunity', 'contact')
     or proposal_record.result_resource_id is null then
    raise exception 'Assistant action result was not found.' using errcode = 'P0002';
  end if;

  select * into run_record
  from public.assistant_runs
  where id = proposal_record.run_id
    and workspace_id = proposal_record.workspace_id
    and thread_id = proposal_record.thread_id
    and user_id = target_user_id
    and assistant_message_id is not null;
  if not found then
    raise exception 'Assistant action message was not found.' using errcode = 'P0002';
  end if;

  -- Serialize position allocation for every result attached to this message.
  perform 1
  from public.assistant_messages
  where id = run_record.assistant_message_id
    and workspace_id = run_record.workspace_id
    and thread_id = run_record.thread_id
    and owner_user_id = target_user_id
  for update;
  if not found then
    raise exception 'Assistant action message was not found.' using errcode = 'P0002';
  end if;

  select * into existing_artifact
  from public.assistant_artifacts
  where id = target_proposal_id;
  if found then
    if existing_artifact.workspace_id <> proposal_record.workspace_id
       or existing_artifact.thread_id <> proposal_record.thread_id
       or existing_artifact.owner_user_id <> target_user_id
       or existing_artifact.message_id <> run_record.assistant_message_id then
      raise exception 'Assistant action result conflicts with another artifact.' using errcode = '23505';
    end if;
    return jsonb_build_object('artifactId', existing_artifact.id, 'created', false);
  end if;

  if coalesce(target_artifact ->> 'id', '') <> target_proposal_id::text
     or target_artifact ->> 'kind' <> 'record'
     or coalesce((target_artifact ->> 'schemaVersion')::integer, 0) <> 1
     or target_artifact ->> 'status' <> 'completed'
     or char_length(btrim(coalesce(target_artifact ->> 'title', ''))) not between 1 and 160
     or char_length(coalesce(target_artifact ->> 'description', '')) > 1000
     or jsonb_typeof(coalesce(target_artifact -> 'data', '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(target_artifact -> 'data', '{}'::jsonb)::text) > 65536
     or jsonb_typeof(target_artifact #> '{data,records}') <> 'array'
     or jsonb_array_length(target_artifact #> '{data,records}') <> 1
     or target_artifact #>> '{data,records,0,id}' <> proposal_record.result_resource_id::text
     or target_artifact #>> '{data,records,0,kind}' <> proposal_record.result_resource_type
     or jsonb_typeof(coalesce(target_artifact -> 'actions', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(target_artifact -> 'actions', '[]'::jsonb)) <> 1 then
    raise exception 'Assistant action result is invalid.' using errcode = '22023';
  end if;

  action_record := target_artifact #> '{actions,0}';
  expected_capability := case
    when proposal_record.capability_id like 'archive\_%' escape '\' then
      case proposal_record.result_resource_type
        when 'opportunity' then 'opportunities.restore'
        else proposal_record.result_resource_type || 's.restore'
      end
    else
      case proposal_record.result_resource_type
        when 'opportunity' then 'opportunities.open'
        else proposal_record.result_resource_type || 's.open'
      end
  end;
  expected_risk := case when expected_capability like '%.restore' then 'standard' else 'none' end;

  if coalesce(action_record ->> 'id', '') !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or action_record ->> 'recordId' <> proposal_record.result_resource_id::text
     or action_record ->> 'capabilityId' <> expected_capability
     or action_record ->> 'behavior' <> 'secure_handoff'
     or action_record ->> 'risk' <> expected_risk
     or char_length(btrim(coalesce(action_record ->> 'label', ''))) not between 1 and 120 then
    raise exception 'Assistant action result action is invalid.' using errcode = '22023';
  end if;

  if (nullif(action_record #>> '{target,accountId}', '') is not null
      and nullif(action_record #>> '{target,accountId}', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or (nullif(action_record #>> '{target,opportunityId}', '') is not null
      and nullif(action_record #>> '{target,opportunityId}', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or (nullif(action_record #>> '{target,contactId}', '') is not null
      and nullif(action_record #>> '{target,contactId}', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or (nullif(action_record #>> '{target,callId}', '') is not null
      and nullif(action_record #>> '{target,callId}', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'Assistant action result target is invalid.' using errcode = '22023';
  end if;

  action_id := (action_record ->> 'id')::uuid;
  target_account_id := nullif(action_record #>> '{target,accountId}', '')::uuid;
  target_opportunity_id := nullif(action_record #>> '{target,opportunityId}', '')::uuid;
  target_contact_id := nullif(action_record #>> '{target,contactId}', '')::uuid;
  target_call_id := nullif(action_record #>> '{target,callId}', '')::uuid;

  if expected_capability like '%.restore' then
    if target_account_id is not null or target_opportunity_id is not null
       or target_contact_id is not null or target_call_id is not null then
      raise exception 'Archived action result target is invalid.' using errcode = '22023';
    end if;
  elsif proposal_record.result_resource_type = 'account' then
    if target_account_id is distinct from proposal_record.result_resource_id
       or target_opportunity_id is not null or target_contact_id is not null or target_call_id is not null then
      raise exception 'Account action result target is invalid.' using errcode = '22023';
    end if;
  elsif proposal_record.result_resource_type = 'opportunity' then
    if target_account_id is null
       or target_opportunity_id is distinct from proposal_record.result_resource_id
       or target_contact_id is not null or target_call_id is not null then
      raise exception 'Opportunity action result target is invalid.' using errcode = '22023';
    end if;
  else
    if target_account_id is null
       or target_contact_id is distinct from proposal_record.result_resource_id
       or target_opportunity_id is not null or target_call_id is not null then
      raise exception 'Contact action result target is invalid.' using errcode = '22023';
    end if;
  end if;

  if expected_capability not like '%.restore'
     and not public.assistant_artifact_target_is_valid(
       proposal_record.workspace_id, target_account_id, target_opportunity_id,
       target_contact_id, target_call_id
     ) then
    raise exception 'Assistant action result target is inconsistent.' using errcode = '22023';
  end if;

  select slot into artifact_position
  from generate_series(0, 15) as slot
  where not exists (
    select 1 from public.assistant_artifacts artifact
    where artifact.message_id = run_record.assistant_message_id
      and artifact.position = slot
  )
  order by slot
  limit 1;
  if artifact_position is null then
    raise exception 'Assistant message has no room for another result.' using errcode = '54000';
  end if;

  insert into public.assistant_artifacts(
    id, workspace_id, thread_id, owner_user_id, message_id, kind,
    schema_version, position, title, description, status, data
  ) values (
    target_proposal_id, proposal_record.workspace_id, proposal_record.thread_id,
    target_user_id, run_record.assistant_message_id, 'record', 1,
    artifact_position, btrim(target_artifact ->> 'title'),
    nullif(target_artifact ->> 'description', ''), 'completed',
    target_artifact -> 'data'
  );

  insert into public.assistant_artifact_actions(
    id, workspace_id, thread_id, owner_user_id, artifact_id, position,
    record_key, label, capability_id, behavior, risk, prompt,
    target_artifact_id, target_account_id, target_opportunity_id,
    target_contact_id, target_call_id
  ) values (
    action_id, proposal_record.workspace_id, proposal_record.thread_id,
    target_user_id, target_proposal_id, 0,
    proposal_record.result_resource_id::text, btrim(action_record ->> 'label'),
    expected_capability, 'secure_handoff', expected_risk, null,
    null, target_account_id, target_opportunity_id, target_contact_id, target_call_id
  );

  return jsonb_build_object('artifactId', target_proposal_id, 'created', true);
end;
$$;

revoke all on function public.persist_assistant_action_result_artifact(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.persist_assistant_action_result_artifact(uuid, uuid, jsonb)
to service_role;
