set check_function_bodies = off;

create or replace function public.normalize_linkedin_contact_url(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(btrim(value)), '[?#].*$', ''),
          '^https?://',
          ''
        ),
        '^([a-z0-9-]+\.)*linkedin\.com/',
        'linkedin.com/'
      ),
      '/+$',
      ''
    ),
    ''
  );
$$;

alter table public.opportunities
  add constraint opportunities_workspace_account_id_key
  unique (workspace_id, account_id, id);

alter table public.calls
  add constraint calls_workspace_account_opportunity_id_key
  unique (workspace_id, account_id, opportunity_id, id);

alter table public.calls
  add constraint calls_workspace_account_opportunity_id_fkey
  foreign key (workspace_id, account_id, opportunity_id)
  references public.opportunities(workspace_id, account_id, id)
  on delete cascade
  not valid;

-- NOT VALID deliberately preserves deploy safety for legacy rows while enforcing
-- the composite relationship for every new or changed call. Run the matching
-- read-only preflight, remediate any legacy mismatches explicitly, then validate
-- this constraint in a separately authorized maintenance change.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) > 0),
  preferred_name text,
  job_title text,
  department text,
  seniority text,
  work_email text,
  business_phone text,
  linkedin_url text
    check (
      linkedin_url is null
      or btrim(linkedin_url) = ''
      or btrim(linkedin_url) ~* '^https?://'
    ),
  location text,
  timezone text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'former', 'unknown')),
  private_notes text,
  source text not null default 'manual'
    check (source in ('manual', 'quick_add', 'import', 'enrichment')),
  normalized_email text generated always as (
    nullif(lower(btrim(work_email)), '')
  ) stored,
  normalized_linkedin_url text generated always as (
    public.normalize_linkedin_contact_url(linkedin_url)
  ) stored,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id, id),
  foreign key (workspace_id, account_id)
    references public.accounts(workspace_id, id)
    on delete cascade
);

create table public.opportunity_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  opportunity_id uuid not null,
  contact_id uuid not null,
  buying_roles text[] not null default '{}'::text[]
    check (
      buying_roles <@ array[
        'champion',
        'coach',
        'economic_buyer',
        'decision_maker',
        'evaluator',
        'technical_buyer',
        'influencer',
        'end_user',
        'procurement',
        'legal',
        'security',
        'blocker',
        'other'
      ]::text[]
    ),
  influence text not null default 'unknown'
    check (influence in ('high', 'medium', 'low', 'unknown')),
  relationship_strength text not null default 'unknown'
    check (relationship_strength in ('strong', 'developing', 'weak', 'unknown')),
  stance text not null default 'unknown'
    check (stance in ('supportive', 'neutral', 'resistant', 'unknown')),
  is_primary boolean not null default false,
  notes text,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, contact_id),
  foreign key (workspace_id, account_id, opportunity_id)
    references public.opportunities(workspace_id, account_id, id)
    on delete cascade,
  foreign key (workspace_id, account_id, contact_id)
    references public.contacts(workspace_id, account_id, id)
    on delete cascade
);

create table public.call_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  opportunity_id uuid not null,
  call_id uuid not null,
  contact_id uuid not null,
  attendance_status text not null default 'expected'
    check (attendance_status in ('expected', 'attended', 'absent', 'unknown')),
  is_primary boolean not null default false,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, contact_id),
  foreign key (workspace_id, account_id, opportunity_id, call_id)
    references public.calls(workspace_id, account_id, opportunity_id, id)
    on delete cascade,
  foreign key (workspace_id, account_id, contact_id)
    references public.contacts(workspace_id, account_id, id)
    on delete cascade
);

