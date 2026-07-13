-- Read-only production preflight for durable Conversation Mode action results.

do $$
begin
  if to_regclass('public.assistant_action_proposals') is null
     or to_regclass('public.assistant_runs') is null
     or to_regclass('public.assistant_messages') is null
     or to_regclass('public.assistant_artifacts') is null
     or to_regclass('public.assistant_artifact_actions') is null then
    raise exception 'Conversation Mode artifact prerequisites are missing.';
  end if;
  if to_regprocedure('public.assistant_artifact_target_is_valid(uuid,uuid,uuid,uuid,uuid)') is null then
    raise exception 'Assistant artifact target validation is missing.';
  end if;
end;
$$;

select
  count(*) filter (where run.assistant_message_id is null) as completed_actions_without_message,
  count(*) filter (
    where proposal.result_resource_type not in ('account', 'opportunity', 'contact')
       or proposal.result_resource_id is null
  ) as completed_actions_without_supported_result
from public.assistant_action_proposals proposal
join public.assistant_runs run on run.id = proposal.run_id
where proposal.status = 'completed';

select count(*) as proposal_id_artifact_collisions
from public.assistant_action_proposals proposal
join public.assistant_artifacts artifact on artifact.id = proposal.id
where artifact.workspace_id <> proposal.workspace_id
   or artifact.thread_id <> proposal.thread_id
   or artifact.owner_user_id <> proposal.user_id;
