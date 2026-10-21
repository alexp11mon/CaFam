-- Spec 004, T1: create a calendar and its events from an imported .ics in one
-- transaction (plan "Funciones SQL", D5; RF-7, RF-11, RF-12, RF-27, RF-30).
--
-- SECURITY INVOKER: every statement still goes through RLS, so the database
-- stays the permission boundary (P3). The body of a function is one
-- transaction, so any failing event leaves no calendar behind (RF-30). It
-- stores nothing about the source and does not look for duplicates (RF-11,
-- RF-12).

create function public.import_calendar(
  p_name text,
  p_color text,
  p_events jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_events is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) not between 1 and 2000 then
    raise exception 'Events must be an array of 1 to 2000 items'
      using errcode = '22023';
  end if;

  insert into public.calendars (owner_id, name, color)
  values (
    (select auth.uid()),
    p_name,
    coalesce(p_color, '#2563EB')
  )
  returning id into v_id;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by
  )
  select
    v_id,
    e.title,
    e.description,
    e.location,
    e.starts_at,
    e.ends_at,
    coalesce(e.all_day, false),
    (select auth.uid())
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean
  );

  return v_id;
end;
$$;

revoke execute on function public.import_calendar(text, text, jsonb)
from public, anon;
grant execute on function public.import_calendar(text, text, jsonb)
to authenticated;