create table public.contact_enrichment_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  contact_id uuid not null,
  professional_summary text,
  role_scope text,
  likely_priorities text,
  likely_kpis text,
  relevant_experience text,
  recent_professional_signals text,
  discovery_angles text,
  caveats text,
  confidence numeric(4,3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  sources jsonb not null default '[]'::jsonb,
  last_enriched_at timestamptz,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_id),
  foreign key (workspace_id, account_id, contact_id)
    references public.contacts(workspace_id, account_id, id)
    on delete cascade
);

create table public.contact_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  contact_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'ambiguous')),
  model text,
  requested_full_name text,
  requested_account_name text,
  proposed_core_updates jsonb not null default '{}'::jsonb,
  applied_core_updates jsonb not null default '{}'::jsonb,
  enrichment_payload jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, account_id, contact_id)
    references public.contacts(workspace_id, account_id, id)
    on delete cascade
);

create unique index contacts_active_email_key
  on public.contacts(workspace_id, account_id, normalized_email)
  where archived_at is null and normalized_email is not null;

create unique index contacts_active_linkedin_key
  on public.contacts(workspace_id, account_id, normalized_linkedin_url)
  where archived_at is null and normalized_linkedin_url is not null;

create index contacts_workspace_active_name_idx
  on public.contacts(workspace_id, lower(full_name), created_at desc)
  where archived_at is null;

create index contacts_account_active_name_idx
  on public.contacts(account_id, lower(full_name), created_at desc)
  where archived_at is null;

create index contacts_account_archived_idx
  on public.contacts(account_id, archived_at desc)
  where archived_at is not null;

create index opportunity_contacts_contact_idx
  on public.opportunity_contacts(contact_id, opportunity_id);

create index opportunity_contacts_opportunity_idx
  on public.opportunity_contacts(opportunity_id, is_primary desc, updated_at desc);

create unique index opportunity_contacts_one_primary_idx
  on public.opportunity_contacts(opportunity_id)
  where is_primary = true;

create index call_contacts_contact_idx
  on public.call_contacts(contact_id, call_id);

create index call_contacts_call_idx
  on public.call_contacts(call_id, is_primary desc, created_at);

create unique index call_contacts_one_primary_idx
  on public.call_contacts(call_id)
  where is_primary = true;

create index contact_enrichment_profiles_contact_idx
  on public.contact_enrichment_profiles(contact_id);

create index contact_enrichment_runs_contact_created_idx
  on public.contact_enrichment_runs(contact_id, created_at desc);

create unique index contact_enrichment_runs_one_active_idx
  on public.contact_enrichment_runs(contact_id)
  where status in ('queued', 'running');

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

create or replace function public.set_contact_audit_user()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.account_id is distinct from old.account_id then
      raise exception 'Contacts cannot be moved between accounts or workspaces.'
        using errcode = '23514';
    end if;

    new.created_at = old.created_at;
    new.created_by_user_id = old.created_by_user_id;
  end if;

  if auth.uid() is not null then
    new.updated_by_user_id = auth.uid();

    if tg_op = 'INSERT' then
      new.created_by_user_id = auth.uid();
      new.created_at = now();
      new.updated_at = now();

      if new.archived_at is not null then
        new.archived_by = auth.uid();
      else
        new.archived_by = null;
      end if;
    else
      if new.archived_at is distinct from old.archived_at then
        if new.archived_at is null then
          new.archived_by = null;
        else
          new.archived_by = auth.uid();
        end if;
      else
        new.archived_by = old.archived_by;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_contacts_audit_user on public.contacts;
create trigger set_contacts_audit_user
before insert or update on public.contacts
for each row execute function public.set_contact_audit_user();

create or replace function public.set_contact_relationship_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by_user_id = auth.uid();
      new.created_at = now();
    end if;
  else
    if new.id is distinct from old.id then
      raise exception 'Contact relationship IDs cannot be changed.'
        using errcode = '23514';
    end if;

    new.created_by_user_id = old.created_by_user_id;
    new.created_at = old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists set_opportunity_contacts_audit_fields on public.opportunity_contacts;
