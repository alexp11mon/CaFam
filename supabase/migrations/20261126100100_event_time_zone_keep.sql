-- Spec 045, T5: a change written to Google or iCloud without a zone (a move,
-- a change of title) keeps the event's own zone, as the normal update does
-- (RF-11). Only the update branch of sync_commit_event changes.

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
        start_tz = case when p_row ? 'start_tz' then r.start_tz else e.start_tz end,
        end_tz = case when p_row ? 'start_tz' then r.end_tz else e.end_tz end,
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
