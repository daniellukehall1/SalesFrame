create table if not exists public.workspace_session_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  idle_timeout_seconds integer,
  warning_after_seconds integer not null default 2700,
  absolute_timeout_seconds integer not null default 86400,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_session_policies_idle_timeout_check
    check (idle_timeout_seconds is null or idle_timeout_seconds in (3600, 14400, 28800, 86400, 604800)),
  constraint workspace_session_policies_warning_check
    check (warning_after_seconds >= 60 and warning_after_seconds < absolute_timeout_seconds),
  constraint workspace_session_policies_absolute_check
    check (absolute_timeout_seconds = 86400)
);

create table if not exists public.workspace_session_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  active_call_id uuid references public.calls(id) on delete set null,
  active_call_started_at timestamptz,
  expires_at timestamptz not null,
  expired_at timestamptz,
  expired_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_session_activity_reason_check
    check (expired_reason is null or expired_reason in ('idle_timeout', 'absolute_timeout', 'signed_out', 'supabase_expired')),
  constraint workspace_session_activity_unique_key
    unique (workspace_id, user_id, session_key)
);

create index if not exists workspace_session_activity_user_workspace_idx
  on public.workspace_session_activity(workspace_id, user_id, session_key);

create index if not exists workspace_session_activity_expires_idx
  on public.workspace_session_activity(workspace_id, expires_at);

drop trigger if exists set_workspace_session_policies_updated_at on public.workspace_session_policies;
create trigger set_workspace_session_policies_updated_at before update on public.workspace_session_policies
for each row execute function public.set_updated_at();

drop trigger if exists set_workspace_session_activity_updated_at on public.workspace_session_activity;
create trigger set_workspace_session_activity_updated_at before update on public.workspace_session_activity
for each row execute function public.set_updated_at();

insert into public.workspace_session_policies (workspace_id)
select workspace.id
from public.workspaces workspace
on conflict (workspace_id) do nothing;

create or replace function public.ensure_workspace_session_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_session_policies (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ensure_workspace_session_policy_on_workspace_insert on public.workspaces;
create trigger ensure_workspace_session_policy_on_workspace_insert
after insert on public.workspaces
for each row execute function public.ensure_workspace_session_policy();

create or replace function public.current_salesframe_session_key()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'session_id', auth.uid()::text, '');
$$;

create or replace function public.is_workspace_session_active(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_session_activity session
    where session.workspace_id = target_workspace_id
      and session.user_id = auth.uid()
      and session.session_key = public.current_salesframe_session_key()
      and session.expired_at is null
      and session.expires_at > now()
  );
$$;

create or replace function public.is_workspace_member_with_active_session(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workspace_member(target_workspace_id)
    and public.is_workspace_session_active(target_workspace_id);
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
      and public.is_workspace_member_with_active_session(opportunity.workspace_id)
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
      and public.is_workspace_member_with_active_session(call.workspace_id)
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
        or public.is_workspace_member_with_active_session(playbook.workspace_id)
      )
  );
$$;

alter table public.workspace_session_policies enable row level security;
alter table public.workspace_session_activity enable row level security;

drop policy if exists "Workspace members can read session policies" on public.workspace_session_policies;
create policy "Workspace members can read session policies"
on public.workspace_session_policies for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace owners can update session policies" on public.workspace_session_policies;
create policy "Workspace owners can update session policies"
on public.workspace_session_policies for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Workspace owners can create session policies" on public.workspace_session_policies;
create policy "Workspace owners can create session policies"
on public.workspace_session_policies for insert
to authenticated
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Users can read own workspace sessions" on public.workspace_session_activity;
create policy "Users can read own workspace sessions"
on public.workspace_session_activity for select
to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Users can create own workspace sessions" on public.workspace_session_activity;
create policy "Users can create own workspace sessions"
on public.workspace_session_activity for insert
to authenticated
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Users can update own workspace sessions" on public.workspace_session_activity;
create policy "Users can update own workspace sessions"
on public.workspace_session_activity for update
to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read accounts" on public.accounts;
create policy "Workspace members can read accounts"
on public.accounts for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can insert accounts" on public.accounts;
create policy "Workspace members can insert accounts"
on public.accounts for insert
to authenticated
with check (public.is_workspace_member_with_active_session(workspace_id) and owner_user_id = auth.uid());

drop policy if exists "Workspace members can update accounts" on public.accounts;
create policy "Workspace members can update accounts"
on public.accounts for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can delete accounts" on public.accounts;
create policy "Workspace members can delete accounts"
on public.accounts for delete
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can read opportunities" on public.opportunities;
create policy "Workspace members can read opportunities"
on public.opportunities for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can insert opportunities" on public.opportunities;
create policy "Workspace members can insert opportunities"
on public.opportunities for insert
to authenticated
with check (public.is_workspace_member_with_active_session(workspace_id) and owner_user_id = auth.uid());

