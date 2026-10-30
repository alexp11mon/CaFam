-- Spec 013, T6: changing and deleting occurrences by scope (plan "Contratos",
-- D7, D8, D11, D12; RF-15 to RF-21, RF-24b, RF-32).
--
-- Security invoker: RLS applies to every read and write (P3). Each function
-- locks the series with `for update`, which RLS only allows to owner and
-- editor, so a viewer or someone who lost the role gets CF404. The recurrence
-- rules are worked out in TypeScript with ical.js and arrive ready (plan D8).

-- Fields a change may carry. jsonb_populate_record copies only the keys present.
create function public.series_check_fields(p_fields jsonb, p_extra text[] default '{}')
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_fields) is distinct from 'object'
    or exists (
      select 1 from jsonb_object_keys(p_fields) as k
      where k <> all (
        array['title', 'description', 'location', 'starts_at', 'ends_at',
              'all_day', 'color', 'category_id'] || p_extra
      )
    )
  then
    raise exception 'Invalid fields' using errcode = '22023';
  end if;
end;
$$;

create function public.series_lock(p_series_id uuid)
returns public.events
language plpgsql
set search_path = ''
as $$
declare
  v_series public.events;
begin
  select * into v_series
  from public.events
  where id = p_series_id and recurrence is not null
  for update;
  if v_series.id is null then
    raise exception 'Series not found' using errcode = 'CF404';
  end if;
  return v_series;
end;
$$;

-- Fields that did not differ from the series follow it (RF-18, plan D11).
create function public.series_propagate(
  p_exceptions uuid[],
  p_old public.events,
  p_new public.events
)
returns void
language sql
set search_path = ''
as $$
  update public.events e
  set
    title = case when e.title is not distinct from p_old.title then p_new.title else e.title end,
    description = case when e.description is not distinct from p_old.description
      then p_new.description else e.description end,
    location = case when e.location is not distinct from p_old.location
      then p_new.location else e.location end,
    color = case when e.color is not distinct from p_old.color then p_new.color else e.color end,
    category_id = case when e.category_id is not distinct from p_old.category_id
      then p_new.category_id else e.category_id end
  where e.id = any (p_exceptions);
$$;

