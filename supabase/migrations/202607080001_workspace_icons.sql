alter table public.workspaces
  add column if not exists workspace_icon text not null default 'building-2';

alter table public.workspaces
  drop constraint if exists workspaces_workspace_icon_check;

alter table public.workspaces
  add constraint workspaces_workspace_icon_check
  check (
    workspace_icon in (
      'building-2',
      'briefcase-business',
      'globe-2',
      'landmark',
      'rocket',
      'target',
      'chart-no-axes-combined',
      'handshake',
      'network',
      'factory',
      'store',
      'school',
      'hospital',
      'banknote',
      'shield-check',
      'sparkles'
    )
  );
