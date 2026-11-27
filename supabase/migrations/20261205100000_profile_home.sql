-- Spec 054: screen the app opens on, saved in the account so it holds on
-- every device (RF-24, RF-26). The existing profiles policies cover it.

alter table public.profiles
  add column home text not null default 'calendar'
  constraint profiles_home_check check (home in ('calendar', 'now'));
