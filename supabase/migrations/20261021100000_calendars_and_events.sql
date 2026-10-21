-- Spec 002, T1: categories, view preferences, event columns, limits and
-- visible_people (plan "Modelo de datos"). RLS is enabled on every new table
-- (constitution P3).

-- Limits aligned with the spec (RF-4, RF-16, RF-19) ----------------------------

alter table public.calendars
  drop constraint calendars_name_check,
  add constraint calendars_name_check
    check (char_length(trim(name)) between 1 and 50);

alter table public.events
  drop constraint events_title_check,
  drop constraint events_description_check,
  drop constraint events_location_check,
  add constraint events_title_check
    check (char_length(trim(title)) between 1 and 100),
  add constraint events_description_check
    check (char_length(description) <= 2000),
  add constraint events_location_check
    check (char_length(location) <= 200);

-- Categories (RF-9..RF-14) -----------------------------------------------------

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite FK from events (RF-28).
  constraint event_categories_id_calendar_key unique (id, calendar_id)
);

-- Unique per calendar ignoring case and outer spaces (RF-10).
create unique index event_categories_calendar_name_idx
  on public.event_categories (calendar_id, lower(trim(name)));

alter table public.event_categories enable row level security;

create trigger event_categories_set_updated_at
  before update on public.event_categories
  for each row execute function public.set_updated_at();

-- Event color and category (RF-16, RF-28, RF-12) -------------------------------

alter table public.events
  add column color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  add column category_id uuid;

-- A category must belong to the event's own calendar; deleting it leaves the
-- event uncategorised. Deferrable so merge_calendars can reorder updates.
alter table public.events
  add constraint events_category_fkey
    foreign key (category_id, calendar_id)
    references public.event_categories (id, calendar_id)
    on delete set null (category_id)
    deferrable initially immediate;

create index events_category_id_idx on public.events (category_id);

-- Moving an event to another calendar drops a category that does not exist
-- there (RF-27).
create function public.events_reset_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null
    and not exists (
      select 1
      from public.event_categories
      where id = new.category_id
        and calendar_id = new.calendar_id
    )
  then
    new.category_id := null;
  end if;
  return new;
end;
$$;

create trigger events_reset_category
  before update of calendar_id on public.events
  for each row
  when (new.calendar_id is distinct from old.calendar_id)
  execute function public.events_reset_category();

revoke execute on function public.events_reset_category()
from public, anon, authenticated;

-- View preferences (RF-45, RF-46, RF-48) ---------------------------------------
-- Rows are created on demand: no row means visible and last in the list.

create table public.calendar_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  visible boolean not null default true,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, calendar_id)
);

create index calendar_preferences_calendar_id_idx
  on public.calendar_preferences (calendar_id);

create table public.person_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

create index person_preferences_person_id_idx
  on public.person_preferences (person_id);

alter table public.calendar_preferences enable row level security;
alter table public.person_preferences enable row level security;

create trigger calendar_preferences_set_updated_at
  before update on public.calendar_preferences
  for each row execute function public.set_updated_at();

create trigger person_preferences_set_updated_at
  before update on public.person_preferences
  for each row execute function public.set_updated_at();

-- Policies ---------------------------------------------------------------------

create policy "event_categories_select_member" on public.event_categories
  for select to authenticated
  using (public.is_calendar_member(calendar_id));

create policy "event_categories_insert_editor" on public.event_categories
  for insert to authenticated
  with check (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

create policy "event_categories_update_editor" on public.event_categories
  for update to authenticated
  using (public.calendar_role_for(calendar_id) in ('owner', 'editor'))
  with check (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

create policy "event_categories_delete_editor" on public.event_categories
  for delete to authenticated
  using (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

create policy "calendar_preferences_select_own" on public.calendar_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar_preferences_insert_own" on public.calendar_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.is_calendar_member(calendar_id)
  );

create policy "calendar_preferences_update_own" on public.calendar_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and public.is_calendar_member(calendar_id)
  );

create policy "calendar_preferences_delete_own" on public.calendar_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "person_preferences_select_own" on public.person_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "person_preferences_insert_own" on public.person_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "person_preferences_update_own" on public.person_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "person_preferences_delete_own" on public.person_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- People the user shares calendars with (RF-42) --------------------------------
-- SECURITY DEFINER because profiles are private to their owner; it exposes only
-- id and display_name (not the time zone) of the user and of the owners of
-- calendars the user belongs to.

create function public.visible_people()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = (select auth.uid())
    or exists (
      select 1
      from public.calendars c
      where c.owner_id = p.id
        and public.is_calendar_member(c.id)
    );
$$;

revoke execute on function public.visible_people() from public, anon;
grant execute on function public.visible_people() to authenticated;