drop policy if exists "Workspace members can update opportunities" on public.opportunities;
create policy "Workspace members can update opportunities"
on public.opportunities for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can delete opportunities" on public.opportunities;
create policy "Workspace members can delete opportunities"
on public.opportunities for delete
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can read calls" on public.calls;
create policy "Workspace members can read calls"
on public.calls for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can insert calls" on public.calls;
create policy "Workspace members can insert calls"
on public.calls for insert
to authenticated
with check (public.is_workspace_member_with_active_session(workspace_id) and created_by_user_id = auth.uid());

drop policy if exists "Workspace members can update calls" on public.calls;
create policy "Workspace members can update calls"
on public.calls for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can delete calls" on public.calls;
create policy "Workspace members can delete calls"
on public.calls for delete
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Authenticated users can read system and workspace playbooks" on public.playbooks;
create policy "Authenticated users can read system and workspace playbooks"
on public.playbooks for select
to authenticated
using (is_system or public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can insert custom playbooks" on public.playbooks;
create policy "Workspace members can insert custom playbooks"
on public.playbooks for insert
to authenticated
with check (workspace_id is not null and not is_system and public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can update custom playbooks" on public.playbooks;
create policy "Workspace members can update custom playbooks"
on public.playbooks for update
to authenticated
using (workspace_id is not null and not is_system and public.is_workspace_member_with_active_session(workspace_id))
with check (workspace_id is not null and not is_system and public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can delete custom playbooks" on public.playbooks;
create policy "Workspace members can delete custom playbooks"
on public.playbooks for delete
to authenticated
using (workspace_id is not null and not is_system and public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can manage custom playbook fields" on public.playbook_fields;
create policy "Workspace members can manage custom playbook fields"
on public.playbook_fields for all
to authenticated
using (
  exists (
    select 1
    from public.playbooks playbook
    where playbook.id = public.playbook_fields.playbook_id
      and playbook.workspace_id is not null
      and not playbook.is_system
      and public.is_workspace_member_with_active_session(playbook.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.playbooks playbook
    where playbook.id = public.playbook_fields.playbook_id
      and playbook.workspace_id is not null
      and not playbook.is_system
      and public.is_workspace_member_with_active_session(playbook.workspace_id)
  )
);

drop policy if exists "Users can manage own seller research profiles" on public.seller_research_profiles;
create policy "Users can manage own seller research profiles"
on public.seller_research_profiles for all
to authenticated
using (user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can manage customer research runs" on public.customer_research_runs;
create policy "Workspace members can manage customer research runs"
on public.customer_research_runs for all
to authenticated
using (
  exists (
    select 1
    from public.accounts account
    where account.id = public.customer_research_runs.account_id
      and public.is_workspace_member_with_active_session(account.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.accounts account
    where account.id = public.customer_research_runs.account_id
      and public.is_workspace_member_with_active_session(account.workspace_id)
  )
);

drop policy if exists "Workspace members can manage account enrichment profiles" on public.account_enrichment_profiles;
create policy "Workspace members can manage account enrichment profiles"
on public.account_enrichment_profiles for all
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can manage account enrichment runs" on public.account_enrichment_runs;
create policy "Workspace members can manage account enrichment runs"
on public.account_enrichment_runs for all
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can read csv import runs" on public.csv_import_runs;
create policy "Workspace members can read csv import runs"
on public.csv_import_runs for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can create csv import runs" on public.csv_import_runs;
create policy "Workspace members can create csv import runs"
on public.csv_import_runs for insert
to authenticated
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can update csv import runs" on public.csv_import_runs;
create policy "Workspace members can update csv import runs"
on public.csv_import_runs for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can read ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can read ai enrichment jobs"
on public.ai_enrichment_jobs for select
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can create ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can create ai enrichment jobs"
on public.ai_enrichment_jobs for insert
to authenticated
with check (public.is_workspace_member_with_active_session(workspace_id));

drop policy if exists "Workspace members can update ai enrichment jobs" on public.ai_enrichment_jobs;
create policy "Workspace members can update ai enrichment jobs"
on public.ai_enrichment_jobs for update
to authenticated
using (public.is_workspace_member_with_active_session(workspace_id))
with check (public.is_workspace_member_with_active_session(workspace_id));

revoke all on function public.current_salesframe_session_key() from public;
revoke all on function public.is_workspace_session_active(uuid) from public;
revoke all on function public.is_workspace_member_with_active_session(uuid) from public;
grant execute on function public.current_salesframe_session_key() to authenticated;
grant execute on function public.is_workspace_session_active(uuid) to authenticated;
grant execute on function public.is_workspace_member_with_active_session(uuid) to authenticated;
