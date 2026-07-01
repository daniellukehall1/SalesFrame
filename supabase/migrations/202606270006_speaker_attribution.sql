do $$
begin
  alter type public.speaker_role add value if not exists 'customer_3';
exception
  when duplicate_object then null;
end $$;

alter table public.transcript_segments
  add column if not exists speaker_confidence numeric(4,3)
    check (speaker_confidence is null or (speaker_confidence >= 0 and speaker_confidence <= 1)),
  add column if not exists speaker_attribution text,
  add column if not exists speaker_source text,
  add column if not exists speaker_needs_review boolean not null default false,
  add column if not exists speaker_attribution_reason text;

create index if not exists transcript_segments_call_review_idx
on public.transcript_segments(call_id, speaker_needs_review)
where speaker_needs_review = true;

create index if not exists transcript_segments_call_speaker_confidence_idx
on public.transcript_segments(call_id, speaker_confidence);
