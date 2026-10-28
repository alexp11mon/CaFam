-- Spec 007, T12: private calendar groups (RF-35 to RF-43, RF-46, plan D13, D14).
-- A group belongs to one user; the calendar goes in its own row of
-- calendar_preferences, so "one calendar, one group" is the primary key and
-- leaving or deleting a calendar already drops the assignment (RF-43).

create table public.calendar_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (
    char_length(btrim(name)) between 1 and 40 and char_length(name) <= 40
  ),
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite key below: a group of another user cannot be assigned.
  unique (id, user_id)
);

create unique index calendar_groups_user_name_key
  on public.calendar_groups (user_id, lower(btrim(name)));

alter table public.calendar_groups enable row level security;

create trigger calendar_groups_set_updated_at
  before update on public.calendar_groups
  for each row execute function public.set_updated_at();

create policy "calendar_groups_select_own" on public.calendar_groups
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar_groups_insert_own" on public.calendar_groups
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "calendar_groups_update_own" on public.calendar_groups
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "calendar_groups_delete_own" on public.calendar_groups
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Deleting a group sets only group_id to null: visibility and order stay (RF-41).
alter table public.calendar_preferences
  add column group_id uuid,
  add constraint calendar_preferences_group_fkey
    foreign key (group_id, user_id)
    references public.calendar_groups (id, user_id)
    on delete set null (group_id);

create index calendar_preferences_group_id_idx
  on public.calendar_preferences (group_id);
