-- Spec 047, T4: "Número de eventos de hoy en el icono", on by default (RF-12).
-- Protected by the existing profiles policies (only the owner reads and
-- updates it).
alter table public.profiles
  add column badge_today boolean not null default true;
