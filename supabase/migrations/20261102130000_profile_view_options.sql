-- Spec 019, T5: weekends and the default duration of a new event, per account
-- (RF-23, RF-24, RF-30, RF-31). Protected by the existing profiles policies
-- (only the owner reads and updates); visible_people(),
-- calendar_members_with_names and assistant_people() do not expose them.
alter table public.profiles
  add column show_weekends boolean not null default true,
  add column default_event_minutes smallint not null default 60
    check (default_event_minutes in (15, 30, 45, 60, 90, 120));
