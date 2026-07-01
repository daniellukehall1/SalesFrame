alter table public.workspaces
  add column if not exists default_currency text not null default 'AUD';

alter table public.accounts
  add column if not exists currency text not null default 'AUD';

update public.accounts account
set currency = coalesce(workspace.default_currency, 'AUD')
from public.workspaces workspace
where account.workspace_id = workspace.id
  and (account.currency is null or account.currency = '');

alter table public.workspaces
  drop constraint if exists workspaces_default_currency_check;

alter table public.workspaces
  add constraint workspaces_default_currency_check
  check (default_currency in ('AUD', 'USD', 'NZD', 'GBP', 'EUR', 'CAD', 'SGD', 'JPY'));

alter table public.accounts
  drop constraint if exists accounts_currency_check;

alter table public.accounts
  add constraint accounts_currency_check
  check (currency in ('AUD', 'USD', 'NZD', 'GBP', 'EUR', 'CAD', 'SGD', 'JPY'));
