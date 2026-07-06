alter table public.accounts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

alter table public.opportunities
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

create index if not exists accounts_workspace_active_idx
  on public.accounts(workspace_id, name)
  where archived_at is null;

create index if not exists accounts_workspace_archived_idx
  on public.accounts(workspace_id, archived_at desc)
  where archived_at is not null;

create index if not exists opportunities_workspace_active_idx
  on public.opportunities(workspace_id, updated_at desc)
  where archived_at is null;

create index if not exists opportunities_workspace_archived_idx
  on public.opportunities(workspace_id, archived_at desc)
  where archived_at is not null;

create index if not exists opportunities_account_active_idx
  on public.opportunities(account_id, updated_at desc)
  where archived_at is null;