create trigger set_opportunity_contacts_audit_fields
before insert or update on public.opportunity_contacts
for each row execute function public.set_contact_relationship_audit_fields();

drop trigger if exists set_call_contacts_audit_fields on public.call_contacts;
create trigger set_call_contacts_audit_fields
before insert or update on public.call_contacts
for each row execute function public.set_contact_relationship_audit_fields();

drop trigger if exists set_opportunity_contacts_updated_at on public.opportunity_contacts;
create trigger set_opportunity_contacts_updated_at before update on public.opportunity_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_call_contacts_updated_at on public.call_contacts;
create trigger set_call_contacts_updated_at before update on public.call_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_contact_enrichment_profiles_updated_at on public.contact_enrichment_profiles;
create trigger set_contact_enrichment_profiles_updated_at before update on public.contact_enrichment_profiles
for each row execute function public.set_updated_at();

alter table public.call_speakers
  add column contact_id uuid references public.contacts(id) on delete set null,
  add column contact_confirmed_at timestamptz,
  add column contact_confirmed_by uuid references auth.users(id) on delete set null,
  add constraint call_speakers_contact_confirmation_check
    check (
      (contact_id is null and contact_confirmed_at is null and contact_confirmed_by is null)
      or
      (contact_id is not null and contact_confirmed_at is not null and contact_confirmed_by is not null)
    );

alter table public.opportunity_stakeholders
  add column contact_id uuid references public.contacts(id) on delete set null,
  add column contact_confirmed_at timestamptz,
  add column contact_confirmed_by uuid references auth.users(id) on delete set null,
  add constraint opportunity_stakeholders_contact_confirmation_check
    check (
      (contact_id is null and contact_confirmed_at is null and contact_confirmed_by is null)
      or
      (contact_id is not null and contact_confirmed_at is not null and contact_confirmed_by is not null)
    ),
  add constraint opportunity_stakeholders_workspace_account_opportunity_fkey
    foreign key (workspace_id, account_id, opportunity_id)
    references public.opportunities(workspace_id, account_id, id)
    on delete cascade
    not valid;

alter table public.opportunity_stakeholders
  validate constraint opportunity_stakeholders_workspace_account_opportunity_fkey;

alter table public.customer_research_runs
  add column contact_id uuid references public.contacts(id) on delete set null;

create index call_speakers_contact_idx
  on public.call_speakers(contact_id)
  where contact_id is not null;

create index opportunity_stakeholders_contact_idx
  on public.opportunity_stakeholders(contact_id)
  where contact_id is not null;

create index customer_research_runs_contact_idx
  on public.customer_research_runs(contact_id, created_at desc)
  where contact_id is not null;

create or replace function public.validate_call_speaker_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contact_id is null then
    new.contact_confirmed_at = null;
    new.contact_confirmed_by = null;
    return new;
  end if;

  if not exists (
    select 1
    from public.call_contacts call_contact
    where call_contact.call_id = new.call_id
      and call_contact.contact_id = new.contact_id
  ) then
    raise exception 'The confirmed speaker contact is not selected for this call.'
      using errcode = '23514';
  end if;

  if auth.uid() is not null then
    new.contact_confirmed_by = auth.uid();

    if tg_op = 'INSERT' then
      new.contact_confirmed_at = now();
    elsif old.contact_id is distinct from new.contact_id then
      new.contact_confirmed_at = now();
    else
      new.contact_confirmed_at = coalesce(old.contact_confirmed_at, now());
    end if;
  end if;

  update public.call_contacts
  set attendance_status = 'attended'
  where call_id = new.call_id
    and contact_id = new.contact_id
    and attendance_status <> 'attended';

  return new;
end;
$$;

drop trigger if exists validate_call_speaker_contact_link on public.call_speakers;
create trigger validate_call_speaker_contact_link
before insert or update of call_id, contact_id, contact_confirmed_at, contact_confirmed_by on public.call_speakers
for each row execute function public.validate_call_speaker_contact();

