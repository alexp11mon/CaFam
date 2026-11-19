-- Spec 045, T1: an event with a time may have its own time zone (RF-1..RF-12;
-- plan D1, D2). The instants starts_at/ends_at keep their meaning: the zone
-- only says in which wall clock the event was written. Null = no own zone.

alter table public.events
  add column start_tz text,
  add column end_tz text;

comment on column public.events.start_tz is
  'Own time zone of the start (IANA); null = the profile''s zone of whoever edits (spec 045).';
comment on column public.events.end_tz is
  'Time zone of the end; equals start_tz unless the event spans two zones (spec 045 RF-2).';

-- Valid like profiles.time_zone, without pg_timezone_names (slow, spec 013).
-- All-day events have no zone (RF-7); end_tz follows start_tz when missing.
create function public.events_time_zone_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.all_day or new.start_tz is null then
    new.start_tz := null;
    new.end_tz := null;
    return new;
  end if;
  new.end_tz := coalesce(new.end_tz, new.start_tz);
  if tg_op = 'INSERT'
    or new.start_tz is distinct from old.start_tz
    or new.end_tz is distinct from old.end_tz
  then
    begin
      perform now() at time zone new.start_tz;
      perform now() at time zone new.end_tz;
    exception when invalid_parameter_value then
      raise exception 'Invalid time zone' using errcode = '22023';
    end;
  end if;
  return new;
end;
$$;

create trigger events_time_zone_rules
before insert or update of start_tz, end_tz, all_day on public.events
for each row execute function public.events_time_zone_rules();

-- The functions that copy event columns by name now carry the zone too
-- (copies of orphaned calendars, Google/iCloud writes and reads, .ics imports
-- and refreshes). snapshot_event and restore_event copy whole rows already.

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
    created_by, external_id, start_tz, end_tz
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
    e.external_id,
    e.start_tz,
    e.end_tz
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text,
    start_tz text,
    end_tz text
  )
  on conflict (calendar_id, external_id) where external_id is not null
  do nothing;

  return v_id;
end;
$$;

create or replace function public.import_into_calendar(p_calendar_id uuid, p_events jsonb)
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
    created_by, external_id, start_tz, end_tz
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
    e.external_id,
    e.start_tz,
    e.end_tz
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text,
    start_tz text,
    end_tz text
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

create or replace function public.ics_apply_events(
  p_secret text,
  p_calendar_id uuid,
  p_events jsonb,
  p_read_at timestamptz,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.ics_subscriptions;
  v_added integer;
  v_changed integer;
  v_removed integer;
  v_summary jsonb;
begin
  perform public.sync_check_secret(p_secret);
  if p_events is null or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) > 2000 then
    raise exception 'Events must be an array of at most 2000 items' using errcode = '22023';
  end if;
  select * into v_sub from public.ics_subscriptions where calendar_id = p_calendar_id for update;
  if not found then
    raise exception 'No subscription' using errcode = 'CF404';
  end if;

  create temp table incoming on commit drop as
  select *
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text,
    start_tz text,
    end_tz text
  );

  update public.events e
  set title = i.title,
      description = i.description,
      location = i.location,
      starts_at = i.starts_at,
      ends_at = i.ends_at,
      all_day = coalesce(i.all_day, false),
      start_tz = i.start_tz,
      end_tz = i.end_tz
  from pg_temp.incoming i
  where e.calendar_id = p_calendar_id
    and e.external_id = i.external_id
    and (p_read_at is null or e.updated_at < p_read_at)
    and (e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, e.start_tz, e.end_tz)
      is distinct from (i.title, i.description, i.location, i.starts_at, i.ends_at, coalesce(i.all_day, false), i.start_tz, i.end_tz);
  get diagnostics v_changed = row_count;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by, external_id, start_tz, end_tz
  )
  select p_calendar_id, i.title, i.description, i.location, i.starts_at,
    i.ends_at, coalesce(i.all_day, false), v_sub.created_by, i.external_id, i.start_tz, i.end_tz
  from pg_temp.incoming i
  on conflict (calendar_id, external_id) where external_id is not null
  do nothing;
  get diagnostics v_added = row_count;

  delete from public.events e
  where e.calendar_id = p_calendar_id
    and e.external_id = any (v_sub.feed_ids)
    and e.starts_at < p_to
    and e.ends_at > p_from
    and (p_read_at is null or e.updated_at < p_read_at)
    and not exists (select 1 from pg_temp.incoming i where i.external_id = e.external_id);
  get diagnostics v_removed = row_count;

  if (select count(*) from public.events
      where calendar_id = p_calendar_id and external_id is not null) > 10000 then
    raise exception 'imported' using errcode = 'CF429';
  end if;

  v_summary := jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
  update public.ics_subscriptions s
  set feed_ids = array(
        select e.external_id
        from public.events e
        where e.calendar_id = p_calendar_id
          and (e.external_id = any (v_sub.feed_ids)
            or e.external_id in (select i.external_id from pg_temp.incoming i))
      ),
      last_read_at = clock_timestamp(),
      last_summary = v_summary,
      consecutive_failures = 0,
      last_error = null
  where s.calendar_id = p_calendar_id;
  return v_summary;
