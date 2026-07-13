-- Separately authorized, non-transactional maintenance step for Conversation
-- Mode search. Run each statement outside a transaction after measuring table
-- size and index-build headroom. CONCURRENTLY avoids blocking live CRM and
-- transcript writes; these statements must not be moved into a Supabase
-- transactional migration.

create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;

create index concurrently if not exists assistant_accounts_name_trgm_idx
  on public.accounts using gin (lower(name) gin_trgm_ops)
  where archived_at is null;

create index concurrently if not exists assistant_accounts_website_trgm_idx
  on public.accounts using gin (lower(coalesce(website, '')) gin_trgm_ops)
  where archived_at is null;

create index concurrently if not exists assistant_opportunities_search_trgm_idx
  on public.opportunities using gin (
    lower(name || ' ' || coalesce(stage, '') || ' ' || coalesce(next_step, '')) gin_trgm_ops
  ) where archived_at is null;

create index concurrently if not exists assistant_contacts_search_trgm_idx
  on public.contacts using gin (
    lower(full_name || ' ' || coalesce(preferred_name, '') || ' ' ||
      coalesce(job_title, '') || ' ' || coalesce(department, '')) gin_trgm_ops
  ) where archived_at is null;

create index concurrently if not exists assistant_transcript_text_fts_idx
  on public.transcript_segments using gin (
    to_tsvector('english'::regconfig, coalesce(text, ''))
  ) where is_final = true;