create or replace function public.validate_opportunity_stakeholder_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contact_id is null then
    new.contact_confirmed_at = null;
    new.contact_confirmed_by = null;
    return new;
  end if;

  if not exists (
    select 1
    from public.opportunity_contacts opportunity_contact
    where opportunity_contact.opportunity_id = new.opportunity_id
      and opportunity_contact.contact_id = new.contact_id
  ) then
    raise exception 'The confirmed stakeholder contact is not selected for this opportunity.'
      using errcode = '23514';
  end if;

  if auth.uid() is not null then
    new.contact_confirmed_by = auth.uid();

    if tg_op = 'INSERT' then
      new.contact_confirmed_at = now();
    elsif old.contact_id is distinct from new.contact_id then
      new.contact_confirmed_at = now();
    else
      new.contact_confirmed_at = coalesce(old.contact_confirmed_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_opportunity_stakeholder_contact_link on public.opportunity_stakeholders;
create trigger validate_opportunity_stakeholder_contact_link
before insert or update of opportunity_id, contact_id, contact_confirmed_at, contact_confirmed_by on public.opportunity_stakeholders
for each row execute function public.validate_opportunity_stakeholder_contact();

create or replace function public.validate_customer_research_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contact_id is not null and not exists (
    select 1
    from public.contacts contact
    where contact.id = new.contact_id
      and contact.account_id = new.account_id
  ) then
    raise exception 'The research contact does not belong to this account.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_customer_research_contact_link on public.customer_research_runs;
create trigger validate_customer_research_contact_link
before insert or update of account_id, contact_id on public.customer_research_runs
for each row execute function public.validate_customer_research_contact();

create or replace function public.validate_active_contact_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
      or new.account_id is distinct from old.account_id
      or new.opportunity_id is distinct from old.opportunity_id
      or new.contact_id is distinct from old.contact_id
      or (
        tg_table_name = 'call_contacts'
        and (to_jsonb(new) ->> 'call_id') is distinct from (to_jsonb(old) ->> 'call_id')
      ) then
      raise exception 'Contact relationships cannot be moved between records.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if not exists (
    select 1
    from public.contacts contact
    where contact.id = new.contact_id
      and contact.workspace_id = new.workspace_id
      and contact.account_id = new.account_id
      and contact.archived_at is null
  ) then
    raise exception 'Archived contacts cannot be added to new opportunity or call relationships.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_active_opportunity_contact on public.opportunity_contacts;
create trigger validate_active_opportunity_contact
before insert or update of workspace_id, account_id, opportunity_id, contact_id on public.opportunity_contacts
for each row execute function public.validate_active_contact_relationship();

drop trigger if exists validate_active_call_contact on public.call_contacts;
create trigger validate_active_call_contact
before insert or update of workspace_id, account_id, opportunity_id, call_id, contact_id on public.call_contacts
for each row execute function public.validate_active_contact_relationship();

create or replace function public.clear_call_speaker_contact_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.call_speakers
  set contact_id = null,
      contact_confirmed_at = null,
      contact_confirmed_by = null
  where call_id = old.call_id
    and contact_id = old.contact_id;

  return old;
end;
$$;

drop trigger if exists clear_call_speaker_contact_before_relationship_delete on public.call_contacts;
create trigger clear_call_speaker_contact_before_relationship_delete
before delete on public.call_contacts
for each row execute function public.clear_call_speaker_contact_confirmation();

create or replace function public.clear_opportunity_stakeholder_contact_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.opportunity_stakeholders
  set contact_id = null,
      contact_confirmed_at = null,
      contact_confirmed_by = null
  where opportunity_id = old.opportunity_id
    and contact_id = old.contact_id;

  return old;
end;
$$;

