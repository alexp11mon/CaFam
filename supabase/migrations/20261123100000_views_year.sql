-- Spec 042: views "year" and "4days" (RF-11), and the marks of the year view
-- (RF-5, plan D2): which days have events of which calendars, never the
-- events themselves.

alter table public.profiles
  drop constraint profiles_last_view_check,
  add constraint profiles_last_view_check
    check (last_view in ('agenda', 'month', 'week', 'day', 'year', '4days'));

-- Distinct (day, calendar) of the single events and exceptions the caller can
-- read (RLS: security invoker) between p_from and p_to, both included. Series
-- are expanded by the app. Timed events count on the days of the caller's
-- zone; all-day events on their UTC dates (spec 002 plan D6).
create function public.calendar_day_marks(p_from date, p_to date)
returns table (day date, calendar_id uuid)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_zone text;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 370 then
    raise exception 'calendar_day_marks: at most 370 days'
      using errcode = '22023';
  end if;

  select p.time_zone into v_zone from public.profiles p where p.id = auth.uid();
  v_zone := coalesce(v_zone, 'Europe/Madrid');

  return query
  select distinct d.day::date, e.calendar_id
  from public.events e
  cross join lateral (
    select
      case when e.all_day then (e.starts_at at time zone 'UTC')::date
           else (e.starts_at at time zone v_zone)::date end as first_day,
      case when e.all_day
           then greatest(
             (e.starts_at at time zone 'UTC')::date,
             (e.ends_at at time zone 'UTC')::date - 1)
           else (greatest(e.starts_at, e.ends_at - interval '1 microsecond')
                 at time zone v_zone)::date end as last_day
  ) span
  cross join lateral generate_series(
    greatest(span.first_day, p_from)::timestamp,
    least(span.last_day, p_to)::timestamp,
    interval '1 day'
  ) as d(day)
  where e.recurrence is null
    -- A day of margin on each side covers any zone (UTC−12 to UTC+14).
    and e.starts_at < ((p_to + 2)::timestamp at time zone 'UTC')
    and e.ends_at > ((p_from - 1)::timestamp at time zone 'UTC');
end;
$$;

revoke execute on function public.calendar_day_marks(date, date) from public, anon;
grant execute on function public.calendar_day_marks(date, date) to authenticated;
