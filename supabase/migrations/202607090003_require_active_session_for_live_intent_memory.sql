drop policy if exists "Workspace members can manage call intent ledger" on public.call_intent_ledger;
create policy "Workspace members can manage call intent ledger"
on public.call_intent_ledger for all
to authenticated
using (
  public.is_workspace_member_with_active_session(public.call_intent_ledger.workspace_id)
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
  public.is_workspace_member_with_active_session(public.call_intent_ledger.workspace_id)
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
  public.is_workspace_member_with_active_session(public.opportunity_stakeholders.workspace_id)
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
  public.is_workspace_member_with_active_session(public.opportunity_stakeholders.workspace_id)
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
