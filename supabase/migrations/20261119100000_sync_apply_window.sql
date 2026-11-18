-- Spec 038, T1: the reconciliation only removes what it should have read and
-- did not get (RF-1 to RF-5, RF-8; plan D1, D2, D3, D5).
--
-- p_from/p_to are the window the engine asked the provider for: an event with
-- an external_id that does not overlap it is an old copy and stays, with its
-- images and comments. p_keep are the external_ids left out by limitEvents.
-- Without p_from the function behaves as before (RF-4).

drop function public.sync_apply_events(text, uuid, jsonb, integer, integer, timestamptz, text);

create function public.sync_apply_events(
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
    all_day boolean
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
      all_day = coalesce(i.all_day, false)
  from pg_temp.incoming i
  where e.calendar_id = p_calendar_id
    and e.external_id = i.external_id
    and e.updated_at < v_read_at
    and (e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day)
      is distinct from (i.title, i.description, i.location, i.starts_at, i.ends_at, coalesce(i.all_day, false));
  get diagnostics v_changed = row_count;

  insert into public.events (
    calendar_id, external_id, title, description, location, starts_at, ends_at, all_day, created_by
  )
  select p_calendar_id, i.external_id, i.title, i.description, i.location,
         i.starts_at, i.ends_at, coalesce(i.all_day, false), v_owner
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

revoke execute on function
  public.sync_apply_events(text, uuid, jsonb, integer, integer, timestamptz, text, timestamptz, timestamptz, text[])
from public;

grant execute on function
  public.sync_apply_events(text, uuid, jsonb, integer, integer, timestamptz, text, timestamptz, timestamptz, text[])
to anon, authenticated, service_role;
