create or replace function public.workspace_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  workspace_id_text text;
begin
  workspace_id_text := (storage.foldername(object_name))[1];
  return workspace_id_text::uuid;
exception
  when others then
    return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'call-recordings',
    'call-recordings',
    false,
    524288000,
    array[
      'audio/aac',
      'audio/flac',
      'audio/m4a',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]
  ),
  (
    'call-artifacts',
    'call-artifacts',
    false,
    52428800,
    array[
      'application/json',
      'text/plain',
      'text/markdown',
      'text/vtt'
    ]
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can read call recordings" on storage.objects;
create policy "Workspace members can read call recordings"
on storage.objects for select
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can upload call recordings" on storage.objects;
create policy "Workspace members can upload call recordings"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can update call recordings" on storage.objects;
create policy "Workspace members can update call recordings"
on storage.objects for update
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
)
with check (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can delete call recordings" on storage.objects;
create policy "Workspace members can delete call recordings"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'call-recordings'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can read call artifacts" on storage.objects;
create policy "Workspace members can read call artifacts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can upload call artifacts" on storage.objects;
create policy "Workspace members can upload call artifacts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can update call artifacts" on storage.objects;
create policy "Workspace members can update call artifacts"
on storage.objects for update
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
)
with check (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

drop policy if exists "Workspace members can delete call artifacts" on storage.objects;
create policy "Workspace members can delete call artifacts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'call-artifacts'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

revoke all on function public.workspace_id_from_storage_path(text) from public;
grant execute on function public.workspace_id_from_storage_path(text) to authenticated;
