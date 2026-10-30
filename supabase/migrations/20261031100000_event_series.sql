-- Spec 013, T1: series and their exceptions live in public.events (plan
-- "Modelo de datos", D1, D4, D7; RF-6, RF-23, RF-24, RF-29, RF-31, RF-32).
--
-- A series is a row with `recurrence` (an RRULE without DTSTART); starts_at and
-- ends_at are those of its first occurrence. Occurrences are expanded when
-- reading. A changed occurrence is another row with series_id and
-- original_start (its RECURRENCE-ID); cancelled ones go to `exdates`.
-- Permissions are those of events: no new policies.

alter table public.events
  add column recurrence text,
  add column recurrence_tz text,
  add column recurrence_until timestamptz,
  add column exdates timestamptz[] not null default '{}',
  add column series_id uuid,
  add column original_start timestamptz;

alter table public.events
  add constraint events_recurrence_format check (
    recurrence is null
    or (
      char_length(recurrence) <= 200
      and recurrence ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$'
    )
  ),
  -- Timed series keep the creator's wall clock (RF-12); all-day ones have no
  -- zone (RF-14).
  add constraint events_recurrence_tz check (
    case
      when recurrence is null then recurrence_tz is null
      else all_day = (recurrence_tz is null)
    end
  ),
  add constraint events_series_pair check ((series_id is null) = (original_start is null)),
  add constraint events_series_not_nested check (recurrence is null or series_id is null),
  add constraint events_id_calendar_key unique (id, calendar_id),
  -- Moving a series moves its exceptions and deleting it deletes them (RF-23);
  -- an exception can never sit in another calendar (plan D10).
  add constraint events_series_fkey
    foreign key (series_id, calendar_id)
    references public.events (id, calendar_id)
    on update cascade
    on delete cascade,
  add constraint events_series_occurrence_key unique (series_id, original_start);

create index events_series_calendar_starts_idx
  on public.events (calendar_id, starts_at)
  where recurrence is not null;
create index events_series_id_idx on public.events (series_id);

-- Limits and rules no policy can express (RF-29, RF-31, RF-32). Security
-- definer only to count rows whatever RLS shows.
create function public.enforce_series_rules()
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
      and not exists (
        select 1 from pg_catalog.pg_timezone_names where name = new.recurrence_tz
      )
    then
      raise exception 'Invalid time zone: %', new.recurrence_tz using errcode = '22023';
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

revoke execute on function public.enforce_series_rules() from public, anon, authenticated;

create trigger events_enforce_series_rules
  before insert or update of recurrence, recurrence_tz, calendar_id, exdates, series_id
  on public.events
  for each row execute function public.enforce_series_rules();

