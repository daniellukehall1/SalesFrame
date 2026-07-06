create table if not exists public.call_intent_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  intent_cluster_id text not null,
  intent_label text not null default '',
  status text not null default 'missing'
    check (status in (
      'missing',
      'suggested',
      'asked',
      'answered',
      'weak_evidence',
      'confirmed',
      'parked',
      'do_not_repeat_this_call',
      'dropped'
    )),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  summary text not null default '',
  value text,
  last_question text,
  last_answer text,
  source_turn_ids jsonb not null default '[]'::jsonb,
  related_playbook_field_ids jsonb not null default '[]'::jsonb,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, intent_cluster_id)
);

create table if not exists public.opportunity_stakeholders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  normalized_name text not null,
  name text not null,
  role_label text not null default '',
  influence_label text not null default '',
  status text not null default 'weak_evidence'
    check (status in ('mentioned', 'weak_evidence', 'confirmed', 'dismissed')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence_summary text not null default '',
  source_call_id uuid references public.calls(id) on delete set null,
  source_turn_ids jsonb not null default '[]'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, normalized_name)
);

create index if not exists call_intent_ledger_workspace_call_updated_idx
on public.call_intent_ledger(workspace_id, call_id, updated_at desc);

create index if not exists call_intent_ledger_opportunity_status_idx
on public.call_intent_ledger(opportunity_id, status);

create index if not exists opportunity_stakeholders_workspace_opportunity_idx
on public.opportunity_stakeholders(workspace_id, opportunity_id);

create index if not exists opportunity_stakeholders_account_seen_idx
on public.opportunity_stakeholders(account_id, last_seen_at desc);

drop trigger if exists set_call_intent_ledger_updated_at on public.call_intent_ledger;
create trigger set_call_intent_ledger_updated_at before update on public.call_intent_ledger
for each row execute function public.set_updated_at();

drop trigger if exists set_opportunity_stakeholders_updated_at on public.opportunity_stakeholders;
create trigger set_opportunity_stakeholders_updated_at before update on public.opportunity_stakeholders
for each row execute function public.set_updated_at();

alter table public.call_intent_ledger enable row level security;
alter table public.opportunity_stakeholders enable row level security;

drop policy if exists "Workspace members can manage call intent ledger" on public.call_intent_ledger;
create policy "Workspace members can manage call intent ledger"
on public.call_intent_ledger for all
to authenticated
using (
  public.is_workspace_member(public.call_intent_ledger.workspace_id)
  and public.can_access_call(public.call_intent_ledger.call_id)
  and public.can_access_opportunity(public.call_intent_ledger.opportunity_id)
  and exists (
    select 1
    from public.calls call_record
    join public.opportunities opportunity_record on opportunity_record.id = call_record.opportunity_id
    where call_record.id = public.call_intent_ledger.call_id
      and opportunity_record.id = public.call_intent_ledger.opportunity_id
      and call_record.workspace_id = public.call_intent_ledger.workspace_id
      and opportunity_record.workspace_id = public.call_intent_ledger.workspace_id
  )
)
with check (
  public.is_workspace_member(public.call_intent_ledger.workspace_id)
  and public.can_access_call(public.call_intent_ledger.call_id)
  and public.can_access_opportunity(public.call_intent_ledger.opportunity_id)
  and exists (
    select 1
    from public.calls call_record
    join public.opportunities opportunity_record on opportunity_record.id = call_record.opportunity_id
    where call_record.id = public.call_intent_ledger.call_id
      and opportunity_record.id = public.call_intent_ledger.opportunity_id
      and call_record.workspace_id = public.call_intent_ledger.workspace_id
      and opportunity_record.workspace_id = public.call_intent_ledger.workspace_id
  )
);

drop policy if exists "Workspace members can manage opportunity stakeholders" on public.opportunity_stakeholders;
create policy "Workspace members can manage opportunity stakeholders"
on public.opportunity_stakeholders for all
to authenticated
using (
  public.is_workspace_member(public.opportunity_stakeholders.workspace_id)
  and public.can_access_opportunity(public.opportunity_stakeholders.opportunity_id)
  and exists (
    select 1
    from public.accounts account_record
    join public.opportunities opportunity_record on opportunity_record.account_id = account_record.id
    where account_record.id = public.opportunity_stakeholders.account_id
      and opportunity_record.id = public.opportunity_stakeholders.opportunity_id
      and account_record.workspace_id = public.opportunity_stakeholders.workspace_id
      and opportunity_record.workspace_id = public.opportunity_stakeholders.workspace_id
  )
)
with check (
  public.is_workspace_member(public.opportunity_stakeholders.workspace_id)
  and public.can_access_opportunity(public.opportunity_stakeholders.opportunity_id)
  and exists (
    select 1
    from public.accounts account_record
    join public.opportunities opportunity_record on opportunity_record.account_id = account_record.id
    where account_record.id = public.opportunity_stakeholders.account_id
      and opportunity_record.id = public.opportunity_stakeholders.opportunity_id
      and account_record.workspace_id = public.opportunity_stakeholders.workspace_id
      and opportunity_record.workspace_id = public.opportunity_stakeholders.workspace_id
  )
);