drop trigger if exists clear_opportunity_stakeholder_contact_before_relationship_delete on public.opportunity_contacts;
create trigger clear_opportunity_stakeholder_contact_before_relationship_delete
before delete on public.opportunity_contacts
for each row execute function public.clear_opportunity_stakeholder_contact_confirmation();

create or replace function public.clear_contact_confirmation_links_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.call_speakers
  set contact_id = null,
      contact_confirmed_at = null,
      contact_confirmed_by = null
  where contact_id = old.id;

  update public.opportunity_stakeholders
  set contact_id = null,
      contact_confirmed_at = null,
      contact_confirmed_by = null
  where contact_id = old.id;

  update public.customer_research_runs
  set contact_id = null
  where contact_id = old.id;

  return old;
end;
$$;

drop trigger if exists clear_contact_confirmation_links_on_delete on public.contacts;
create trigger clear_contact_confirmation_links_on_delete
before delete on public.contacts
for each row execute function public.clear_contact_confirmation_links_before_delete();

create or replace function public.demote_archived_contact_relationships()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update public.opportunity_contacts
    set is_primary = false
    where contact_id = new.id
      and is_primary = true;
  end if;

  return new;
end;
$$;

drop trigger if exists demote_contact_relationships_on_archive on public.contacts;
create trigger demote_contact_relationships_on_archive
after update of archived_at on public.contacts
for each row execute function public.demote_archived_contact_relationships();

create or replace function public.can_access_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contacts contact
    where contact.id = target_contact_id
      and public.is_workspace_member_with_active_session(contact.workspace_id)
  );
$$;

create or replace function public.replace_opportunity_contacts(
  target_opportunity_id uuid,
  assignments jsonb
)
returns setof public.opportunity_contacts
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_opportunity public.opportunities%rowtype;
begin
  if jsonb_typeof(coalesce(assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Opportunity contact assignments must be a JSON array.'
      using errcode = '22023';
  end if;

  select *
  into target_opportunity
  from public.opportunities opportunity
  where opportunity.id = target_opportunity_id;

  if not found then
    raise exception 'Opportunity was not found.' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member_with_active_session(target_opportunity.workspace_id) then
    raise exception 'An active workspace session is required.' using errcode = '42501';
  end if;

  update public.opportunity_contacts
  set is_primary = false
  where opportunity_id = target_opportunity_id
    and is_primary = true;

  delete from public.opportunity_contacts opportunity_contact
  where opportunity_contact.opportunity_id = target_opportunity_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(assignments, '[]'::jsonb)) assignment
      where (assignment ->> 'contact_id')::uuid = opportunity_contact.contact_id
    );

  insert into public.opportunity_contacts (
    workspace_id,
    account_id,
    opportunity_id,
    contact_id,
    buying_roles,
    influence,
    relationship_strength,
    stance,
    is_primary,
    notes,
    created_by_user_id
  )
  select
    target_opportunity.workspace_id,
    target_opportunity.account_id,
    target_opportunity.id,
    assignment.contact_id,
    coalesce(assignment.buying_roles, '{}'::text[]),
    coalesce(assignment.influence, 'unknown'),
    coalesce(assignment.relationship_strength, 'unknown'),
    coalesce(assignment.stance, 'unknown'),
    coalesce(assignment.is_primary, false),
    nullif(btrim(assignment.notes), ''),
    auth.uid()
  from jsonb_to_recordset(coalesce(assignments, '[]'::jsonb)) as assignment(
    contact_id uuid,
    buying_roles text[],
    influence text,
    relationship_strength text,
    stance text,
    is_primary boolean,
    notes text
  )
  on conflict (opportunity_id, contact_id) do update
  set buying_roles = excluded.buying_roles,
      influence = excluded.influence,
      relationship_strength = excluded.relationship_strength,
      stance = excluded.stance,
      is_primary = excluded.is_primary,
      notes = excluded.notes;

  return query
    select opportunity_contact.*
    from public.opportunity_contacts opportunity_contact
    where opportunity_contact.opportunity_id = target_opportunity_id
    order by opportunity_contact.is_primary desc, opportunity_contact.created_at;
