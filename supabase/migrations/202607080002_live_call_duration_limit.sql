alter table public.calls
  add column if not exists duration_limit_seconds integer not null default 7200,
  add column if not exists ended_reason text not null default 'seller_stopped';

alter table public.calls
  drop constraint if exists calls_duration_limit_seconds_check;

alter table public.calls
  add constraint calls_duration_limit_seconds_check
  check (duration_limit_seconds > 0 and duration_limit_seconds <= 7200);

alter table public.calls
  drop constraint if exists calls_ended_reason_check;

alter table public.calls
  add constraint calls_ended_reason_check
  check (ended_reason in ('seller_stopped', 'time_limit_reached', 'start_cancelled', 'start_failed'));

update public.calls
set
  duration_limit_seconds = coalesce(duration_limit_seconds, 7200),
  ended_reason = coalesce(nullif(ended_reason, ''), 'seller_stopped')
where duration_limit_seconds is null
  or ended_reason is null
  or ended_reason = '';

create index if not exists calls_workspace_active_started_idx
  on public.calls (workspace_id, started_at desc)
  where ended_at is null;
