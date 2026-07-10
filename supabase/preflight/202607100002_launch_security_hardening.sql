-- Read-only checks for 202607100002_launch_security_hardening.sql.
-- Every query should return zero rows unless the query explicitly reports
-- grants for review. Do not automatically rewrite or delete flagged records.

-- ROLLOUT REVIEW: rows here are active calls that could still be running an
-- older browser bundle when the migration lands. This is an inventory, not an
-- error result. Deploy the compatible frontend/functions within the migration's
-- six-hour window. If that cannot be completed, extend the deadline with the
-- privileged operator step documented in QA_REPORT.md before it expires.
select
  workspace_id,
  count(*) as active_calls_without_recording_pointer,
  min(started_at) as earliest_started_at,
  max(started_at) as latest_started_at
from public.calls
where status = 'active'
  and ended_at is null
  and recording_storage_path is null
group by workspace_id
order by earliest_started_at asc;

select
  id,
  workspace_id,
  recording_storage_path,
  retention_expires_at
from public.calls
where recording_storage_path is not null
  and (
    public.workspace_id_from_storage_path(recording_storage_path)
      is distinct from workspace_id
    or public.call_id_from_storage_path(recording_storage_path)
      is distinct from id
    or nullif(split_part(recording_storage_path, '/', 3), '') is null
  );

select
  id,
  workspace_id,
  attempts,
  max_attempts,
  priority,
  status
from public.ai_enrichment_jobs
where attempts < 0
   or max_attempts not between 1 and 5
   or attempts > max_attempts
   or priority not between 1 and 1000;

select
  job.id,
  job.workspace_id,
  job.status,
  job.job_type,
  job.import_run_id,
  job.created_by_user_id
from public.ai_enrichment_jobs job
left join public.csv_import_runs import_run
  on import_run.id = job.import_run_id
left join public.workspace_members member
  on member.workspace_id = job.workspace_id
 and member.user_id = job.created_by_user_id
where job.status in ('queued', 'running', 'retrying', 'paused_missing_key')
  and (
    job.job_type <> 'account_enrichment'
    or job.import_run_id is null
    or job.created_by_user_id is null
    or import_run.id is null
    or import_run.workspace_id is distinct from job.workspace_id
    or import_run.created_by_user_id is distinct from job.created_by_user_id
    or member.id is null
  );

-- OPERATOR DECISION REQUIRED: every active row returned below lacks the
-- server-issued provenance marker. Before the migration the column is absent,
-- so every active legacy job will be returned. Verify each job against its CSV
-- import run and audit context, then either mark it skipped or explicitly
-- authorize it after the migration. Do not bulk-backfill this marker.
select
  job.id,
  job.workspace_id,
  job.status,
  job.job_type,
  job.import_run_id,
  job.created_by_user_id,
  to_jsonb(job) ->> 'server_authorized_at' as server_authorized_at,
  'operator_review_required' as required_action
from public.ai_enrichment_jobs job
where job.status in ('queued', 'running', 'retrying', 'paused_missing_key')
  and nullif(to_jsonb(job) ->> 'server_authorized_at', '') is null;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'ai_enrichment_jobs',
    'csv_import_runs',
    'deepgram_token_grants',
    'recording_upload_reconciliations',
    'recording_upload_rollout_control',
    'workspace_session_activity'
  )
order by table_name, grantee, privilege_type;

-- OPERATOR REVIEW REQUIRED: these existing private Storage objects are not
-- referenced by a canonical call pointer and predate the reconciliation
-- ledger. Review the names in a secure SQL session; do not auto-delete them.
select storage_object.name
from storage.objects storage_object
left join public.calls call
  on call.recording_storage_path = storage_object.name
where storage_object.bucket_id = 'call-recordings'
  and call.id is null
order by storage_object.created_at asc;

-- OPERATOR REVIEW REQUIRED: inspect the deployed call-recording Storage
-- policies before replacing upload authorization and removing object updates.
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') like '%call-recordings%'
    or coalesce(with_check, '') like '%call-recordings%'
  )
order by policyname;

-- POST-MIGRATION OPERATOR VERIFICATION (run separately only after the
-- migration commits):
--
-- select singleton_id, enforce_after, updated_at,
--        now() >= enforce_after as registration_enforced
-- from public.recording_upload_rollout_control
-- where singleton_id = 1;
--
-- select cleanup_started_at is not null as cleanup_claimed,
--        count(*)
-- from public.recording_upload_reconciliations
-- group by cleanup_claimed
-- order by cleanup_claimed;
