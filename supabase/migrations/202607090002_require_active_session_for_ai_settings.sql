drop policy if exists "Users can manage own workspace AI settings" on public.user_ai_settings;
create policy "Users can manage own workspace AI settings"
on public.user_ai_settings for all
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
)
with check (
  user_id = auth.uid()
  and public.is_workspace_member_with_active_session(workspace_id)
);
