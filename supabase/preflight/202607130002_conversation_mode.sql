-- Read-only production preflight for 202607130002_conversation_mode.sql.
-- Every BLOCKER query should return zero rows. Apply the migration to a
-- disposable or shadow database and exercise the RPCs before production.

-- BLOCKER: Conversation mode is an additive migration and must not overwrite
-- a partially created or unrelated object with the same name.
select object_name
from unnest(array[
  'assistant_threads',
  'workspace_member_preferences',
  'assistant_messages',
  'assistant_runs',
  'assistant_turn_rate_ledger',
  'assistant_action_proposals',
  'assistant_action_events',
  'assistant_message_references',
  'assistant_voice_token_grants'
]) as candidate(object_name)
where to_regclass('public.' || object_name) is not null;

-- BLOCKER: the migration relies on these existing tenant/session primitives.
select required_object
from unnest(array[
  'public.workspaces',
  'public.workspace_members',
  'public.accounts',
  'public.opportunities',
  'public.contacts',
  'public.calls',
  'public.transcript_segments'
]) as dependency(required_object)
where to_regclass(required_object) is null;

-- BLOCKER: these shared authorization/update functions must already exist.
select required_function
from unnest(array[
  'public.set_updated_at()',
  'public.is_workspace_member_with_active_session(uuid)'
]) as dependency(required_function)
where to_regprocedure(required_function) is null;

-- BLOCKER: confirmed account creation inherits the workspace currency.
select 'public.workspaces.default_currency' as missing_column
where not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'workspaces'
    and column_name = 'default_currency'
);

-- POST-MIGRATION VERIFICATION (run separately after authorization):
--
-- Authenticated users must receive SELECT only. This query must return zero rows.
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'authenticated'
--   and table_name in (
--     'assistant_threads', 'workspace_member_preferences', 'assistant_messages',
--     'assistant_runs', 'assistant_turn_rate_ledger',
--     'assistant_action_proposals', 'assistant_action_events',
--     'assistant_message_references', 'assistant_voice_token_grants'
--   )
--   and privilege_type <> 'SELECT';
--
-- No client role may invoke the service-owned mutation RPCs. This query must
-- return zero rows.
-- select routine_name, grantee, privilege_type
-- from information_schema.role_routine_grants
-- where specific_schema = 'public'
--   and grantee in ('public', 'anon', 'authenticated')
--   and routine_name in (
--     'begin_assistant_run', 'complete_assistant_run', 'fail_assistant_run',
--     'renew_assistant_run_lease', 'create_assistant_action_proposal',
--     'cancel_assistant_action_proposal', 'delete_assistant_thread',
--     'clear_archived_assistant_thread_preference',
--     'ensure_assistant_default_thread',
--     'recover_stale_assistant_state',
--     'claim_assistant_voice_token_grant', 'execute_assistant_action_proposal'
--   );
--
-- One user must never have more than one paid turn in flight per workspace.
-- select workspace_id, user_id, count(*)
-- from public.assistant_runs
-- where status = 'running'
-- group by workspace_id, user_id
-- having count(*) > 1;
--
-- Actionable proposals must belong only to completed assistant runs. This query
-- must return zero rows.
-- select proposal.id, proposal.run_id, proposal.status, run.status as run_status
-- from public.assistant_action_proposals proposal
-- join public.assistant_runs run on run.id = proposal.run_id
-- where proposal.status = 'pending'
--   and run.status <> 'completed';
