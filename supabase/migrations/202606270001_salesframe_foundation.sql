set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.workspace_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.field_evidence_status as enum ('missing', 'asked', 'weak', 'confirmed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.call_status as enum ('planned', 'active', 'processing', 'post_call_draft', 'reviewed', 'needs_attention', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.speaker_role as enum ('seller', 'customer', 'customer_2', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.call_note_type as enum ('ai_note', 'manual_note', 'evidence', 'summary', 'action_item');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  company_name text,
  role_title text,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default 'Seller workspace',
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  website text,
  industry text,
  employee_count text,
  region text not null default 'Australia',
  owner_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  current_tools text,
  strategic_initiatives text,
  competitors text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  name text not null check (char_length(trim(name)) > 0),
  stage text not null default 'Discovery',
  amount text,
  close_date date,
  close_date_note text,
  owner_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  source text,
  pain text,
  decision_process text,
  next_step text,
  manual_notes text,
  coverage_score integer not null default 0 check (coverage_score between 0 and 100),
  missing_count integer not null default 0 check (missing_count >= 0),
  weak_count integer not null default 0 check (weak_count >= 0),
  call_type text not null default 'Discovery',
  next_question text,
  question_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) on delete cascade
);

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  best_for text,
  evidence_standard text,
  live_guidance text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists playbooks_system_slug_key
  on public.playbooks(slug)
  where workspace_id is null;

create unique index if not exists playbooks_workspace_slug_key
  on public.playbooks(workspace_id, slug)
  where workspace_id is not null;

create table if not exists public.playbook_fields (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  label text not null,
  description text,
  evidence_standard text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (playbook_id, label)
);

create table if not exists public.opportunity_playbooks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  playbook_id uuid not null references public.playbooks(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (opportunity_id, playbook_id)
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  opportunity_id uuid not null,
  title text not null,
  call_type text not null default 'Discovery',
  status public.call_status not null default 'planned',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  recording_storage_path text,
  recording_url text,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) on delete cascade,
  foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete cascade
);

create table if not exists public.call_playbooks (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  playbook_id uuid not null references public.playbooks(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (call_id, playbook_id)
);

create table if not exists public.call_speakers (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  label text not null,
  display_name text,
  role public.speaker_role not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, label)
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  speaker_id uuid references public.call_speakers(id) on delete set null,
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= 0),
  text text not null,
  is_final boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_notes (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  note_type public.call_note_type not null default 'ai_note',
  text text not null,
  source_transcript_segment_id uuid references public.transcript_segments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_field_evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  playbook_field_id uuid not null references public.playbook_fields(id) on delete cascade,
  status public.field_evidence_status not null default 'missing',
  value text,
  evidence_summary text,
  source_call_id uuid references public.calls(id) on delete set null,
  source_transcript_segment_id uuid references public.transcript_segments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, playbook_field_id)
);

create table if not exists public.live_guidance_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  recommended_question text not null,
  target_playbook_field_id uuid references public.playbook_fields(id) on delete set null,
  reason text,
  selected_call_type text,
  selected_playbooks jsonb not null default '[]'::jsonb,
  covered_intents jsonb not null default '[]'::jsonb,
  missing_gaps jsonb not null default '[]'::jsonb,
  conversation_flow jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.next_call_briefs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  previous_call_id uuid references public.calls(id) on delete set null,
  objective text,
  suggested_opening text,
  focus_questions jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  risk_notes jsonb not null default '[]'::jsonb,
  recommended_next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_call_outputs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  follow_up_email text,
  next_call_plan text,
  account_updates jsonb not null default '{}'::jsonb,
  opportunity_updates jsonb not null default '{}'::jsonb,
  missing_info jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_research_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seller_company text not null,
  seller_domain text,
  product_context text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.customer_research_runs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete set null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  enabled boolean not null default false,
  customer_contact text,
  customer_role text,
  seller_company text,
  seller_domain text,
  product_context text,
  trusted_sources jsonb not null default '[]'::jsonb,
  research_summary text,
  question_angle text,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_ai_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default 'openai',
  openai_api_key_encrypted text,
  key_last_four text,
  key_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists accounts_workspace_id_idx on public.accounts(workspace_id);
