-- Spec 009, T3: writes in synced calendars (plan "Contratos", D3, D13, D15;
-- RF-6, RF-7, RF-10 to RF-12, RF-16, RF-19, RF-20, RF-25, RF-29, RF-31 to
-- RF-34, RF-36, RF-38).
--
-- RLS on events still refuses every client write in a synced calendar. These
-- functions need both the user's session (their role decides, as in a normal
-- calendar) and the server secret, which proves the server already wrote the
-- change in Google (D3, P4). CF404 = not valid for you, CF429 = over 20,
-- 22023 = combination not allowed.

create function public.sync_write_context(
  p_secret text,
  p_calendar_id uuid,
  p_event_id uuid default null,
  p_target_calendar_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_target_calendar_id, p_calendar_id);
  v_event_external text;
  v_source public.synced_calendars;
  v_dest public.synced_calendars;
begin
  perform public.sync_check_secret(p_secret);

  if (select auth.uid()) is null
    or public.calendar_role_for(p_calendar_id) is distinct from 'owner'
      and public.calendar_role_for(p_calendar_id) is distinct from 'editor'
    or public.calendar_role_for(v_target) is distinct from 'owner'
      and public.calendar_role_for(v_target) is distinct from 'editor' then
    raise exception 'Only the owner or an editor writes events' using errcode = '42501';
  end if;

  if p_event_id is not null then
    select external_id into v_event_external
    from public.events
    where id = p_event_id and calendar_id = p_calendar_id;
    if not found then
      raise exception 'Invalid event' using errcode = 'CF404';
    end if;
  end if;

  select * into v_source from public.synced_calendars where calendar_id = p_calendar_id;
  select * into v_dest from public.synced_calendars where calendar_id = v_target;

  if v_source.calendar_id is null and v_dest.calendar_id is null then
    return jsonb_build_object('synced', false);
  end if;

  -- Never between a synced calendar and a normal one, or two accounts (RF-20).
  if v_source.calendar_id is null or v_dest.calendar_id is null
    or v_source.connection_id <> v_dest.connection_id then
    raise exception 'Events only move inside one Google account' using errcode = '22023';
  end if;

  if not public.can_write_synced(p_calendar_id) or not public.can_write_synced(v_target) then
    raise exception 'The account cannot write in this calendar' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'synced', true,
    'connection_id', v_source.connection_id,
    'calendar_external_id', v_source.external_id,
    'target_external_id', v_dest.external_id,
    'event_external_id', v_event_external
  );
end;
$$;

create function public.sync_commit_event(
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
      all_day, color, category_id, created_by
    )
    select p_calendar_id, p_external_id, r.title, r.description, r.location,
           r.starts_at, r.ends_at, coalesce(r.all_day, false), r.color, r.category_id,
           (select auth.uid())
    from jsonb_to_record(p_row) as r(
      title text, description text, location text, starts_at timestamptz,
      ends_at timestamptz, all_day boolean, color text, category_id uuid
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
      category_id = excluded.category_id
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
        external_id = coalesce(p_external_id, e.external_id)
    from jsonb_to_record(p_row) as r(
      title text, description text, location text, starts_at timestamptz,
      ends_at timestamptz, all_day boolean, color text, category_id uuid
    )
    where e.id = p_event_id
    returning e.id into v_id;
    return v_id;
  end if;

  delete from public.events where id = p_event_id returning id into v_id;
  return v_id;
end;
$$;

-- Name, description and color together; the name was already accepted by
-- Google, the other two stay in CaFam (RF-29, RF-31, D13).
create function public.sync_update_calendar(
  p_secret text,
  p_calendar_id uuid,
  p_name text,
  p_description text,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  if public.calendar_role_for(p_calendar_id) is distinct from 'owner'
    or not public.can_write_synced(p_calendar_id) then
    raise exception 'Only the owner renames a synced calendar' using errcode = '42501';
  end if;

  perform set_config('app.sync_write', 'on', true);
  update public.calendars
  set name = p_name, description = p_description, color = p_color
  where id = p_calendar_id;
  perform set_config('app.sync_write', 'off', true);
end;
$$;

-- The account's connection, if it is the caller's and can write.
create function public.sync_own_writable_connection(p_connection_id uuid)
returns public.calendar_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.calendar_connections;
begin
  select * into v_connection
  from public.calendar_connections
  where id = p_connection_id
    and owner_id = (select auth.uid())
    and status = 'active'
    and can_write
  for update;

  if v_connection.id is null then
    raise exception 'Invalid connection' using errcode = 'CF404';
  end if;

  if (select count(*) from public.synced_calendars where connection_id = p_connection_id) >= 20 then
    raise exception 'Too many synced calendars' using errcode = 'CF429';
  end if;

  return v_connection;
end;
$$;

-- A calendar just created in Google from CaFam (RF-32, RF-33, D15).
create function public.sync_attach_created(
  p_secret text,
  p_connection_id uuid,
  p_external_id text,
  p_name text,
  p_color text default '#A0C4FF'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.calendar_connections;
  v_calendar uuid;
begin
  perform public.sync_check_secret(p_secret);
  v_connection := public.sync_own_writable_connection(p_connection_id);

  insert into public.calendars (owner_id, name, color)
  values (v_connection.owner_id, p_name, coalesce(p_color, '#A0C4FF'))
  returning id into v_calendar;

  insert into public.synced_calendars (calendar_id, connection_id, provider, external_id, google_access)
  values (v_calendar, p_connection_id, v_connection.provider, p_external_id, 'owner');

  return v_calendar;
end;
$$;

-- A normal calendar copied to Google: from now on it is synced. Members,
-- categories, colors and the events left out stay as they were (RF-34, RF-36,
-- RF-38, RF-42). An orphan calendar has no owner_id and fails the check.
create function public.sync_attach_uploaded(
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

  insert into public.synced_calendars (
    calendar_id, connection_id, provider, external_id, google_access, last_synced_at
  )
  values (p_calendar_id, p_connection_id, v_connection.provider, p_external_id, 'owner', now());

  update public.events e
  set external_id = m.external_id
  from jsonb_to_recordset(coalesce(p_mapping, '[]'::jsonb)) as m(event_id uuid, external_id text)
  where e.id = m.event_id and e.calendar_id = p_calendar_id;
end;
$$;

revoke execute on function
  public.sync_write_context(text, uuid, uuid, uuid),
  public.sync_commit_event(text, text, uuid, uuid, jsonb, text),
  public.sync_update_calendar(text, uuid, text, text, text),
  public.sync_own_writable_connection(uuid),
  public.sync_attach_created(text, uuid, text, text, text),
  public.sync_attach_uploaded(text, uuid, uuid, text, jsonb)
from public, anon;

grant execute on function
  public.sync_write_context(text, uuid, uuid, uuid),
  public.sync_commit_event(text, text, uuid, uuid, jsonb, text),
  public.sync_update_calendar(text, uuid, text, text, text),
  public.sync_attach_created(text, uuid, text, text, text),
  public.sync_attach_uploaded(text, uuid, uuid, text, jsonb)
to authenticated;

-- Only called from the functions above.
revoke execute on function public.sync_own_writable_connection(uuid) from authenticated;
