-- Read-only preflight for the separately authorized, non-transactional search
-- index maintenance script. Every BLOCKER query must return zero rows.

-- BLOCKER: pg_trgm must be available. If installed already, its operator class
-- must be resolvable through the maintenance script's public/extensions path.
select 'pg_trgm_unavailable' as blocker
where not exists (select 1 from pg_available_extensions where name = 'pg_trgm');

select 'extensions_schema_missing' as blocker
where not exists (select 1 from pg_namespace where nspname = 'extensions')
  and not exists (select 1 from pg_extension where extname = 'pg_trgm');

select 'pg_trgm_schema_unexpected:' || namespace.nspname as blocker
from pg_extension extension_record
join pg_namespace namespace on namespace.oid = extension_record.extnamespace
where extension_record.extname = 'pg_trgm'
  and namespace.nspname not in ('public', 'extensions');

-- BLOCKER: a same-named invalid or differently-defined partial index requires
-- explicit cleanup/review before CREATE INDEX CONCURRENTLY IF NOT EXISTS.
-- A valid wrong-definition index is still a blocker because IF NOT EXISTS
-- would otherwise silently keep it.
with expected_index(index_name, table_name, expression_definition, predicate_definition) as (
  values
    (
      'assistant_accounts_name_trgm_idx',
      'accounts',
      'lower(name) gin_trgm_ops',
      'archived_atisnull'
    ),
    (
      'assistant_accounts_website_trgm_idx',
      'accounts',
      'lower(coalesce(website, '''')) gin_trgm_ops',
      'archived_atisnull'
    ),
    (
      'assistant_opportunities_search_trgm_idx',
      'opportunities',
      'lower(name || '' '' || coalesce(stage, '''') || '' '' || coalesce(next_step, '''')) gin_trgm_ops',
      'archived_atisnull'
    ),
    (
      'assistant_contacts_search_trgm_idx',
      'contacts',
      'lower(full_name || '' '' || coalesce(preferred_name, '''') || '' '' || coalesce(job_title, '''') || '' '' || coalesce(department, '''')) gin_trgm_ops',
      'archived_atisnull'
    ),
    (
      'assistant_transcript_text_fts_idx',
      'transcript_segments',
      'to_tsvector(''english'', coalesce(text, ''''))',
      'is_final=true'
    )
), existing_index as (
  select expected_index.*,
         index_record.relname as actual_index_name,
         table_record.relname as actual_table_name,
         table_namespace.nspname as actual_table_schema,
         access_method.amname as actual_access_method,
         index_state.indisvalid,
         index_state.indisready,
         pg_get_indexdef(index_state.indexrelid) as definition,
         regexp_replace(
           replace(replace(replace(replace(
             lower(pg_get_indexdef(index_state.indexrelid, 1, true)),
             'extensions.', ''), 'public.', ''), '::text', ''), '::regconfig', ''),
           '[[:space:]]+', ' ', 'g'
         ) as actual_expression,
         translate(
           lower(coalesce(pg_get_expr(index_state.indpred, index_state.indrelid, true), '')),
           E' \n\r\t()',
           ''
         ) as actual_predicate
  from expected_index
  join pg_namespace index_namespace on index_namespace.nspname = 'public'
  join pg_class index_record
    on index_record.relnamespace = index_namespace.oid
   and index_record.relname = expected_index.index_name
  join pg_index index_state on index_state.indexrelid = index_record.oid
  join pg_class table_record on table_record.oid = index_state.indrelid
  join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
  join pg_am access_method on access_method.oid = index_record.relam
)
select actual_index_name as conflicting_index,
       definition,
       indisvalid,
       indisready,
       concat_ws(', ',
         case when actual_table_schema <> 'public' or actual_table_name <> table_name then 'wrong table' end,
         case when actual_access_method <> 'gin' then 'wrong access method' end,
         case when actual_expression <> expression_definition then 'wrong expression' end,
         case
           when predicate_definition = 'is_final=true'
             and actual_predicate not in ('is_final=true', 'is_final') then 'wrong predicate'
           when predicate_definition <> 'is_final=true'
             and actual_predicate <> predicate_definition then 'wrong predicate'
         end,
         case when not indisvalid then 'invalid' end,
         case when not indisready then 'not ready' end
       ) as conflict_reason
from existing_index
where actual_table_schema <> 'public'
   or actual_table_name <> table_name
   or actual_access_method <> 'gin'
   or actual_expression <> expression_definition
   or (
     predicate_definition = 'is_final=true'
     and actual_predicate not in ('is_final=true', 'is_final')
   )
   or (
     predicate_definition <> 'is_final=true'
     and actual_predicate <> predicate_definition
   )
   or not indisvalid
   or not indisready;

-- CAPACITY REVIEW: capture these values and set a storage/runtime/replica-lag
-- budget before authorizing each concurrent build.
select relation_list.relation_name,
       pg_size_pretty(pg_total_relation_size(('public.' || relation_list.relation_name)::regclass)) as total_size,
       coalesce(pg_class.reltuples::bigint, 0) as estimated_rows
from unnest(array['accounts', 'opportunities', 'contacts', 'transcript_segments']) as relation_list(relation_name)
join pg_class on pg_class.oid = ('public.' || relation_list.relation_name)::regclass;
