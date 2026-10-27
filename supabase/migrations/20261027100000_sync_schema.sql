-- Spec 007, T2: connected accounts and synced calendars (plan "Modelo de
-- datos", D6, D12, D15; RF-6, RF-7, RF-26).
--
-- The refresh token lives in Vault; calendar_connection_secrets only keeps its
-- id and no client can read it. Clients never write these tables: the T3 and T4
-- functions do.

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_subject text not null,
  account_email text not null,
  status text not null default 'active' check (status in ('active', 'needs_reauth')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, account_subject)
);

create trigger calendar_connections_set_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

create table public.calendar_connection_secrets (
  connection_id uuid primary key references public.calendar_connections (id) on delete cascade,
  vault_secret_id uuid not null
);

-- Deleting a connection (disconnect or account deletion) also drops its token.
create function public.delete_connection_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$$;

create trigger calendar_connection_secrets_delete_vault
  after delete on public.calendar_connection_secrets
  for each row execute function public.delete_connection_secret();

-- Deleting the connection keeps the calendar as a normal one (D12).
create table public.synced_calendars (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  external_id text not null,
  state text not null default 'active' check (state in ('active', 'missing')),
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error text,
  last_summary jsonb,
  sync_started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index synced_calendars_connection_id_idx on public.synced_calendars (connection_id);

alter table public.events add column external_id text;

create unique index events_calendar_external_id_key
  on public.events (calendar_id, external_id)
  where external_id is not null;

alter table public.account_notices drop constraint account_notices_kind_check;
alter table public.account_notices add constraint account_notices_kind_check
  check (kind in ('orphaned', 'kept_copy', 'deleted_calendar', 'sync_revoked', 'sync_failing'));

-- RLS (P3) ---------------------------------------------------------------------

alter table public.calendar_connections enable row level security;
alter table public.calendar_connection_secrets enable row level security;
alter table public.synced_calendars enable row level security;

revoke all on public.calendar_connections from anon, authenticated;
revoke all on public.calendar_connection_secrets from anon, authenticated;
revoke all on public.synced_calendars from anon, authenticated;

grant select on public.calendar_connections to authenticated;
grant select on public.synced_calendars to authenticated;

create policy "calendar_connections_select_own" on public.calendar_connections
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Members see the sync state, never the account email (RF-26).
create policy "synced_calendars_select_member" on public.synced_calendars
  for select to authenticated
  using (public.is_calendar_member(calendar_id));
