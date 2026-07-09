drop policy if exists "Workspace members can read call artifacts" on storage.objects;
create policy "Workspace members can read call artifacts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can upload call artifacts" on storage.objects;
create policy "Workspace members can upload call artifacts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can update call artifacts" on storage.objects;
create policy "Workspace members can update call artifacts"
on storage.objects for update
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
)
with check (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);

drop policy if exists "Workspace members can delete call artifacts" on storage.objects;
create policy "Workspace members can delete call artifacts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member_with_active_session(public.workspace_id_from_storage_path(name))
  and public.storage_path_matches_call_workspace(name)
  and public.can_access_call(public.call_id_from_storage_path(name))
);
