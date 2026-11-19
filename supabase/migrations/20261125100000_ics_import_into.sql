-- Spec 044, T2: imported events keep their .ics identity in external_id, and
-- an .ics can be imported into a calendar that already exists without
-- duplicating what is there (RF-1..RF-4; plan "Modelo de datos").

-- Same body as in remove_old_blue, now storing external_id. A file that repeats
-- an identity keeps the first one (the app already drops the repeats).
create or replace function public.import_calendar(
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
    coalesce(p_color, '#A0C4FF')
  )
  returning id into v_id;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by, external_id
  )
  select
    v_id,
    e.title,
    e.description,
    e.location,
    e.starts_at,
    e.ends_at,
    coalesce(e.all_day, false),
    (select auth.uid()),
    e.external_id
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text
  )
  on conflict (calendar_id, external_id) where external_id is not null
  do nothing;

  return v_id;
end;
$$;

-- Imports into a normal calendar the caller can write (owner or editor). The
-- events already there with the same identity are left alone (RF-2), and the
-- calendar keeps 10,000 imported events at most (RF-4). SECURITY INVOKER: the
-- policies of events check the role too.
create function public.import_into_calendar(p_calendar_id uuid, p_events jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_added integer;
  v_total integer;
begin
  if p_events is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) not between 1 and 2000 then
    raise exception 'Events must be an array of 1 to 2000 items'
      using errcode = '22023';
  end if;
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner'
    and public.calendar_role_for(p_calendar_id) is distinct from 'editor' then
    raise exception 'Calendar not writable' using errcode = 'CF404';
  end if;
  if public.is_synced_calendar(p_calendar_id) then
    raise exception 'A calendar brought from an account has its own sync'
      using errcode = '22023';
  end if;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by, external_id
  )
  select
    p_calendar_id,
    e.title,
    e.description,
    e.location,
    e.starts_at,
    e.ends_at,
    coalesce(e.all_day, false),
    (select auth.uid()),
    e.external_id
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text
  )
  on conflict (calendar_id, external_id) where external_id is not null
  do nothing;
  get diagnostics v_added = row_count;

  select count(*)
  into v_total
  from public.events
  where calendar_id = p_calendar_id and external_id is not null;
  if v_total > 10000 then
    raise exception 'imported' using errcode = 'CF429';
  end if;

  return jsonb_build_object(
    'added', v_added,
    'existing', jsonb_array_length(p_events) - v_added
  );
end;
$$;

revoke all on function public.import_into_calendar(uuid, jsonb) from public, anon;
grant execute on function public.import_into_calendar(uuid, jsonb) to authenticated;
