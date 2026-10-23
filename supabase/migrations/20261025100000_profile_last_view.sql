-- Spec 008, T10: the last calendar view each user chose, the same on every
-- device (plan "Modelo de datos", D7; RF-25 to RF-27).
--
-- A column on profiles, as the accent of spec 005: the existing "own row only"
-- select and update policies already keep it private (P3). Null means never
-- chosen, and the calendar falls back to the agenda (RF-26). visible_people()
-- and calendar_members_with_names() list their columns explicitly, so they
-- never expose it.

alter table public.profiles
  add column last_view text
  constraint profiles_last_view_check
    check (last_view in ('agenda', 'month', 'week', 'day'));
