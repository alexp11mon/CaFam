-- Spec 013, T14: the row of an occurrence for its first image (RF-24, plan
-- D7). Any member adds images, viewers included (spec 012 RF-4), but RLS only
-- lets owner and editor write events. This definer function creates the
-- unchanged exception for any member, or returns the one that exists.
--
-- Only the server may call it: SQL cannot expand the rule (plan D8), so the
-- action checks with ical.js that the start is a real occurrence and passes
-- the cron secret, as the write functions of spec 009 do (P4). Without it a
-- viewer could add copies of the series on any date.
create function public.materialize_occurrence(
  p_secret text,
  p_series_id uuid,
  p_original_start timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.events;
  v_id uuid;
begin
  perform public.sync_check_secret(p_secret);

  select * into v_series
  from public.events
  where id = p_series_id and recurrence is not null;
  if v_series.id is null
    or not public.is_calendar_member(v_series.calendar_id)
    or p_original_start = any (v_series.exdates)
    or p_original_start < v_series.starts_at
    or p_original_start > coalesce(v_series.recurrence_until, 'infinity')
  then
    raise exception 'Occurrence not found' using errcode = 'CF404';
  end if;

  select id into v_id
  from public.events
  where series_id = p_series_id and original_start = p_original_start;
  if v_id is not null then
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into public.events (
    id, calendar_id, title, description, location, starts_at, ends_at, all_day,
    color, category_id, created_by, series_id, original_start
  )
  values (
    v_id, v_series.calendar_id, v_series.title, v_series.description,
    v_series.location, p_original_start,
    p_original_start + (v_series.ends_at - v_series.starts_at), v_series.all_day,
    v_series.color, v_series.category_id, v_series.created_by, p_series_id,
    p_original_start
  );
  return v_id;
end;
$$;

revoke execute on function public.materialize_occurrence(text, uuid, timestamptz) from public, anon;
grant execute on function public.materialize_occurrence(text, uuid, timestamptz) to authenticated;