create index if not exists accounts_owner_user_id_idx on public.accounts(owner_user_id);
create index if not exists opportunities_workspace_id_idx on public.opportunities(workspace_id);
create index if not exists opportunities_account_id_idx on public.opportunities(account_id);
create index if not exists opportunities_owner_user_id_idx on public.opportunities(owner_user_id);
create index if not exists playbook_fields_playbook_id_idx on public.playbook_fields(playbook_id);
create index if not exists opportunity_playbooks_opportunity_id_idx on public.opportunity_playbooks(opportunity_id);
create index if not exists opportunity_playbooks_playbook_id_idx on public.opportunity_playbooks(playbook_id);
create index if not exists calls_workspace_id_idx on public.calls(workspace_id);
create index if not exists calls_opportunity_id_idx on public.calls(opportunity_id);
create index if not exists calls_started_at_idx on public.calls(started_at desc);
create index if not exists call_playbooks_call_id_idx on public.call_playbooks(call_id);
create index if not exists call_speakers_call_id_idx on public.call_speakers(call_id);
create index if not exists transcript_segments_call_id_start_ms_idx on public.transcript_segments(call_id, start_ms);
create index if not exists call_notes_call_id_idx on public.call_notes(call_id);
create index if not exists opportunity_field_evidence_opportunity_id_idx on public.opportunity_field_evidence(opportunity_id);
create index if not exists live_guidance_events_call_id_created_at_idx on public.live_guidance_events(call_id, created_at desc);
create index if not exists next_call_briefs_opportunity_id_created_at_idx on public.next_call_briefs(opportunity_id, created_at desc);
create index if not exists post_call_outputs_call_id_idx on public.post_call_outputs(call_id);
create index if not exists customer_research_runs_account_id_idx on public.customer_research_runs(account_id);
create index if not exists customer_research_runs_opportunity_id_idx on public.customer_research_runs(opportunity_id);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.role = 'owner'
  );
$$;

create or replace function public.can_access_opportunity(target_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = target_opportunity_id
      and public.is_workspace_member(opportunity.workspace_id)
  );
$$;

create or replace function public.can_access_call(target_call_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calls call
    where call.id = target_call_id
      and public.is_workspace_member(call.workspace_id)
  );
$$;

create or replace function public.can_access_playbook(target_playbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.playbooks playbook
    where playbook.id = target_playbook_id
      and (
        playbook.is_system
        or public.is_workspace_member(playbook.workspace_id)
      )
  );
$$;

create or replace function public.create_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (workspace_id, user_id) do update
    set role = 'owner',
        updated_at = now();

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
        updated_at = now();

  insert into public.workspaces (name, description, owner_user_id)
  values ('SalesFrame', 'Seller workspace', new.id)
  returning id into workspace_id;

  return new;
end;
$$;

drop trigger if exists create_workspace_owner_membership_trigger on public.workspaces;
create trigger create_workspace_owner_membership_trigger
after insert on public.workspaces
for each row execute function public.create_workspace_owner_membership();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.user_profiles (id, email, full_name)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name')
from auth.users users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
      updated_at = now();

insert into public.workspaces (name, description, owner_user_id)
select 'SalesFrame', 'Seller workspace', users.id
from auth.users users
where not exists (
  select 1
  from public.workspaces workspace
  where workspace.owner_user_id = users.id
);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_opportunities_updated_at on public.opportunities;
create trigger set_opportunities_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();

drop trigger if exists set_playbooks_updated_at on public.playbooks;
create trigger set_playbooks_updated_at before update on public.playbooks
for each row execute function public.set_updated_at();

drop trigger if exists set_playbook_fields_updated_at on public.playbook_fields;
create trigger set_playbook_fields_updated_at before update on public.playbook_fields
for each row execute function public.set_updated_at();

