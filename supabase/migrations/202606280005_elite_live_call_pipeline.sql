alter table public.calls
add column if not exists audio_preflight jsonb not null default '{}'::jsonb,
add column if not exists audio_source_summary jsonb not null default '[]'::jsonb,
add column if not exists guidance_readiness jsonb not null default '{}'::jsonb;

alter table public.transcript_segments
add column if not exists openai_item_id text,
add column if not exists openai_segment_id text,
add column if not exists audio_source_kind text,
add column if not exists client_turn_id text,
add column if not exists turn_sequence integer,
add column if not exists transcription_delay text,
add column if not exists quality_flags jsonb not null default '[]'::jsonb;

alter table public.live_guidance_events
add column if not exists ui_mode text,
add column if not exists conversation_state jsonb not null default '{}'::jsonb,
add column if not exists candidate_scores jsonb not null default '[]'::jsonb,
add column if not exists source_turn_ids jsonb not null default '[]'::jsonb,
add column if not exists guidance_latency_ms integer check (guidance_latency_ms is null or guidance_latency_ms >= 0);

create unique index if not exists transcript_segments_call_source_openai_item_unique_idx
on public.transcript_segments(call_id, audio_source_kind, openai_item_id)
where openai_item_id is not null and openai_segment_id is null;

create unique index if not exists transcript_segments_call_source_openai_segment_unique_idx
on public.transcript_segments(call_id, audio_source_kind, openai_segment_id)
where openai_segment_id is not null;

create unique index if not exists transcript_segments_call_client_turn_unique_idx
on public.transcript_segments(call_id, client_turn_id)
where client_turn_id is not null;

create index if not exists transcript_segments_call_turn_sequence_idx
on public.transcript_segments(call_id, turn_sequence);
