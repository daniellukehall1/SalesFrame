alter table public.calls
  add column if not exists recording_status text not null default 'none',
  add column if not exists recording_mime_type text,
  add column if not exists recording_size_bytes bigint,
  add column if not exists recording_ready_at timestamptz,
  add column if not exists recording_error text;

alter table public.calls
  drop constraint if exists calls_recording_status_check;

alter table public.calls
  add constraint calls_recording_status_check
  check (recording_status in ('none', 'recording', 'uploading', 'processing', 'ready', 'failed'));

update public.calls
set recording_status = case
  when recording_storage_path is not null then 'ready'
  else 'none'
end
where recording_status = 'none';
