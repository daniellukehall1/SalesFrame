alter table public.opportunity_field_evidence
  add column if not exists confidence numeric(4,3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists source text;

create table if not exists public.live_guidance_feedback (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  guidance_event_id uuid references public.live_guidance_events(id) on delete set null,
  action text not null check (action in ('asked', 'too_soon', 'softer', 'skip', 'use_next', 'move_later')),
  question text,
  target text,
  playbook_label text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists live_guidance_feedback_call_created_at_idx
on public.live_guidance_feedback(call_id, created_at desc);

create index if not exists live_guidance_feedback_opportunity_created_at_idx
on public.live_guidance_feedback(opportunity_id, created_at desc);

alter table public.live_guidance_feedback enable row level security;

drop policy if exists "Workspace members can manage live guidance feedback" on public.live_guidance_feedback;
create policy "Workspace members can manage live guidance feedback"
on public.live_guidance_feedback for all
to authenticated
using (public.can_access_opportunity(opportunity_id))
with check (public.can_access_opportunity(opportunity_id));
