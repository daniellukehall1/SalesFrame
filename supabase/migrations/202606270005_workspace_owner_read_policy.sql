drop policy if exists "Workspace members can read workspaces" on public.workspaces;

create policy "Workspace members can read workspaces"
on public.workspaces for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_workspace_member(id)
);
