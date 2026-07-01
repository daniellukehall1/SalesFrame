create table if not exists public.account_enrichment_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  business_summary text,
  likely_buying_triggers text,
  strategic_priorities text,
  current_tech_stack text,
  hiring_growth_signals text,
  recent_news_signals text,
  procurement_signals text,
  review_sentiment_signals text,
  likely_stakeholders text,
  discovery_angles text,
  risk_flags text,
  source_notes text,
  confidence text,
  last_enriched_at timestamptz,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) on delete cascade
);

create table if not exists public.account_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'completed',
  requested_account_name text,
  requested_domain text,
  proposed_core_updates jsonb not null default '{}'::jsonb,
  applied_core_updates jsonb not null default '{}'::jsonb,
  suggested_core_updates jsonb not null default '{}'::jsonb,
  sales_signals jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  error_message text,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) on delete cascade
);

create index if not exists account_enrichment_profiles_workspace_id_idx
  on public.account_enrichment_profiles(workspace_id);

create index if not exists account_enrichment_profiles_account_id_idx
  on public.account_enrichment_profiles(account_id);

create index if not exists account_enrichment_runs_workspace_id_idx
  on public.account_enrichment_runs(workspace_id);

create index if not exists account_enrichment_runs_account_id_idx
  on public.account_enrichment_runs(account_id);

drop trigger if exists set_account_enrichment_profiles_updated_at on public.account_enrichment_profiles;
create trigger set_account_enrichment_profiles_updated_at before update on public.account_enrichment_profiles
for each row execute function public.set_updated_at();

alter table public.account_enrichment_profiles enable row level security;
alter table public.account_enrichment_runs enable row level security;

drop policy if exists "Workspace members can manage account enrichment profiles" on public.account_enrichment_profiles;
create policy "Workspace members can manage account enrichment profiles"
on public.account_enrichment_profiles for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage account enrichment runs" on public.account_enrichment_runs;
create policy "Workspace members can manage account enrichment runs"
on public.account_enrichment_runs for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
