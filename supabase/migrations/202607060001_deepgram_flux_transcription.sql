alter table public.transcript_segments
add column if not exists transcription_provider text,
add column if not exists provider_session_id text,
add column if not exists provider_turn_index integer,
add column if not exists provider_event_id text,
add column if not exists end_of_turn_confidence numeric(4,3)
  check (end_of_turn_confidence is null or (end_of_turn_confidence >= 0 and end_of_turn_confidence <= 1)),
add column if not exists word_confidence numeric(4,3)
  check (word_confidence is null or (word_confidence >= 0 and word_confidence <= 1)),
add column if not exists language_detected text,
add column if not exists diarization_speaker text;

create unique index if not exists transcript_segments_call_provider_turn_unique_idx
on public.transcript_segments(
  call_id,
  audio_source_kind,
  transcription_provider,
  provider_session_id,
  provider_turn_index
)
where transcription_provider is not null
  and provider_session_id is not null
  and provider_turn_index is not null;

create unique index if not exists transcript_segments_call_provider_event_unique_idx
on public.transcript_segments(
  call_id,
  audio_source_kind,
  transcription_provider,
  provider_event_id
)
where transcription_provider is not null
  and provider_event_id is not null;

create index if not exists transcript_segments_call_provider_idx
on public.transcript_segments(call_id, transcription_provider, provider_session_id);
