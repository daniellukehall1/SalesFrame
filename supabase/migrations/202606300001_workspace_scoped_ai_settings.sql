alter table public.user_ai_settings
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

with first_workspace as (
  select distinct on (member.user_id)
    member.user_id,
    member.workspace_id
  from public.workspace_members member
  order by member.user_id, member.created_at asc
)
update public.user_ai_settings settings
set workspace_id = first_workspace.workspace_id
from first_workspace
where settings.workspace_id is null
  and settings.user_id = first_workspace.user_id;

delete from public.user_ai_settings
where workspace_id is null;

alter table public.user_ai_settings
alter column workspace_id set not null;

alter table public.user_ai_settings
drop constraint if exists user_ai_settings_user_id_provider_key;

alter table public.user_ai_settings
drop constraint if exists user_ai_settings_workspace_user_provider_key;

alter table public.user_ai_settings
add constraint user_ai_settings_workspace_user_provider_key
unique (workspace_id, user_id, provider);

create index if not exists user_ai_settings_workspace_id_idx
on public.user_ai_settings(workspace_id);

drop policy if exists "Users can manage own AI settings" on public.user_ai_settings;
create policy "Users can manage own workspace AI settings"
on public.user_ai_settings for all
to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
