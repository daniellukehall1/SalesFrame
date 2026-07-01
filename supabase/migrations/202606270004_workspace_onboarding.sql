alter table public.workspaces
add column if not exists onboarding_completed_at timestamptz;
