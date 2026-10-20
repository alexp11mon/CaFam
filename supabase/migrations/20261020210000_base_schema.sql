-- Spec 001, T4: base schema (plan "Modelo de datos").
-- Access policies live in the next migration; RLS is enabled here so no table
-- is ever exposed without it (constitution P3).

create type public.calendar_role as enum ('owner', 'editor', 'viewer');

-- Tables -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 50),
  time_zone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  color text not null default '#2563EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendars_owner_id_idx on public.calendars (owner_id);

create table public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.calendar_role not null,
  created_at timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

create index calendar_members_user_id_idx on public.calendar_members (user_id);
create unique index calendar_members_single_owner_idx
  on public.calendar_members (calendar_id)
  where role = 'owner';

create table public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  location text check (char_length(location) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_starts check (ends_at >= starts_at)
);

create index events_calendar_id_starts_at_idx on public.events (calendar_id, starts_at);
create index events_created_by_idx on public.events (created_by);

alter table public.profiles enable row level security;
alter table public.calendars enable row level security;
alter table public.calendar_members enable row level security;
alter table public.events enable row level security;

-- updated_at -----------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger calendars_set_updated_at
  before update on public.calendars
  for each row execute function public.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Time zone validation (RF-26) -----------------------------------------------
-- Sign-up metadata comes from the browser and can be tampered with, so the
-- database guarantees the value: on insert an unknown zone falls back to
-- Europe/Madrid (sign-up never fails), on update it is rejected.

create function public.validate_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.time_zone is null
    or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = new.time_zone
    )
  then
    if tg_op = 'INSERT' then
      new.time_zone := 'Europe/Madrid';
    else
      raise exception 'Invalid time zone: %', new.time_zone
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_validate_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.validate_time_zone();

-- Ownership ----------------------------------------------------------------

create function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.calendar_members (calendar_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger calendars_add_owner_membership
  after insert on public.calendars
  for each row execute function public.add_owner_membership();

-- Ownership transfer is out of scope: owner_id is immutable.
create function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger calendars_prevent_owner_change
  before update of owner_id on public.calendars
  for each row execute function public.prevent_owner_change();

-- New user (RF-4, RF-26) -----------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, time_zone)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'display_name'),
    new.raw_user_meta_data ->> 'time_zone'
  );

  insert into public.calendars (owner_id, name)
  values (new.id, 'Mi calendario');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions are never called directly.
revoke execute on function
  public.set_updated_at(),
  public.validate_time_zone(),
  public.add_owner_membership(),
  public.prevent_owner_change(),
  public.handle_new_user()
from public, anon, authenticated;