-- "Solo este evento" (RF-16, RF-32), and an unchanged row for images (RF-24).
create function public.update_occurrence(
  p_series_id uuid,
  p_original_start timestamptz,
  p_fields jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_series public.events;
  v_row public.events;
begin
  perform public.series_check_fields(p_fields);
  v_series := public.series_lock(p_series_id);
  if p_original_start = any (v_series.exdates) then
    raise exception 'Occurrence deleted' using errcode = 'CF404';
  end if;

  select * into v_row
  from public.events
  where series_id = p_series_id and original_start = p_original_start;

  if v_row.id is null then
    v_row := v_series;
    v_row.id := gen_random_uuid();
    v_row.recurrence := null;
    v_row.recurrence_tz := null;
    v_row.recurrence_until := null;
    v_row.exdates := '{}';
    v_row.series_id := p_series_id;
    v_row.original_start := p_original_start;
    v_row.starts_at := p_original_start;
    v_row.ends_at := p_original_start + (v_series.ends_at - v_series.starts_at);
    v_row := jsonb_populate_record(v_row, p_fields);
    insert into public.events (
      id, calendar_id, title, description, location, starts_at, ends_at, all_day,
      color, category_id, created_by, series_id, original_start
    )
    values (
      v_row.id, v_row.calendar_id, v_row.title, v_row.description, v_row.location,
      v_row.starts_at, v_row.ends_at, v_row.all_day, v_row.color, v_row.category_id,
      v_row.created_by, v_row.series_id, v_row.original_start
    );
  else
    v_row := jsonb_populate_record(v_row, p_fields);
    update public.events
    set title = v_row.title, description = v_row.description, location = v_row.location,
        starts_at = v_row.starts_at, ends_at = v_row.ends_at, all_day = v_row.all_day,
        color = v_row.color, category_id = v_row.category_id
    where id = v_row.id;
  end if;
  return v_row.id;
end;
$$;

-- "Este y los siguientes" (RF-17, plan D11).
create function public.split_series(
  p_series_id uuid,
  p_original_start timestamptz,
  p_old_recurrence text,
  p_old_until timestamptz,
  p_new jsonb,
  p_keep_exceptions boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_old public.events;
  v_new public.events;
  v_later uuid[];
begin
  perform public.series_check_fields(
    p_new, array['calendar_id', 'recurrence', 'recurrence_tz', 'recurrence_until']
  );
  if p_old_recurrence is null then
    raise exception 'Nothing before: change the whole series' using errcode = '22023';
  end if;
  v_old := public.series_lock(p_series_id);

  v_new := jsonb_populate_record(v_old, p_new);
  v_new.id := gen_random_uuid();
  v_new.exdates := case when p_keep_exceptions
    then array(select d from unnest(v_old.exdates) d where d >= p_original_start)
    else '{}' end;
  insert into public.events (
    id, calendar_id, title, description, location, starts_at, ends_at, all_day,
    color, category_id, created_by, recurrence, recurrence_tz, recurrence_until, exdates
  )
  values (
    v_new.id, v_new.calendar_id, v_new.title, v_new.description, v_new.location,
    v_new.starts_at, v_new.ends_at, v_new.all_day, v_new.color, v_new.category_id,
    v_old.created_by, v_new.recurrence, v_new.recurrence_tz, v_new.recurrence_until,
    v_new.exdates
  );

  select coalesce(array_agg(id), '{}') into v_later
  from public.events
  where series_id = p_series_id and original_start >= p_original_start;

  if p_keep_exceptions then
    update public.events
    set series_id = v_new.id, calendar_id = v_new.calendar_id
    where id = any (v_later);
    perform public.series_propagate(v_later, v_old, v_new);
  else
    delete from public.events where id = any (v_later);
  end if;

  update public.events
  set recurrence = p_old_recurrence,
      recurrence_until = p_old_until,
      exdates = array(select d from unnest(exdates) d where d < p_original_start)
  where id = p_series_id;

  return v_new.id;
end;
$$;

-- "Todos los eventos" (RF-18, RF-19, RF-21, plan D7, D12). A "recurrence": null
-- in p_fields turns the series into a single event; the result is the id of
-- the event that remains.
create function public.update_series(
  p_series_id uuid,
  p_fields jsonb,
  p_shift interval,
  p_drop_exceptions boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_old public.events;
  v_new public.events;
  v_first uuid;
  v_exceptions uuid[];
begin
  perform public.series_check_fields(
    p_fields, array['calendar_id', 'recurrence', 'recurrence_tz', 'recurrence_until']
  );
  v_old := public.series_lock(p_series_id);
  v_new := jsonb_populate_record(v_old, p_fields);

  if v_new.recurrence is null then
    -- The first occurrence keeps its own row, with its images, as the single
    -- event (plan D7); the other exceptions go.
    select id into v_first
    from public.events
    where series_id = p_series_id and original_start = v_old.starts_at;
    delete from public.events
    where series_id = p_series_id and id is distinct from v_first;
    if v_first is not null then
      update public.events set series_id = null, original_start = null where id = v_first;
      delete from public.events where id = p_series_id;
      v_new.id := v_first;
    else
      v_new.id := p_series_id;
    end if;
    update public.events
    set calendar_id = v_new.calendar_id, title = v_new.title,
        description = v_new.description, location = v_new.location,
        starts_at = v_new.starts_at, ends_at = v_new.ends_at, all_day = v_new.all_day,
        color = v_new.color, category_id = v_new.category_id,
        recurrence = null, recurrence_tz = null, recurrence_until = null, exdates = '{}'
    where id = v_new.id;
    return v_new.id;
  end if;

  if p_drop_exceptions then
    delete from public.events where series_id = p_series_id;
    v_new.exdates := '{}';
  else
    select coalesce(array_agg(id), '{}') into v_exceptions
    from public.events where series_id = p_series_id;
    if p_shift is not null and p_shift <> interval '0' then
      -- Same day, another hour: the keys move with the series (plan D12).
      update public.events
      set original_start = original_start + p_shift,
          starts_at = case when starts_at = original_start then starts_at + p_shift else starts_at end,
          ends_at = case when starts_at = original_start then ends_at + p_shift else ends_at end
      where id = any (v_exceptions);
      v_new.exdates := array(select d + p_shift from unnest(v_old.exdates) d);
    end if;
    perform public.series_propagate(v_exceptions, v_old, v_new);
  end if;

  update public.events
  set calendar_id = v_new.calendar_id, title = v_new.title,
      description = v_new.description, location = v_new.location,
      starts_at = v_new.starts_at, ends_at = v_new.ends_at, all_day = v_new.all_day,
      color = v_new.color, category_id = v_new.category_id,
      recurrence = v_new.recurrence, recurrence_tz = v_new.recurrence_tz,
      recurrence_until = v_new.recurrence_until, exdates = v_new.exdates
  where id = p_series_id;
  return p_series_id;
end;
$$;

-- Deleting by scope (RF-20). For "following", p_recurrence is the rule ending
-- before the occurrence; null deletes the whole series.
create function public.delete_occurrences(
  p_series_id uuid,
  p_original_start timestamptz,
  p_scope text,
  p_recurrence text,
  p_until timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_series public.events;
begin
  if p_scope not in ('this', 'following', 'all') then
    raise exception 'Invalid scope' using errcode = '22023';
  end if;
  v_series := public.series_lock(p_series_id);

  if p_scope = 'all' or (p_scope = 'following' and p_recurrence is null) then
    delete from public.events where id = p_series_id;
  elsif p_scope = 'this' then
    delete from public.events
    where series_id = p_series_id and original_start = p_original_start;
    if not p_original_start = any (v_series.exdates) then
      update public.events
      set exdates = exdates || p_original_start
      where id = p_series_id;
    end if;
  else
    delete from public.events
    where series_id = p_series_id and original_start >= p_original_start;
    update public.events
    set recurrence = p_recurrence,
        recurrence_until = p_until,
        exdates = array(select d from unnest(exdates) d where d < p_original_start)
    where id = p_series_id;
  end if;
end;
$$;

-- Changes and ready images that a change or a deletion would lose (RF-19,
-- RF-24b): all (both null), from an occurrence on, or a single one. Spec 014
-- will add the comments.
create function public.series_loss(
  p_series_id uuid,
  p_from timestamptz default null,
  p_only timestamptz default null
)
returns table (exceptions int, images int)
language sql
stable
set search_path = ''
as $$
  with lost as (
    select e.id
    from public.events e
    where e.series_id = p_series_id
      and (p_from is null or e.original_start >= p_from)
      and (p_only is null or e.original_start = p_only)
  )
  select
    (select count(*) from lost)::int,
    (select count(*) from public.event_images i
     where i.event_id in (select id from lost) and i.status = 'ready')::int;
$$;

revoke execute on function
  public.series_check_fields(jsonb, text[]),
  public.series_lock(uuid),
  public.series_propagate(uuid[], public.events, public.events),
  public.update_occurrence(uuid, timestamptz, jsonb),
  public.split_series(uuid, timestamptz, text, timestamptz, jsonb, boolean),
  public.update_series(uuid, jsonb, interval, boolean),
  public.delete_occurrences(uuid, timestamptz, text, text, timestamptz),
  public.series_loss(uuid, timestamptz, timestamptz)
from public, anon;

grant execute on function
  public.series_check_fields(jsonb, text[]),
  public.series_lock(uuid),
  public.series_propagate(uuid[], public.events, public.events),
  public.update_occurrence(uuid, timestamptz, jsonb),
  public.split_series(uuid, timestamptz, text, timestamptz, jsonb, boolean),
  public.update_series(uuid, jsonb, interval, boolean),
  public.delete_occurrences(uuid, timestamptz, text, text, timestamptz),
  public.series_loss(uuid, timestamptz, timestamptz)
to authenticated;
