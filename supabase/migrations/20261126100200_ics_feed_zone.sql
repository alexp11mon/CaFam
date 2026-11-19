-- Spec 045, T5: the subscription .ics writes each event in its own zone too
-- (RF-10), like the export. Only the columns read change.

create or replace function public.ics_feed(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feed public.calendar_feeds;
  v_name text;
  v_since timestamptz := now() - interval '6 months';
  v_rows jsonb;
begin
  select f.*
  into v_feed
  from public.calendar_feeds f
  where f.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
  for update;

  select c.name
  into v_name
  from public.calendars c
  where c.id = v_feed.calendar_id and c.owner_id is not null;

  if v_feed.calendar_id is null or v_name is null then
    raise exception 'Feed not found' using errcode = 'CF404';
  end if;

  if v_feed.hits_window < now() - interval '1 hour' then
    update public.calendar_feeds
    set hits = 1, hits_window = now()
    where calendar_id = v_feed.calendar_id;
  elsif v_feed.hits >= 60 then
    raise exception 'Too many requests' using errcode = 'CF429';
  else
    update public.calendar_feeds
    set hits = hits + 1
    where calendar_id = v_feed.calendar_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at, e.id), '[]'::jsonb)
  into v_rows
  from (
    select ev.id, ev.title, ev.description, ev.location, ev.starts_at,
      ev.ends_at, ev.all_day, ev.recurrence, ev.recurrence_tz, ev.exdates,
      ev.series_id, ev.original_start, ev.created_at, ev.updated_at,
      ev.start_tz, ev.end_tz
    from public.events ev
    where ev.calendar_id = v_feed.calendar_id
      and (
        (ev.recurrence is null and ev.ends_at >= v_since)
        or (
          ev.recurrence is not null
          and (ev.recurrence_until is null or ev.recurrence_until >= v_since)
        )
      )
  ) e;

  return jsonb_build_object('name', v_name, 'rows', v_rows);
end;
$$;