drop trigger if exists set_calls_updated_at on public.calls;
create trigger set_calls_updated_at before update on public.calls
for each row execute function public.set_updated_at();

drop trigger if exists set_call_speakers_updated_at on public.call_speakers;
create trigger set_call_speakers_updated_at before update on public.call_speakers
for each row execute function public.set_updated_at();

drop trigger if exists set_transcript_segments_updated_at on public.transcript_segments;
create trigger set_transcript_segments_updated_at before update on public.transcript_segments
for each row execute function public.set_updated_at();

drop trigger if exists set_call_notes_updated_at on public.call_notes;
create trigger set_call_notes_updated_at before update on public.call_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_opportunity_field_evidence_updated_at on public.opportunity_field_evidence;
create trigger set_opportunity_field_evidence_updated_at before update on public.opportunity_field_evidence
for each row execute function public.set_updated_at();

drop trigger if exists set_next_call_briefs_updated_at on public.next_call_briefs;
create trigger set_next_call_briefs_updated_at before update on public.next_call_briefs
for each row execute function public.set_updated_at();

drop trigger if exists set_post_call_outputs_updated_at on public.post_call_outputs;
create trigger set_post_call_outputs_updated_at before update on public.post_call_outputs
for each row execute function public.set_updated_at();

drop trigger if exists set_seller_research_profiles_updated_at on public.seller_research_profiles;
create trigger set_seller_research_profiles_updated_at before update on public.seller_research_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_ai_settings_updated_at on public.user_ai_settings;
create trigger set_user_ai_settings_updated_at before update on public.user_ai_settings
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.accounts enable row level security;
alter table public.opportunities enable row level security;
alter table public.playbooks enable row level security;
alter table public.playbook_fields enable row level security;
alter table public.opportunity_playbooks enable row level security;
alter table public.calls enable row level security;
alter table public.call_playbooks enable row level security;
alter table public.call_speakers enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.call_notes enable row level security;
alter table public.opportunity_field_evidence enable row level security;
alter table public.live_guidance_events enable row level security;
alter table public.next_call_briefs enable row level security;
alter table public.post_call_outputs enable row level security;
alter table public.seller_research_profiles enable row level security;
alter table public.customer_research_runs enable row level security;
alter table public.user_ai_settings enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Users can create owned workspaces" on public.workspaces;
create policy "Users can create owned workspaces"
on public.workspaces for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "Workspace owners can update workspaces" on public.workspaces;
create policy "Workspace owners can update workspaces"
on public.workspaces for update
to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

drop policy if exists "Workspace owners can delete workspaces" on public.workspaces;
create policy "Workspace owners can delete workspaces"
on public.workspaces for delete
to authenticated
using (public.is_workspace_owner(id));

drop policy if exists "Workspace members can read memberships" on public.workspace_members;
create policy "Workspace members can read memberships"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace owners can manage memberships" on public.workspace_members;
create policy "Workspace owners can manage memberships"
on public.workspace_members for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Workspace members can read accounts" on public.accounts;
create policy "Workspace members can read accounts"
on public.accounts for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can insert accounts" on public.accounts;
create policy "Workspace members can insert accounts"
on public.accounts for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and owner_user_id = auth.uid());

drop policy if exists "Workspace members can update accounts" on public.accounts;
create policy "Workspace members can update accounts"
on public.accounts for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete accounts" on public.accounts;
create policy "Workspace members can delete accounts"
on public.accounts for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read opportunities" on public.opportunities;
create policy "Workspace members can read opportunities"
on public.opportunities for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can insert opportunities" on public.opportunities;
create policy "Workspace members can insert opportunities"
on public.opportunities for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and owner_user_id = auth.uid());