end;
$$;

create or replace function public.replace_call_contacts(
  target_call_id uuid,
  assignments jsonb
)
returns setof public.call_contacts
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_call public.calls%rowtype;
begin
  if jsonb_typeof(coalesce(assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Call contact assignments must be a JSON array.'
      using errcode = '22023';
  end if;

  select *
  into target_call
  from public.calls call_record
  where call_record.id = target_call_id;

  if not found then
    raise exception 'Call was not found.' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member_with_active_session(target_call.workspace_id) then
    raise exception 'An active workspace session is required.' using errcode = '42501';
  end if;

  insert into public.opportunity_contacts (
    workspace_id,
    account_id,
    opportunity_id,
    contact_id,
    created_by_user_id
  )
  select distinct
    target_call.workspace_id,
    target_call.account_id,
    target_call.opportunity_id,
    assignment.contact_id,
    auth.uid()
  from jsonb_to_recordset(coalesce(assignments, '[]'::jsonb)) as assignment(
    contact_id uuid,
    attendance_status text,
    is_primary boolean
  )
  join public.contacts contact
    on contact.id = assignment.contact_id
   and contact.workspace_id = target_call.workspace_id
   and contact.account_id = target_call.account_id
   and contact.archived_at is null
  on conflict (opportunity_id, contact_id) do nothing;

  update public.call_contacts
  set is_primary = false
  where call_id = target_call_id
    and is_primary = true;

  delete from public.call_contacts call_contact
  where call_contact.call_id = target_call_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(assignments, '[]'::jsonb)) assignment
      where (assignment ->> 'contact_id')::uuid = call_contact.contact_id
    );

  insert into public.call_contacts (
    workspace_id,
    account_id,
    opportunity_id,
    call_id,
    contact_id,
    attendance_status,
    is_primary,
    created_by_user_id
  )
  select
    target_call.workspace_id,
    target_call.account_id,
    target_call.opportunity_id,
    target_call.id,
    assignment.contact_id,
    coalesce(assignment.attendance_status, 'expected'),
    coalesce(assignment.is_primary, false),
    auth.uid()
  from jsonb_to_recordset(coalesce(assignments, '[]'::jsonb)) as assignment(
    contact_id uuid,
    attendance_status text,
    is_primary boolean
  )
  on conflict (call_id, contact_id) do update
  set attendance_status = excluded.attendance_status,
      is_primary = excluded.is_primary;

  return query
    select call_contact.*
    from public.call_contacts call_contact
    where call_contact.call_id = target_call_id
    order by call_contact.is_primary desc, call_contact.created_at;
end;
$$;

