-- Spec 003, T1: sharing tables, member policies and cleanup trigger
-- (plan "Modelo de datos", D1, D6; RF-11, RF-16, RF-24..RF-31).
--
-- Secrets (invite token, PIN) only exist as hashes, and the hash columns are
-- hidden with column privileges. Joining is done by SECURITY DEFINER functions
-- (later migrations); nobody inserts into calendar_members directly (D1).

create extension if not exists pgcrypto with schema extensions;

-- Tables -------------------------------------------------------------------------

create table public.calendar_invites (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  token_hash bytea not null unique,
  role public.calendar_role not null check (role in ('editor', 'viewer')),
  max_uses integer not null check (max_uses between 1 and 20),
  use_count integer not null default 0,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint calendar_invites_use_count_check
    check (use_count >= 0 and use_count <= max_uses)
);

create index calendar_invites_calendar_id_idx
  on public.calendar_invites (calendar_id);

create table public.calendar_access_codes (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  public_code text not null unique check (char_length(public_code) = 8),
  pin_hash text not null,
  role public.calendar_role not null check (role in ('editor', 'viewer')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger calendar_access_codes_set_updated_at
  before update on public.calendar_access_codes
  for each row execute function public.set_updated_at();

-- Only failed attempts are stored (D4, D5).
create table public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null check (char_length(code) <= 32),
  created_at timestamptz not null default now()
);

create index join_attempts_user_id_created_at_idx
  on public.join_attempts (user_id, created_at desc);
create index join_attempts_code_created_at_idx
  on public.join_attempts (code, created_at desc);

alter table public.calendar_invites enable row level security;
alter table public.calendar_access_codes enable row level security;
alter table public.join_attempts enable row level security;

-- Privileges ---------------------------------------------------------------------
-- No client writes these tables; only the owner reads them, minus the hashes.

revoke all on public.calendar_invites from anon, authenticated;
revoke all on public.calendar_access_codes from anon, authenticated;
revoke all on public.join_attempts from anon, authenticated;

grant select (
  id, calendar_id, role, max_uses, use_count, created_by, expires_at,
  revoked_at, created_at
) on public.calendar_invites to authenticated;

grant select (
  calendar_id, public_code, role, enabled, created_at, updated_at
) on public.calendar_access_codes to authenticated;

create policy "calendar_invites_select_owner" on public.calendar_invites
  for select to authenticated
  using (public.calendar_role_for(calendar_id) = 'owner');

create policy "calendar_access_codes_select_owner" on public.calendar_access_codes
  for select to authenticated
  using (public.calendar_role_for(calendar_id) = 'owner');

-- calendar_members: change role, expel, leave (RF-25..RF-28) ------------------------
-- Column privilege: only `role` can be updated (user_id and calendar_id cannot).

revoke update on public.calendar_members from authenticated;
grant update (role) on public.calendar_members to authenticated;

create policy "calendar_members_update_owner" on public.calendar_members
  for update to authenticated
  using (
    role <> 'owner' and public.calendar_role_for(calendar_id) = 'owner'
  )
  with check (
    role in ('editor', 'viewer')
    and public.calendar_role_for(calendar_id) = 'owner'
  );

create policy "calendar_members_delete" on public.calendar_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (
      public.calendar_role_for(calendar_id) = 'owner'
      or user_id = (select auth.uid())
    )
  );

-- Leaving drops the user preferences for that calendar (RF-31). Events and
-- categories they created do not depend on membership and stay (RF-30).
-- SECURITY DEFINER: when the owner expels someone, the owner RLS would not let
-- them delete the other user preferences.

create function public.calendar_members_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.calendar_preferences
  where user_id = old.user_id
    and calendar_id = old.calendar_id;
  return old;
end;
$$;

create trigger calendar_members_cleanup
  after delete on public.calendar_members
  for each row execute function public.calendar_members_cleanup();

revoke execute on function public.calendar_members_cleanup()
from public, anon, authenticated;
