-- Spec 023, T2: assistant_busy returned every event of every calendar the
-- person is a member of. Same function, with the scope of grid_busy.

create or replace function public.assistant_busy(p_person_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  person_id uuid,
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  recurrence text,
  recurrence_tz text,
  exdates timestamptz[],
  series_id uuid,
  original_start timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- RF-24: 31 days, plus a margin for the time zones.
  if p_to <= p_from or p_to - p_from > interval '32 days' then
    raise exception 'assistant_busy: period too long' using errcode = '22023';
  end if;

  return query
  with people as (
    select p.id
    from public.profiles p
    where p.id = any (p_person_ids)
      and p.share_availability
      and exists (
        select 1
        from public.calendar_members mine
        join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
        where mine.user_id = auth.uid() and theirs.user_id = p.id
      )
  )
  select distinct m.user_id, e.id, e.starts_at, e.ends_at, e.all_day, e.recurrence,
         e.recurrence_tz, e.exdates, e.series_id, e.original_start
  from people
  join public.calendar_members m on m.user_id = people.id
  join public.calendars c on c.id = m.calendar_id
  join public.events e on e.calendar_id = m.calendar_id
  -- Their own calendars, plus what they created where they are still a member,
  -- as grid_busy (spec 020 D13): consenting never exposes a third person's
  -- calendar (spec 023 RF-2).
  where (c.owner_id = people.id or e.created_by = people.id)
    and e.starts_at < p_to
    and (
      -- Single events and exceptions overlapping the period (as getEventsInRange).
      (e.recurrence is null and e.ends_at >= p_from)
      -- Series that may have occurrences in it.
      or (e.recurrence is not null and (e.recurrence_until is null or e.recurrence_until >= p_from))
      -- Exceptions whose original occurrence could fall in it, wherever they moved.
      or (e.series_id is not null and e.original_start >= p_from - interval '32 days')
    );
end;
$$;
