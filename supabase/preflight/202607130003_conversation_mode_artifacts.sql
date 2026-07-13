-- Read-only production preflight for 202607130003_conversation_mode_artifacts.sql.
-- Every BLOCKER query must return zero rows before separately authorized apply.

select object_name
from unnest(array[
  'assistant_artifacts',
  'assistant_artifact_actions',
  'assistant_thread_context',
  'assistant_action_steps',
  'assistant_task_references'
]) as candidate(object_name)
where to_regclass('public.' || object_name) is not null;

select object_name
from unnest(array[
  'contacts_workspace_id_key',
  'assistant_artifacts_message_position_idx',
  'set_assistant_artifacts_updated_at',
  'set_assistant_thread_context_updated_at',
  'set_assistant_action_steps_updated_at',
  'set_assistant_task_references_updated_at'
]) as candidate(object_name)
where exists (
  select 1 from pg_class object_record where object_record.relname = candidate.object_name
  union all
  select 1 from pg_constraint constraint_record where constraint_record.conname = candidate.object_name
  union all
  select 1 from pg_trigger trigger_record where trigger_record.tgname = candidate.object_name
);

select function_name
from unnest(array[
  'public.assistant_artifact_target_is_valid(uuid,uuid,uuid,uuid,uuid)',
  'public.set_assistant_thread_context(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text)',
  'public.complete_assistant_run_v2(uuid,uuid,text,integer,integer,integer,integer,jsonb,jsonb,jsonb)',
  'public.create_assistant_action_step(uuid,uuid,integer,text,text,text,jsonb,jsonb)',
  'public.upsert_assistant_task_reference(uuid,uuid,text,text,text,text,integer,text,uuid,uuid,uuid)'
]) as candidate(function_name)
where to_regprocedure(candidate.function_name) is not null;

select required_object
from unnest(array[
  'public.assistant_threads',
  'public.assistant_messages',
  'public.assistant_runs',
  'public.assistant_action_proposals',
  'public.accounts',
  'public.opportunities',
  'public.contacts',
  'public.calls',
  'public.transcript_segments'
]) as dependency(required_object)
where to_regclass(required_object) is null;

select required_function
from unnest(array[
  'public.set_updated_at()',
  'public.is_workspace_member_with_active_session(uuid)',
  'public.complete_assistant_run(uuid,uuid,text,integer,integer,integer,integer,jsonb)'
]) as dependency(required_function)
where to_regprocedure(required_function) is null;

-- BLOCKER for the separately authorized search maintenance step: an existing
-- pg_trgm install must be resolvable through public/extensions, and interrupted
-- concurrent builds must be reviewed instead of silently reused.
select 'pg_trgm_schema_unexpected:' || namespace.nspname as blocker
from pg_extension extension_record
join pg_namespace namespace on namespace.oid = extension_record.extnamespace
where extension_record.extname = 'pg_trgm'
  and namespace.nspname not in ('public', 'extensions');

select index_record.relname as invalid_search_index
from pg_class index_record
join pg_index index_state on index_state.indexrelid = index_record.oid
where index_record.relname in (
  'assistant_accounts_name_trgm_idx',
  'assistant_accounts_website_trgm_idx',
  'assistant_opportunities_search_trgm_idx',
  'assistant_contacts_search_trgm_idx',
  'assistant_transcript_text_fts_idx'
)
and (not index_state.indisvalid or not index_state.indisready);

-- BLOCKER: expression indexes assume these source columns exist.
select expected.table_name || '.' || expected.column_name as missing_column
from (values
  ('accounts', 'archived_at'), ('accounts', 'name'), ('accounts', 'website'),
  ('opportunities', 'archived_at'), ('opportunities', 'name'), ('opportunities', 'stage'), ('opportunities', 'next_step'),
  ('contacts', 'archived_at'), ('contacts', 'full_name'), ('contacts', 'preferred_name'), ('contacts', 'job_title'), ('contacts', 'department'),
  ('transcript_segments', 'text'), ('transcript_segments', 'is_final')
) as expected(table_name, column_name)
where not exists (
  select 1 from information_schema.columns column_record
  where column_record.table_schema = 'public'
    and column_record.table_name = expected.table_name
    and column_record.column_name = expected.column_name
);

-- CAPACITY REVIEW: record these sizes before separately authorizing the
-- CONCURRENTLY maintenance script. Large relations need an explicit storage,
-- replica-lag, and runtime budget even though concurrent builds avoid blocking
-- normal writes.
select relation_name,
       pg_size_pretty(pg_total_relation_size(('public.' || relation_name)::regclass)) as total_size,
       coalesce(reltuples::bigint, 0) as estimated_rows
from unnest(array['accounts', 'opportunities', 'contacts', 'transcript_segments']) as relation_list(relation_name)
join pg_class on pg_class.oid = ('public.' || relation_list.relation_name)::regclass;

-- POST-MIGRATION VERIFICATION (run separately after authorization): authenticated
-- must have SELECT only on all five tables, client roles must have no EXECUTE on
-- the service-owned functions, and every artifact action target must satisfy
-- public.assistant_artifact_target_is_valid(...).
