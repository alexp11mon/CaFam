-- Spec 006, T2: calendars without owner, notices, decisions, mail queue and
-- recovery limiter (plan "Modelo de datos", D2, D10; RF-5, RF-21, RF-22, RF-23).
--
-- A calendar loses its owner when its owner deletes the account while other
-- members remain (RF-21). Only the account functions (later migrations) may
-- change owner_id, and they say so with a transaction flag (D2).

-- Calendars without owner --------------------------------------------------------

alter table public.calendars alter column owner_id drop not null;

alter table public.calendars add column orphaned_at timestamptz;

alter table public.calendars
  add constraint calendars_orphaned_at_check
  check ((owner_id is null) = (orphaned_at is not null));

create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
    and coalesce(current_setting('app.account_transfer', true), '') <> 'on' then
    raise exception 'owner_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Tables -------------------------------------------------------------------------

create table public.calendar_orphan_decisions (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  keep boolean not null,
  decided_at timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

create table public.account_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('orphaned', 'kept_copy', 'deleted_calendar')),
  person_name text not null default '',
  calendar_name text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index account_notices_user_id_idx
  on public.account_notices (user_id, created_at desc);

-- Pending mail for the scheduled sender (plan D4). Holds other people's
-- addresses, so no client can see it.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_outbox_pending_idx
  on public.email_outbox (created_at)
  where sent_at is null;

-- SHA-256 of recovery requests per account (plan D6). Stores no address.
create table public.auth_email_requests (
  email_hash bytea not null,
  created_at timestamptz not null default now()
);

create index auth_email_requests_hash_idx
  on public.auth_email_requests (email_hash, created_at desc);

alter table public.calendar_orphan_decisions enable row level security;
alter table public.account_notices enable row level security;
alter table public.email_outbox enable row level security;
alter table public.auth_email_requests enable row level security;

-- Privileges and policies ----------------------------------------------------------
-- Clients only read their own decisions and notices. Everything else is written
-- by functions, so the mail queue and the hashes have no policy at all.

revoke all on public.calendar_orphan_decisions from anon, authenticated;
revoke all on public.account_notices from anon, authenticated;
revoke all on public.email_outbox from anon, authenticated;
revoke all on public.auth_email_requests from anon, authenticated;

grant select on public.calendar_orphan_decisions to authenticated;
grant select on public.account_notices to authenticated;

create policy "calendar_orphan_decisions_select_own" on public.calendar_orphan_decisions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "account_notices_select_own" on public.account_notices
  for select to authenticated
  using ((select auth.uid()) = user_id);
