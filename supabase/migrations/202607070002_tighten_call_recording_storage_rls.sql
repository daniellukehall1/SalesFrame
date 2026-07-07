create or replace function public.call_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  call_id_text text;
begin
  call_id_text := (storage.foldername(object_name))[2];
  return call_id_text::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.storage_path_matches_call_workspace(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calls call
    where call.id = public.call_id_from_storage_path(object_name)
      and call.workspace_id = public.workspace_id_from_storage_path(object_name)
  );
$$;

drop policy if exists "Workspace members can read call recordings" on storage.objects;
create policy "Workspace members can read call recordings"
on storage.objects for select
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can upload call recordings" on storage.objects;
create policy "Workspace members can upload call recordings"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can update call recordings" on storage.objects;
create policy "Workspace members can update call recordings"
on storage.objects for update
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
)
with check (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can delete call recordings" on storage.objects;
create policy "Workspace members can delete call recordings"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

revoke all on function public.call_id_from_storage_path(text) from public;
grant execute on function public.call_id_from_storage_path(text) to authenticated;
revoke all on function public.storage_path_matches_call_workspace(text) from public;
grant execute on function public.storage_path_matches_call_workspace(text) to authenticated;