drop policy if exists "Workspace members can update opportunities" on public.opportunities;
create policy "Workspace members can update opportunities"
on public.opportunities for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete opportunities" on public.opportunities;
create policy "Workspace members can delete opportunities"
on public.opportunities for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Authenticated users can read system and workspace playbooks" on public.playbooks;
create policy "Authenticated users can read system and workspace playbooks"
on public.playbooks for select
to authenticated
using (is_system or public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can insert custom playbooks" on public.playbooks;
create policy "Workspace members can insert custom playbooks"
on public.playbooks for insert
to authenticated
with check (workspace_id is not null and not is_system and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update custom playbooks" on public.playbooks;
create policy "Workspace members can update custom playbooks"
on public.playbooks for update
to authenticated
using (workspace_id is not null and not is_system and public.is_workspace_member(workspace_id))
with check (workspace_id is not null and not is_system and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete custom playbooks" on public.playbooks;
create policy "Workspace members can delete custom playbooks"
on public.playbooks for delete
to authenticated
using (workspace_id is not null and not is_system and public.is_workspace_member(workspace_id));

drop policy if exists "Authenticated users can read playbook fields" on public.playbook_fields;
create policy "Authenticated users can read playbook fields"
on public.playbook_fields for select
to authenticated
using (public.can_access_playbook(playbook_id));

drop policy if exists "Workspace members can manage custom playbook fields" on public.playbook_fields;
create policy "Workspace members can manage custom playbook fields"
on public.playbook_fields for all
to authenticated
using (
  exists (
    select 1
    from public.playbooks playbook
    where playbook.id = playbook_id
      and playbook.workspace_id is not null
      and not playbook.is_system
      and public.is_workspace_member(playbook.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.playbooks playbook
    where playbook.id = playbook_id
      and playbook.workspace_id is not null
      and not playbook.is_system
      and public.is_workspace_member(playbook.workspace_id)
  )
);

drop policy if exists "Workspace members can read opportunity playbooks" on public.opportunity_playbooks;
create policy "Workspace members can read opportunity playbooks"
on public.opportunity_playbooks for select
to authenticated
using (public.can_access_opportunity(opportunity_id));

drop policy if exists "Workspace members can manage opportunity playbooks" on public.opportunity_playbooks;
create policy "Workspace members can manage opportunity playbooks"
on public.opportunity_playbooks for all
to authenticated
using (public.can_access_opportunity(opportunity_id))
with check (public.can_access_opportunity(opportunity_id) and public.can_access_playbook(playbook_id));

drop policy if exists "Workspace members can read calls" on public.calls;
create policy "Workspace members can read calls"
on public.calls for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can insert calls" on public.calls;
create policy "Workspace members can insert calls"
on public.calls for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and created_by_user_id = auth.uid());

drop policy if exists "Workspace members can update calls" on public.calls;
create policy "Workspace members can update calls"
on public.calls for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete calls" on public.calls;
create policy "Workspace members can delete calls"
on public.calls for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read call playbooks" on public.call_playbooks;
create policy "Workspace members can read call playbooks"
on public.call_playbooks for select
to authenticated
using (public.can_access_call(call_id));

drop policy if exists "Workspace members can manage call playbooks" on public.call_playbooks;
create policy "Workspace members can manage call playbooks"
on public.call_playbooks for all
to authenticated
using (public.can_access_call(call_id))
with check (public.can_access_call(call_id) and public.can_access_playbook(playbook_id));

drop policy if exists "Workspace members can manage call speakers" on public.call_speakers;
create policy "Workspace members can manage call speakers"
on public.call_speakers for all
to authenticated
using (public.can_access_call(call_id))
with check (public.can_access_call(call_id));

drop policy if exists "Workspace members can manage transcript segments" on public.transcript_segments;
create policy "Workspace members can manage transcript segments"
on public.transcript_segments for all
to authenticated
using (public.can_access_call(call_id))
with check (public.can_access_call(call_id));

drop policy if exists "Workspace members can manage call notes" on public.call_notes;
create policy "Workspace members can manage call notes"
on public.call_notes for all
to authenticated
using (public.can_access_call(call_id))
with check (public.can_access_call(call_id));

drop policy if exists "Workspace members can manage opportunity evidence" on public.opportunity_field_evidence;
create policy "Workspace members can manage opportunity evidence"
on public.opportunity_field_evidence for all
to authenticated
using (public.can_access_opportunity(opportunity_id))
with check (public.can_access_opportunity(opportunity_id) and public.can_access_playbook((select field.playbook_id from public.playbook_fields field where field.id = playbook_field_id)));

drop policy if exists "Workspace members can manage live guidance" on public.live_guidance_events;
create policy "Workspace members can manage live guidance"
on public.live_guidance_events for all
to authenticated
using (public.can_access_call(call_id) and public.can_access_opportunity(opportunity_id))
with check (public.can_access_call(call_id) and public.can_access_opportunity(opportunity_id));

drop policy if exists "Workspace members can manage next call briefs" on public.next_call_briefs;
create policy "Workspace members can manage next call briefs"
on public.next_call_briefs for all
to authenticated
using (public.can_access_opportunity(opportunity_id))
with check (public.can_access_opportunity(opportunity_id));

drop policy if exists "Workspace members can manage post call outputs" on public.post_call_outputs;
create policy "Workspace members can manage post call outputs"
on public.post_call_outputs for all
to authenticated
using (public.can_access_call(call_id))
with check (public.can_access_call(call_id));

drop policy if exists "Users can manage own seller research profiles" on public.seller_research_profiles;
create policy "Users can manage own seller research profiles"
on public.seller_research_profiles for all
to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage customer research runs" on public.customer_research_runs;
create policy "Workspace members can manage customer research runs"
on public.customer_research_runs for all
to authenticated
using (
  created_by_user_id = auth.uid()
  or exists (
    select 1
    from public.accounts account
    where account.id = account_id
      and public.is_workspace_member(account.workspace_id)
  )
)
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.accounts account
    where account.id = account_id
      and public.is_workspace_member(account.workspace_id)
  )
);

drop policy if exists "Users can manage own AI settings" on public.user_ai_settings;
create policy "Users can manage own AI settings"
on public.user_ai_settings for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.can_access_opportunity(uuid) from public;
revoke all on function public.can_access_call(uuid) from public;
revoke all on function public.can_access_playbook(uuid) from public;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.can_access_opportunity(uuid) to authenticated;
grant execute on function public.can_access_call(uuid) to authenticated;
grant execute on function public.can_access_playbook(uuid) to authenticated;

insert into public.playbooks (workspace_id, slug, name, description, best_for, evidence_standard, live_guidance, is_system)
values
  (null, 'meddicc', 'MEDDICC', 'Strict qualification for enterprise opportunities.', 'Complex enterprise deals with multiple stakeholders and a formal decision process.', 'Every field needs customer-sourced evidence, not seller assumption.', 'Prioritize the weakest required field that fits the current conversation topic.', true),
  (null, 'meddpicc', 'MEDDPICC', 'MEDDICC qualification with explicit paper process coverage.', 'Enterprise deals where procurement, legal, security, privacy, or vendor onboarding can slow signature.', 'Every MEDDICC field plus paper process must have customer-sourced evidence and an owner.', 'Use MEDDICC evidence and add paper process prompts when buying steps or contracting risk become relevant.', true),
  (null, 'bant', 'BANT', 'Fast qualification for budget, authority, need, and timeline.', 'Early qualification where the seller needs a quick read on whether a deal is real.', 'Each field should be captured as a short, defensible statement with source context.', 'Expose whether the opportunity is worth deeper discovery.', true),
  (null, 'force-management', 'Force Management / Command of the Message', 'Value messaging for business pain, required capabilities, positive outcomes, metrics, and differentiation.', 'Discovery and validation calls where the seller needs to connect customer pain to differentiated value.', 'Each field should be linked to customer language, business impact, and differentiation.', 'Move from pain to required capabilities, then measurable outcomes.', true),
  (null, 'spin', 'SPIN Selling', 'Live discovery coaching across Situation, Problem, Implication, and Need-payoff questions.', 'Early and mid-stage discovery where the seller needs to avoid staying too shallow.', 'The conversation should progress beyond current-state facts into customer-owned pain, consequences, and value.', 'Detect shallow discovery and prompt movement from situation facts into implication and payoff.', true),
  (null, 'sandler', 'Sandler', 'Consultative selling checkpoints for upfront contracts, pain, budget, decision process, fulfillment, and post-sell.', 'Calls where the seller needs clear mutual expectations, commercial truth, and qualification discipline.', 'Capture explicit customer commitments and avoid advancing without pain, budget, and decision clarity.', 'Establish mutual expectations early, then qualify pain, money, decision, fit, and next commitments.', true),
  (null, 'challenger', 'The Challenger Sale', 'Commercial insight-led selling that teaches, tailors, and takes control of the buying conversation.', 'Calls where the seller needs to challenge the customer''s current thinking with credible insight and create urgency for change.', 'Connect a customer-specific insight to a reframed problem, quantified business impact, and differentiated reason to act.', 'Help the seller reframe the customer''s view, create constructive tension, and move from insight to a customer-owned business case.', true),
  (null, 'gap-selling', 'Gap Selling', 'Problem-centric discovery that contrasts current state, future state, root cause, impact, and urgency.', 'Discovery calls where the seller needs to diagnose the real business gap before discussing product fit.', 'Capture the customer''s current state, desired future state, root cause, measurable gap, and reason to change now.', 'Keep the seller diagnosing the gap until the customer can articulate why the current state must change.', true),
  (null, 'custom', 'Custom framework', 'Configurable fields for internal methodology variants.', 'Team-specific qualification models, internal sales plays, and framework variants.', 'Required fields, evidence standards, and completion rules should be clear and testable.', 'Treat configured fields as first-class guidance alongside system playbooks.', true)
on conflict (slug) where workspace_id is null do update
  set name = excluded.name,
      description = excluded.description,
      best_for = excluded.best_for,
      evidence_standard = excluded.evidence_standard,
      live_guidance = excluded.live_guidance,
      is_system = excluded.is_system,
      updated_at = now();

with field_rows(slug, label, description, sort_order) as (
  values
    ('meddicc', 'Metrics', 'Quantified business impact, current baseline, and success target.', 10),
    ('meddicc', 'Economic Buyer', 'Named person who owns the commercial outcome and approval path.', 20),
    ('meddicc', 'Decision Criteria', 'The explicit standards the customer will use to compare options.', 30),
    ('meddicc', 'Decision Process', 'Steps, dates, stakeholders, and approval gates required to buy.', 40),
    ('meddicc', 'Identify Pain', 'A business problem the customer agrees is worth solving.', 50),
    ('meddicc', 'Champion', 'A validated internal advocate with influence and personal stake.', 60),
    ('meddicc', 'Competition', 'Known alternatives, including incumbent tools and internal build paths.', 70),
    ('meddpicc', 'Metrics', 'Quantified business impact, current baseline, and success target.', 10),
    ('meddpicc', 'Economic Buyer', 'Named person who owns the commercial outcome and approval path.', 20),
    ('meddpicc', 'Decision Criteria', 'The explicit standards the customer will use to compare options.', 30),
    ('meddpicc', 'Decision Process', 'Steps, dates, stakeholders, and approval gates required to buy.', 40),
    ('meddpicc', 'Paper Process', 'Legal, procurement, security, privacy, order form, and vendor onboarding steps required to complete purchase.', 50),
    ('meddpicc', 'Identify Pain', 'A business problem the customer agrees is worth solving.', 60),
    ('meddpicc', 'Champion', 'A validated internal advocate with influence and personal stake.', 70),
    ('meddpicc', 'Competition', 'Known alternatives, including incumbent tools and internal build paths.', 80),
    ('bant', 'Budget', 'Budget exists, budget source is known, or funding path is understood.', 10),
    ('bant', 'Authority', 'The buyer, signer, and influencers are clear enough to navigate the deal.', 20),
    ('bant', 'Need', 'The customer has a business problem tied to a desired outcome.', 30),
    ('bant', 'Timeline', 'There is a meaningful date, event, renewal, or business trigger.', 40),
    ('force-management', 'Business Pain', 'The business problem, current consequence, and reason it matters now.', 10),
    ('force-management', 'Required Capabilities', 'The capabilities the customer says are required to solve the pain.', 20),
    ('force-management', 'Positive Business Outcomes', 'The future business state the customer wants if the project succeeds.', 30),
    ('force-management', 'Metrics', 'The measurable baseline, target, or business impact attached to the outcome.', 40),
    ('force-management', 'Differentiation', 'Why the customer should prefer this approach over the incumbent, status quo, or competitor.', 50),
    ('spin', 'Situation', 'Current-state context, existing process, tools, constraints, and operating environment.', 10),
    ('spin', 'Problem', 'A customer-acknowledged difficulty, dissatisfaction, or gap in the current state.', 20),
    ('spin', 'Implication', 'The consequence of leaving the problem unresolved.', 30),
    ('spin', 'Need-payoff', 'The value the customer sees in solving the problem.', 40),
    ('sandler', 'Upfront Contract', 'Mutual agreement on agenda, outcomes, timing, and what happens next.', 10),
    ('sandler', 'Pain', 'Business pain and personal or team impact that is strong enough to act on.', 20),
    ('sandler', 'Budget', 'Available budget, funding path, or commercial willingness to solve the pain.', 30),
    ('sandler', 'Decision Process', 'How the customer decides, who is involved, and what happens after this call.', 40),
    ('sandler', 'Fulfillment', 'Fit between the customer need and the solution path the seller can credibly deliver.', 50),
    ('sandler', 'Post-sell', 'Customer-agreed next step, success check, or implementation commitment after the sale.', 60),
    ('challenger', 'Commercial Insight', 'A credible market, operational, or business insight that matters to the customer''s context.', 10),
    ('challenger', 'Reframe', 'A sharper way for the customer to see the problem, risk, or missed opportunity.', 20),
    ('challenger', 'Rational Drowning', 'Quantified evidence that makes the cost of the status quo hard to ignore.', 30),
    ('challenger', 'Emotional Impact', 'Personal, team, or executive consequence that makes the issue feel urgent and human.', 40),
    ('challenger', 'New Way', 'The changed approach the customer needs to believe in before evaluating solution fit.', 50),
    ('challenger', 'Unique Strengths', 'Differentiated capabilities tied to the reframe, not generic product claims.', 60),
    ('challenger', 'Constructive Tension', 'A respectful challenge that advances urgency without sounding combative.', 70),
    ('gap-selling', 'Current State', 'How the customer operates today, including process, tools, symptoms, and constraints.', 10),
    ('gap-selling', 'Future State', 'The specific business condition the customer wants instead.', 20),
    ('gap-selling', 'Gap', 'The measurable distance between current and future state.', 30),
    ('gap-selling', 'Root Cause', 'The underlying reason the current state exists, beyond surface symptoms.', 40),
    ('gap-selling', 'Impact', 'Business, financial, operational, or personal consequence of the gap.', 50),
    ('gap-selling', 'Urgency', 'Why solving the gap matters now instead of later.', 60),
    ('gap-selling', 'Decision Criteria', 'The standards the customer will use to decide whether the gap is solved.', 70),
    ('custom', 'Required field', 'The information that must be captured before the opportunity can progress.', 10),
    ('custom', 'Evidence standard', 'The proof needed before the app marks the field as complete.', 20),
    ('custom', 'Prompt pattern', 'The question style the seller should use when the field is weak or missing.', 30),
    ('custom', 'Exit criteria', 'The condition that confirms the playbook requirement has been satisfied.', 40)
)
insert into public.playbook_fields (playbook_id, label, description, sort_order)
select playbook.id, field_rows.label, field_rows.description, field_rows.sort_order
from field_rows
join public.playbooks playbook
  on playbook.slug = field_rows.slug
 and playbook.workspace_id is null
on conflict (playbook_id, label) do update
  set description = excluded.description,
      sort_order = excluded.sort_order,
      updated_at = now();
