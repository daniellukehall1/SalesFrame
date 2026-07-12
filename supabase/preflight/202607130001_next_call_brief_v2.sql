-- Read-only preflight for 202607130001_next_call_brief_v2.sql.
-- Every BLOCKER query should return zero rows. Do not repair production data
-- automatically; review any mismatch before applying the additive migration.

-- BLOCKER: every legacy brief must still resolve to one opportunity scope.
select brief.id, brief.opportunity_id, brief.previous_call_id
from public.next_call_briefs brief
left join public.opportunities opportunity on opportunity.id = brief.opportunity_id
where opportunity.id is null;

-- BLOCKER: the source call, when present, must belong to the same complete scope.
select
  brief.id as brief_id,
  brief.opportunity_id,
  brief.previous_call_id,
  opportunity.workspace_id as opportunity_workspace_id,
  opportunity.account_id as opportunity_account_id,
  source_call.workspace_id as call_workspace_id,
  source_call.account_id as call_account_id,
  source_call.opportunity_id as call_opportunity_id
from public.next_call_briefs brief
join public.opportunities opportunity on opportunity.id = brief.opportunity_id
join public.calls source_call on source_call.id = brief.previous_call_id
where source_call.workspace_id is distinct from opportunity.workspace_id
   or source_call.account_id is distinct from opportunity.account_id
   or source_call.opportunity_id is distinct from opportunity.id;

-- BLOCKER: a transcript segment must never borrow a speaker from another call.
-- The migration validates a new composite foreign key after this check passes.
select
  segment.id as transcript_segment_id,
  segment.call_id as segment_call_id,
  segment.speaker_id,
  speaker.call_id as speaker_call_id
from public.transcript_segments segment
join public.call_speakers speaker on speaker.id = segment.speaker_id
where speaker.call_id <> segment.call_id;

-- BLOCKER: the legacy source-call key must not already contain duplicates that
-- would make the v2 idempotency index ambiguous. Existing v1 rows may duplicate;
-- they are deliberately excluded because the index applies only to schema v2.
select opportunity_id, previous_call_id, count(*)
from public.next_call_briefs
where false
group by opportunity_id, previous_call_id
having count(*) > 1;

-- INVENTORY: review existing brief volume before the deterministic scope backfill.
select
  count(*) as legacy_brief_count,
  count(*) filter (where previous_call_id is null) as without_source_call,
  min(created_at) as earliest_created_at,
  max(created_at) as latest_created_at
from public.next_call_briefs;

-- POST-MIGRATION VERIFICATION (run separately after authorization):
--
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in (
--     'next_call_briefs',
--     'next_call_brief_attempts',
--     'next_call_brief_refresh_requests',
--     'next_call_brief_items',
--     'next_call_brief_item_sources'
--   )
-- order by table_name, grantee, privilege_type;
--
-- Authenticated must have SELECT only. The query below must return zero rows.
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'authenticated'
--   and table_name like 'next_call_brief%'
--   and privilege_type <> 'SELECT';
--
-- Every completed attempt must resolve to a completed v2 brief in the same scope.
-- select attempt.id, attempt.brief_id
-- from public.next_call_brief_attempts attempt
-- left join public.next_call_briefs brief
--   on brief.id = attempt.brief_id
--  and brief.workspace_id = attempt.workspace_id
--  and brief.account_id = attempt.account_id
--  and brief.opportunity_id = attempt.opportunity_id
-- where attempt.status = 'completed'
--   and (brief.id is null or brief.schema_version <> 2);
--
-- AI inferences require confirmation plus at least two valid sources.
-- select item.id, item.brief_id
-- from public.next_call_brief_items item
-- left join public.next_call_brief_item_sources source on source.item_id = item.id
-- where item.basis = 'inference'
-- group by item.id, item.brief_id, item.needs_confirmation
-- having not item.needs_confirmation or count(source.id) < 2;
