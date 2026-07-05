create table if not exists public.csv_import_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_type text not null check (import_type in ('accounts', 'opportunities')),
  file_name text,
  row_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  failure_rows jsonb not null default '[]'::jsonb,
  enrichment_enabled boolean not null default true,
  enrichment_queued_count integer not null default 0,
  enrichment_paused_count integer not null default 0,
  enrichment_skipped_count integer not null default 0,
  enrichment_already_tracked_count integer not null default 0,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  import_run_id uuid references public.csv_import_runs(id) on delete set null,
  job_type text not null default 'account_enrichment' check (job_type in ('account_enrichment', 'logo_refresh')),
  status text not null default 'queued' check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'skipped', 'paused_missing_key')),
  idempotency_key text not null,
  requested_account_name text,
  requested_domain text,
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) on delete cascade
);

create index if not exists csv_import_runs_workspace_created_at_idx
  on public.csv_import_runs(workspace_id, created_at desc);

create index if not exists ai_enrichment_jobs_workspace_status_idx
  on public.ai_enrichment_jobs(workspace_id, status, run_after);

create index if not exists ai_enrichment_jobs_import_run_idx
  on public.ai_enrichment_jobs(import_run_id);

create index if not exists ai_enrichment_jobs_account_idx
  on public.ai_enrichment_jobs(account_id);

drop trigger if exists set_csv_import_runs_updated_at on public.csv_import_runs;
create trigger set_csv_import_runs_updated_at before update on public.csv_import_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_enrichment_jobs_updated_at on public.ai_enrichment_jobs;
create trigger set_ai_enrichment_jobs_updated_at before update on public.ai_enrichment_jobs
for each row execute function public.set_updated_at();

alter table public.csv_import_runs enable row level security;
alter table public.ai_enrichment_jobs enable row level security;

drop policy if exists "Workspace members can read csv import runs" on public.csv_import_runs;
create policy "Workspace members can read csv import runs"
on public.csv_import_runs for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create csv import runs" on public.csv_import_runs;
create policy "Workspace members can create csv import runs"
on public.csv_import_runs for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update csv import runs" on public.csv_import_runs;
create policy "Workspace members can update csv import runs"
on public.csv_import_runs for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can read ai enrichment jobs"
on public.ai_enrichment_jobs for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can create ai enrichment jobs"
on public.ai_enrichment_jobs for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can update ai enrichment jobs"
on public.ai_enrichment_jobs for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
