-- Spec 020, T2: other people's busy times in the week and day grid (plan
-- "Modelo de datos", D1, D2, D4, D5, D13; RF-1, RF-2, RF-4, RF-5, RF-7, RF-10,
-- RF-17, RF-18).

-- RF-1, RF-2, D1: consent of its own, apart from the assistant's
-- share_availability. Protected by the existing profiles policies (only the
-- owner reads and updates); no people function exposes it except busy_people.
alter table public.profiles
  add column share_busy boolean not null default false;

-- RF-7, D4: the people the user chose to see, in the private per-person
-- preferences. A partial upsert keeps position, as with the order.
alter table public.person_preferences
  add column show_busy boolean not null default false;

-- RF-5, RF-17: people who consent and share at least one calendar with the
-- caller, with whether the caller shows them. A deleted account has no profile.
create function public.busy_people()
returns table (id uuid, display_name text, shown boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, coalesce(pp.show_busy, false)
  from public.profiles p
  left join public.person_preferences pp
    on pp.user_id = auth.uid() and pp.person_id = p.id
  where p.share_busy
    and p.id <> auth.uid()
    and exists (
      select 1
      from public.calendar_members mine
      join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
      where mine.user_id = auth.uid() and theirs.user_id = p.id
    )
  order by p.display_name, p.id;
$$;

-- RF-8, RF-10, RF-18, D2, D5, D13: times only. No ids, titles, places or
-- calendars: exceptions come out as single rows and their original dates are
-- added to the series' exdates here, so nothing has to be matched by id.
-- TypeScript expands the series (expandRows), as SQL cannot.
create function public.grid_busy(p_from timestamptz, p_to timestamptz)
returns table (
  person_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  recurrence text,
  recurrence_tz text,
  exdates timestamptz[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- RF-18: 32 days at most per request.
  if p_to <= p_from or p_to - p_from > interval '32 days' then
    raise exception 'grid_busy: period too long' using errcode = '22023';
  end if;

  return query
  with people as (
    select p.id
    from public.person_preferences pp
    join public.profiles p on p.id = pp.person_id
    where pp.user_id = auth.uid()
      and pp.show_busy
      and p.share_busy
      and p.id <> auth.uid()
      and exists (
        select 1
        from public.calendar_members mine
        join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
        where mine.user_id = auth.uid() and theirs.user_id = p.id
      )
    order by p.id
    -- D5: eight people at a time.
    limit 8
  ),
  -- D13: their own calendars, plus what they created where they are still a member.
  theirs as (
    select distinct people.id as person_id, e.*
    from people
    join public.calendar_members m on m.user_id = people.id
    join public.calendars c on c.id = m.calendar_id
    join public.events e on e.calendar_id = m.calendar_id
    where (c.owner_id = people.id or e.created_by = people.id)
      and e.starts_at < p_to
      and (
        (e.recurrence is null and e.ends_at >= p_from)
        or (e.recurrence is not null and (e.recurrence_until is null or e.recurrence_until >= p_from))
      )
  )
  select t.person_id, t.starts_at, t.ends_at, t.all_day, t.recurrence, t.recurrence_tz,
         case
           when t.recurrence is null then null
           else coalesce(t.exdates, '{}') || coalesce(
             (select array_agg(x.original_start) from public.events x where x.series_id = t.id),
             '{}'
           )
         end
  from theirs t;
end;
$$;

revoke execute on function public.busy_people() from public, anon;
revoke execute on function public.grid_busy(timestamptz, timestamptz) from public, anon;
grant execute on function public.busy_people() to authenticated;
grant execute on function public.grid_busy(timestamptz, timestamptz) to authenticated;