create or replace function public.get_latest_contact_enrichment_runs(target_contact_ids uuid[])
returns table (
  contact_id uuid,
  status text,
  error_message text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (run.contact_id)
    run.contact_id,
    run.status,
    run.error_message,
    run.created_at
  from public.contact_enrichment_runs run
  where run.contact_id = any(coalesce(target_contact_ids, '{}'::uuid[]))
    and public.is_workspace_member_with_active_session(run.workspace_id)
  order by run.contact_id, run.created_at desc, run.id desc;
$$;

create or replace function public.finalize_contact_enrichment_run(
  target_run_id uuid,
  target_contact_id uuid,
  target_workspace_id uuid,
  target_account_id uuid,
  target_user_id uuid,
  model_name text,
  profile_payload jsonb,
  core_fields jsonb,
  result_payload jsonb,
  source_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_record public.contact_enrichment_runs%rowtype;
  contact_record public.contacts%rowtype;
  proposed_updates jsonb := '{}'::jsonb;
  applied_updates jsonb := '{}'::jsonb;
  field_payload jsonb;
  field_value text;
  enriched_at timestamptz := now();
begin
  select run.*
  into run_record
  from public.contact_enrichment_runs run
  where run.id = target_run_id
    and run.contact_id = target_contact_id
    and run.workspace_id = target_workspace_id
    and run.account_id = target_account_id
    and run.status = 'running'
  for update;

  if not found then
    return false;
  end if;

  select contact.*
  into contact_record
  from public.contacts contact
  where contact.id = target_contact_id
    and contact.workspace_id = target_workspace_id
    and contact.account_id = target_account_id
  for update;

  if not found or contact_record.archived_at is not null then
    raise exception 'The contact is no longer available for enrichment.'
      using errcode = '23514';
  end if;

  field_payload := coalesce(core_fields -> 'jobTitle', '{}'::jsonb);
  field_value := nullif(btrim(field_payload ->> 'value'), '');
  if field_value is not null then
    proposed_updates := proposed_updates || jsonb_build_object('jobTitle', field_payload);
    if field_payload ->> 'confidence' = 'high' and coalesce(btrim(contact_record.job_title), '') = '' then
      update public.contacts
      set job_title = field_value,
          updated_by_user_id = target_user_id
      where id = target_contact_id
        and coalesce(btrim(job_title), '') = '';
      if found then
        applied_updates := applied_updates || jsonb_build_object('jobTitle', field_value);
        contact_record.job_title := field_value;
      end if;
    end if;
  end if;

  field_payload := coalesce(core_fields -> 'department', '{}'::jsonb);
  field_value := nullif(btrim(field_payload ->> 'value'), '');
  if field_value is not null then
    proposed_updates := proposed_updates || jsonb_build_object('department', field_payload);
    if field_payload ->> 'confidence' = 'high' and coalesce(btrim(contact_record.department), '') = '' then
      update public.contacts
      set department = field_value,
          updated_by_user_id = target_user_id
      where id = target_contact_id
        and coalesce(btrim(department), '') = '';
      if found then
        applied_updates := applied_updates || jsonb_build_object('department', field_value);
        contact_record.department := field_value;
      end if;
    end if;
  end if;

  field_payload := coalesce(core_fields -> 'seniority', '{}'::jsonb);
  field_value := nullif(btrim(field_payload ->> 'value'), '');
  if field_value is not null then
    proposed_updates := proposed_updates || jsonb_build_object('seniority', field_payload);
    if field_payload ->> 'confidence' = 'high' and coalesce(btrim(contact_record.seniority), '') = '' then
      update public.contacts
      set seniority = field_value,
          updated_by_user_id = target_user_id
      where id = target_contact_id
        and coalesce(btrim(seniority), '') = '';
      if found then
        applied_updates := applied_updates || jsonb_build_object('seniority', field_value);
        contact_record.seniority := field_value;
      end if;
    end if;
  end if;

  field_payload := coalesce(core_fields -> 'location', '{}'::jsonb);
  field_value := nullif(btrim(field_payload ->> 'value'), '');
  if field_value is not null then
    proposed_updates := proposed_updates || jsonb_build_object('location', field_payload);
    if field_payload ->> 'confidence' = 'high' and coalesce(btrim(contact_record.location), '') = '' then
      update public.contacts
      set location = field_value,
          updated_by_user_id = target_user_id
      where id = target_contact_id
        and coalesce(btrim(location), '') = '';
      if found then
        applied_updates := applied_updates || jsonb_build_object('location', field_value);
      end if;
    end if;
  end if;

  insert into public.contact_enrichment_profiles (
    workspace_id,
    account_id,
    contact_id,
    professional_summary,
    role_scope,
    likely_priorities,
    likely_kpis,
    relevant_experience,
    recent_professional_signals,
    discovery_angles,
    caveats,
    confidence,
    sources,
    last_enriched_at,
    created_by_user_id,
    updated_by_user_id
  ) values (
    target_workspace_id,
    target_account_id,
    target_contact_id,
    nullif(btrim(profile_payload ->> 'professionalSummary'), ''),
    nullif(btrim(profile_payload ->> 'roleScope'), ''),
    nullif(btrim(profile_payload ->> 'likelyPriorities'), ''),
    nullif(btrim(profile_payload ->> 'likelyKpis'), ''),
    nullif(btrim(profile_payload ->> 'relevantExperience'), ''),
    nullif(btrim(profile_payload ->> 'recentProfessionalSignals'), ''),
    nullif(btrim(profile_payload ->> 'discoveryAngles'), ''),
    nullif(btrim(profile_payload ->> 'caveats'), ''),
    greatest(0, least(1, coalesce((profile_payload ->> 'confidence')::numeric, 0))),
    coalesce(source_payload, '{}'::jsonb),
    enriched_at,
    target_user_id,
    target_user_id
  )
  on conflict (workspace_id, contact_id) do update
  set account_id = excluded.account_id,
      professional_summary = excluded.professional_summary,
      role_scope = excluded.role_scope,
      likely_priorities = excluded.likely_priorities,
      likely_kpis = excluded.likely_kpis,
      relevant_experience = excluded.relevant_experience,
      recent_professional_signals = excluded.recent_professional_signals,
      discovery_angles = excluded.discovery_angles,
      caveats = excluded.caveats,
      confidence = excluded.confidence,
      sources = excluded.sources,
      last_enriched_at = excluded.last_enriched_at,
      updated_by_user_id = excluded.updated_by_user_id;

  update public.contact_enrichment_runs
  set applied_core_updates = applied_updates,
      completed_at = enriched_at,
      enrichment_payload = coalesce(result_payload, '{}'::jsonb),
      error_message = null,
      model = model_name,
      proposed_core_updates = proposed_updates,
      sources = coalesce(source_payload, '{}'::jsonb),
      status = 'completed'
  where id = target_run_id
    and status = 'running';

  if not found then
    raise exception 'The contact enrichment lease is no longer active.'
      using errcode = '40001';
  end if;

  return true;
end;
$$;

alter table public.contacts enable row level security;
alter table public.opportunity_contacts enable row level security;
alter table public.call_contacts enable row level security;
alter table public.contact_enrichment_profiles enable row level security;
alter table public.contact_enrichment_runs enable row level security;

create policy "Workspace members can read contacts"
on public.contacts for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

create policy "Workspace members can create contacts"
on public.contacts for insert
to authenticated
with check (
  public.is_workspace_member_with_active_session(workspace_id)
  and (created_by_user_id is null or created_by_user_id = auth.uid())
);

create policy "Workspace members can update contacts"
on public.contacts for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (
  public.is_workspace_member_with_active_session(workspace_id)
  and (updated_by_user_id is null or updated_by_user_id = auth.uid())
);

create policy "Workspace members can manage opportunity contacts"
on public.opportunity_contacts for all
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

create policy "Workspace members can manage call contacts"
on public.call_contacts for all
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

create policy "Workspace members can read contact enrichment profiles"
on public.contact_enrichment_profiles for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

create policy "Workspace members can read contact enrichment runs"
on public.contact_enrichment_runs for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

revoke all on function public.can_access_contact(uuid) from public;
revoke all on function public.replace_opportunity_contacts(uuid, jsonb) from public;
revoke all on function public.replace_call_contacts(uuid, jsonb) from public;
revoke all on function public.get_latest_contact_enrichment_runs(uuid[]) from public;
revoke all on function public.finalize_contact_enrichment_run(uuid, uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.can_access_contact(uuid) to authenticated;
grant execute on function public.replace_opportunity_contacts(uuid, jsonb) to authenticated;
grant execute on function public.replace_call_contacts(uuid, jsonb) to authenticated;
grant execute on function public.get_latest_contact_enrichment_runs(uuid[]) to authenticated;
grant execute on function public.finalize_contact_enrichment_run(uuid, uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb) to service_role;
