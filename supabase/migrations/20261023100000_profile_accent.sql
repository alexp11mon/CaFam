-- Spec 005, T1: the accent color each user picks for the interface
-- (plan "Modelo de datos", D4; RF-8, RF-10, RF-13).
--
-- A column on profiles, not a new table: the existing "own row only" select
-- and update policies already keep it private (RF-13), and existing rows and
-- new sign-ups get red through the default (RF-10). visible_people() and
-- calendar_members_with_names() list their columns explicitly, so they never
-- expose it.

alter table public.profiles
  add column accent text not null default 'red'
  constraint profiles_accent_check
    check (accent in ('red', 'blue', 'green', 'yellow', 'purple', 'gray'));
