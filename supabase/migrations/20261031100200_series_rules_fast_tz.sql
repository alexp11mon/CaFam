-- Spec 013, T1: pg_timezone_names reads the zone files on every call, so
-- inserting hundreds of series at once (merging calendars, tests) timed out.
-- Asking Postgres to convert with the zone checks it as well, much faster.

create or replace function public.enforce_series_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exceptions int;
begin
  if new.recurrence is not null then
    if public.is_synced_calendar(new.calendar_id) then
      raise exception 'Series in a synced calendar' using errcode = '22023';
    end if;

    if new.recurrence_tz is not null
      and (tg_op = 'INSERT' or new.recurrence_tz is distinct from old.recurrence_tz)
    then
      begin
        perform now() at time zone new.recurrence_tz;
      exception when invalid_parameter_value then
        raise exception 'Invalid time zone: %', new.recurrence_tz using errcode = '22023';
      end;
    end if;

    if (tg_op = 'INSERT' or old.recurrence is null or old.calendar_id <> new.calendar_id)
      and (
        select count(*) from public.events
        where calendar_id = new.calendar_id and recurrence is not null and id <> new.id
      ) >= 500
    then
      raise exception 'series' using errcode = 'CF429';
    end if;

    if tg_op = 'UPDATE' and cardinality(new.exdates) > cardinality(old.exdates)
      and cardinality(new.exdates)
        + (select count(*) from public.events where series_id = new.id) > 100
    then
      raise exception 'exceptions' using errcode = 'CF429';
    end if;
  elsif tg_op = 'UPDATE' and old.recurrence is not null
    and exists (select 1 from public.events where series_id = new.id)
  then
    -- update_series detaches or deletes the exceptions first (plan D7).
    raise exception 'Series with exceptions' using errcode = '22023';
  end if;

  if new.series_id is not null
    and (tg_op = 'INSERT' or new.series_id is distinct from old.series_id)
  then
    -- Locking the series serializes exceptions created at once.
    select cardinality(exdates) into v_exceptions
    from public.events
    where id = new.series_id and recurrence is not null
    for update;
    if v_exceptions is null then
      raise exception 'Not a series' using errcode = '22023';
    end if;
    if v_exceptions
      + (select count(*) from public.events where series_id = new.series_id) >= 100
    then
      raise exception 'exceptions' using errcode = 'CF429';
    end if;
  end if;

  return new;
end;
$$;