end;
$$;

create or replace function public.sync_apply_events(
  p_secret text,
  p_calendar_id uuid,
  p_events jsonb,
  p_skipped integer default 0,
  p_omitted integer default 0,
  p_read_at timestamptz default now(),
  p_access text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_keep text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection uuid;
  v_owner uuid;
  v_read_at timestamptz := coalesce(p_read_at, now());
  v_added integer;
  v_changed integer;
  v_removed integer;
  v_summary jsonb;
begin
  perform public.sync_check_secret(p_secret);

  -- Locking the row serializes a manual and an automatic run of one calendar.
  select s.connection_id, c.owner_id into v_connection, v_owner
  from public.synced_calendars s
  join public.calendars c on c.id = s.calendar_id
  where s.calendar_id = p_calendar_id
  for update of s;

  if v_connection is null then
    raise exception 'Invalid synced calendar' using errcode = 'CF404';
  end if;

  create temporary table pg_temp.incoming on commit drop as
  select distinct on (i.external_id) i.*
  from jsonb_to_recordset(p_events) as i(
    external_id text,
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    start_tz text,
    end_tz text
  )
  where i.external_id is not null;

  delete from public.events e
  where e.calendar_id = p_calendar_id
    and e.external_id is not null
    and e.updated_at < v_read_at
    -- Only what overlaps the window read can be missing from the read (RF-1, D2).
    and (p_from is null or (e.ends_at > p_from and e.starts_at < p_to))
    -- Events left out by the 2,000 limit were read but not sent (RF-3, D3).
    and not (e.external_id = any(coalesce(p_keep, '{}'::text[])))
    and not exists (select 1 from pg_temp.incoming i where i.external_id = e.external_id);
  get diagnostics v_removed = row_count;

  update public.events e
  set title = i.title,
      description = i.description,
      location = i.location,
      starts_at = i.starts_at,
      ends_at = i.ends_at,
      all_day = coalesce(i.all_day, false),
      start_tz = i.start_tz,
      end_tz = i.end_tz
  from pg_temp.incoming i
  where e.calendar_id = p_calendar_id
    and e.external_id = i.external_id
    and e.updated_at < v_read_at
    and (e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, e.start_tz, e.end_tz)
      is distinct from (i.title, i.description, i.location, i.starts_at, i.ends_at, coalesce(i.all_day, false), i.start_tz, i.end_tz);
  get diagnostics v_changed = row_count;

  insert into public.events (
    calendar_id, external_id, title, description, location, starts_at, ends_at, all_day, created_by, start_tz, end_tz
  )
  select p_calendar_id, i.external_id, i.title, i.description, i.location,
         i.starts_at, i.ends_at, coalesce(i.all_day, false), v_owner, i.start_tz, i.end_tz
  from pg_temp.incoming i
  where not exists (
    select 1 from public.events e
    where e.calendar_id = p_calendar_id and e.external_id = i.external_id
  );
  get diagnostics v_added = row_count;

  v_summary := jsonb_build_object(
    'added', v_added,
    'changed', v_changed,
    'removed', v_removed,
    'skipped', coalesce(p_skipped, 0),
    'omitted', coalesce(p_omitted, 0)
  );

  update public.synced_calendars
  set last_synced_at = now(),
      sync_started_at = null,
      consecutive_failures = 0,
      last_error = null,
      last_summary = v_summary,
      google_access = case
        when p_access in ('owner', 'writer', 'reader') then p_access
        else google_access
      end
  where calendar_id = p_calendar_id;

  update public.calendar_connections set last_synced_at = now() where id = v_connection;

  return v_summary;
end;
$$;

create or replace function public.sync_commit_event(
  p_secret text,
  p_op text,
  p_calendar_id uuid,
  p_event_id uuid,
  p_row jsonb,
  p_external_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context jsonb;
  v_target uuid := coalesce((p_row ->> 'calendar_id')::uuid, p_calendar_id);
  v_id uuid;
begin
  if p_op not in ('insert', 'update', 'delete', 'gone') then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;

  v_context := public.sync_write_context(
    p_secret,
    p_calendar_id,
    case when p_op = 'insert' then null else p_event_id end,
    case when p_op in ('insert', 'update') then v_target end
  );
  if not (v_context ->> 'synced')::boolean then
    raise exception 'Not a synced calendar' using errcode = '22023';
  end if;

  if p_op = 'insert' then
    -- The hourly run may have brought it already: no duplicate.
    insert into public.events (
      calendar_id, external_id, title, description, location, starts_at, ends_at,
      all_day, color, category_id, created_by, start_tz, end_tz
    )
    select p_calendar_id, p_external_id, r.title, r.description, r.location,
           r.starts_at, r.ends_at, coalesce(r.all_day, false), r.color, r.category_id,
           (select auth.uid()), r.start_tz, r.end_tz
    from jsonb_to_record(p_row) as r(
      title text, description text, location text, starts_at timestamptz,
      ends_at timestamptz, all_day boolean, color text, category_id uuid,
      start_tz text, end_tz text
    )
    on conflict (calendar_id, external_id) where external_id is not null
    do update set
      title = excluded.title,
      description = excluded.description,
      location = excluded.location,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      all_day = excluded.all_day,
      color = excluded.color,
      category_id = excluded.category_id,
      start_tz = excluded.start_tz,
      end_tz = excluded.end_tz
    returning id into v_id;
    return v_id;
  end if;

  if p_op = 'update' then
    update public.events e
    set calendar_id = v_target,
        title = r.title,
        description = r.description,
        location = r.location,
        starts_at = r.starts_at,
        ends_at = r.ends_at,
        all_day = coalesce(r.all_day, false),
        color = r.color,
        category_id = r.category_id,
        start_tz = r.start_tz,
        end_tz = r.end_tz,
        external_id = coalesce(p_external_id, e.external_id)
    from jsonb_to_record(p_row) as r(
      title text, description text, location text, starts_at timestamptz,
      ends_at timestamptz, all_day boolean, color text, category_id uuid,
      start_tz text, end_tz text
    )
    where e.id = p_event_id
    returning e.id into v_id;
    return v_id;
  end if;

  delete from public.events where id = p_event_id returning id into v_id;
  return v_id;
end;
$$;

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
    recurrence, recurrence_tz, recurrence_until, exdates, series_id, original_start,
    start_tz, end_tz
  )
  select
    m.copy_id, v_copy, e.title, e.description, e.location, e.starts_at, e.ends_at,
    e.all_day, e.color, nc.id, e.created_by,
    e.recurrence, e.recurrence_tz, e.recurrence_until, e.exdates, ms.copy_id, e.original_start,
    e.start_tz, e.end_tz
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

  -- Comments keep their author, dates and edit mark (RF-27).
  insert into public.event_comments (
    event_id, author_id, client_id, body, created_at, edited_at
  )
  select m.copy_id, c.author_id, gen_random_uuid(), c.body, c.created_at, c.edited_at
  from pg_temp.copied_events m
  join public.event_comments c on c.event_id = m.source_id;

  -- The notes shared through the calendar, with their items; the new owner
  -- of the copy is their author (spec 028 RF-14).
  drop table if exists pg_temp.copied_notes;
  create temporary table pg_temp.copied_notes on commit drop as
  select n.id as source_id, gen_random_uuid() as copy_id
  from public.notes n
  where n.calendar_id = p_calendar_id;

  insert into public.notes (
    id, owner_id, calendar_id, kind, title, body, color, pinned, archived,
    due_date, created_at
  )
  select m.copy_id, p_user_id, v_copy, n.kind, n.title, n.body, n.color,
    n.pinned, n.archived, n.due_date, n.created_at
  from pg_temp.copied_notes m
  join public.notes n on n.id = m.source_id;

  insert into public.note_items (note_id, text, done, position, created_at)
  select m.copy_id, i.text, i.done, i.position, i.created_at
  from pg_temp.copied_notes m
  join public.note_items i on i.note_id = m.source_id;

  return v_copy;
end;
$$;
