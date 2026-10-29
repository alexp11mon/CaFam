-- Spec 011, T1: the theme each user picks (plan "Modelo de datos"; RF-2, RF-4).
--
-- A column on profiles, like the accent (spec 005): the "own row only" select
-- and update policies keep it private, and existing rows and new sign-ups get
-- "system" through the default (RF-2). visible_people() and
-- calendar_members_with_names() list their columns explicitly, so they never
-- expose it.

alter table public.profiles
  add column theme text not null default 'system'
  constraint profiles_theme_check
    check (theme in ('light', 'dark', 'system'));
