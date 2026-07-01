alter table public.accounts
  add column if not exists logo_domain text,
  add column if not exists logo_url text,
  add column if not exists logo_source text not null default 'logo_dev',
  add column if not exists logo_status text not null default 'missing',
  add column if not exists logo_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_logo_status_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_logo_status_check
      check (logo_status in ('resolved', 'fallback', 'missing'));
  end if;
end $$;

create index if not exists accounts_logo_domain_idx
  on public.accounts(logo_domain);
