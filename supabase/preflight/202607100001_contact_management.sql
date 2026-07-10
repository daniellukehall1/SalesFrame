-- Read-only production preflight for 202607100001_contact_management.sql.
-- Run before deployment. Any returned row must be reviewed and remediated
-- explicitly before validating calls_workspace_account_opportunity_id_fkey.

select
  call_row.id as call_id,
  call_row.workspace_id,
  call_row.account_id as call_account_id,
  opportunity.account_id as opportunity_account_id,
  call_row.opportunity_id,
  call_row.started_at,
  call_row.status
from public.calls call_row
join public.opportunities opportunity
  on opportunity.id = call_row.opportunity_id
 and opportunity.workspace_id = call_row.workspace_id
where call_row.account_id is distinct from opportunity.account_id
order by call_row.started_at desc nulls last, call_row.id;

-- After the query above returns zero rows, validation is safe to run in a
-- separately reviewed maintenance migration:
-- alter table public.calls
--   validate constraint calls_workspace_account_opportunity_id_fkey;
