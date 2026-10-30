-- Spec 013, T8: series in the copies of ownerless calendars and in the upload
-- to Google (plan "series-copy-upload", D14; RF-26, RF-30). merge_calendars
-- needs no change: the composite foreign key moves the exceptions (D15).

-- copy_calendar_for_owner (last in copy_calendar_images_fix) also copies the
-- series columns, and each exception points to the copy of its series (RF-26).
create or replace function public.copy_calendar_for_owner(p_calendar_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy uuid;
begin
  insert into public.calendars (owner_id, name, description, color)
  select p_user_id, c.name, c.description, c.color
  from public.calendars c
  where c.id = p_calendar_id
  returning id into v_copy;

  if v_copy is null then
    raise exception 'Calendar not found' using errcode = 'P0002';
  end if;

  insert into public.event_categories (calendar_id, name)
  select v_copy, ec.name
  from public.event_categories ec
  where ec.calendar_id = p_calendar_id;

  -- apply_orphan_decisions copies several times in one transaction.
  drop table if exists pg_temp.copied_events;
  create temporary table pg_temp.copied_events on commit drop as
  select e.id as source_id, gen_random_uuid() as copy_id
  from public.events e
  where e.calendar_id = p_calendar_id;

  -- Series before their exceptions: the trigger of each exception looks for
  -- its series among the rows already inserted.
  insert into public.events (
    id, calendar_id, title, description, location, starts_at, ends_at,
    all_day, color, category_id, created_by,
    recurrence, recurrence_tz, recurrence_until, exdates, series_id, original_start
  )
  select
    m.copy_id, v_copy, e.title, e.description, e.location, e.starts_at, e.ends_at,
    e.all_day, e.color, nc.id, e.created_by,
    e.recurrence, e.recurrence_tz, e.recurrence_until, e.exdates, ms.copy_id, e.original_start
  from pg_temp.copied_events m
  join public.events e on e.id = m.source_id
  left join pg_temp.copied_events ms on ms.source_id = e.series_id
  left join public.event_categories oc on oc.id = e.category_id
  left join public.event_categories nc
    on nc.calendar_id = v_copy
    and lower(btrim(nc.name)) = lower(btrim(oc.name))
  order by e.series_id nulls first;

  insert into public.event_images (
    event_id, object_id, uploaded_by, status, bytes, width, height, created_at
  )
  select m.copy_id, i.object_id, i.uploaded_by, 'ready', i.bytes, i.width, i.height, i.created_at
  from pg_temp.copied_events m
  join public.event_images i on i.event_id = m.source_id
  where i.status = 'ready';

  return v_copy;
end;
$$;

-- sync_attach_uploaded (last in sync_write_functions): a synced calendar has
-- no series (RF-29), so each uploaded occurrence becomes a single event. An
-- element of p_mapping is { event_id, external_id } for a row (single event or
-- exception) or { series_id, starts_at, ends_at, external_id } for an
-- occurrence without a row. Exceptions stay as single events and the series
-- go: occurrences outside the window are lost, as the upload page warns (RF-30).
create or replace function public.sync_attach_uploaded(
  p_secret text,
  p_calendar_id uuid,
  p_connection_id uuid,
  p_external_id text,
  p_mapping jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.calendar_connections;
begin
  perform public.sync_check_secret(p_secret);

  perform 1 from public.calendars
  where id = p_calendar_id
    and owner_id = (select auth.uid())
    and not public.is_synced_calendar(id)
  for update;
  if not found then
    raise exception 'Invalid calendar' using errcode = 'CF404';
  end if;

  v_connection := public.sync_own_writable_connection(p_connection_id);

  update public.events e
  set external_id = m.external_id
  from jsonb_to_recordset(coalesce(p_mapping, '[]'::jsonb)) as m(event_id uuid, external_id text)
  where m.event_id is not null and e.id = m.event_id and e.calendar_id = p_calendar_id;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    color, category_id, created_by, external_id
  )
  select
    s.calendar_id, s.title, s.description, s.location, m.starts_at, m.ends_at, s.all_day,
    s.color, s.category_id, s.created_by, m.external_id
  from jsonb_to_recordset(coalesce(p_mapping, '[]'::jsonb))
    as m(series_id uuid, starts_at timestamptz, ends_at timestamptz, external_id text)
  join public.events s
    on s.id = m.series_id and s.calendar_id = p_calendar_id and s.recurrence is not null;

  update public.events
  set series_id = null, original_start = null
  where calendar_id = p_calendar_id and series_id is not null;
  delete from public.events
  where calendar_id = p_calendar_id and recurrence is not null;

  insert into public.synced_calendars (
    calendar_id, connection_id, provider, external_id, google_access, last_synced_at
  )
  values (p_calendar_id, p_connection_id, v_connection.provider, p_external_id, 'owner', now());
end;
$$;
