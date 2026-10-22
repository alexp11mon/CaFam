-- Spec 005, T13: the old blue #2563EB is gone everywhere (plan D19;
-- RF-56, RF-57). Calendars created without a color (sign-up, import, merge
-- into a new one) get sky blue #A0C4FF, a color of the spec 002 palette, and
-- the calendars and events that kept the old blue move to it.

alter table public.calendars
  alter column color set default '#A0C4FF';

-- Same bodies as their original migrations; only the fallback color changes.
-- create or replace keeps the existing grants.
create or replace function public.merge_calendars(
  p_source_ids uuid[],
  p_target_id uuid default null,
  p_name text default null,
  p_color text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_sources uuid[];
  v_others uuid[];
  v_target uuid;
  v_category record;
  v_existing uuid;
begin
  -- Distinct, non-null ids: repeating a calendar does not count twice.
  select coalesce(array_agg(distinct s), '{}')
  into v_sources
  from unnest(p_source_ids) as s
  where s is not null;

  if cardinality(v_sources) < 2 then
    raise exception 'Select at least two calendars to merge'
      using errcode = '22023';
  end if;

  -- Ids that do not exist or are not visible have no role: also rejected here.
  if exists (
    select 1
    from unnest(v_sources) as s
    where public.calendar_role_for(s) is distinct from 'owner'
  ) then
    raise exception 'Only the owner can merge calendars'
      using errcode = '42501';
  end if;

  if p_target_id is null then
    if p_name is null then
      raise exception 'A name is required for the new calendar'
        using errcode = '22023';
    end if;
    insert into public.calendars (owner_id, name, color)
    values (
      (select auth.uid()),
      p_name,
      coalesce(p_color, '#A0C4FF')
    )
    returning id into v_target;
  else
    if not (p_target_id = any (v_sources)) then
      raise exception 'The target must be one of the merged calendars'
        using errcode = '22023';
    end if;
    v_target := p_target_id;
  end if;

  v_others := array(select s from unnest(v_sources) as s where s <> v_target);

  -- Events move after their categories, so the pair (category, calendar) is only
  -- consistent again at commit time.
  set constraints public.events_category_fkey deferred;

  -- Categories with the same normalized name are unified (RF-51); the rest move.
  for v_category in
    select id, name
    from public.event_categories
    where calendar_id = any (v_others)
    order by created_at, id
  loop
    select id
    into v_existing
    from public.event_categories
    where calendar_id = v_target
      and lower(trim(name)) = lower(trim(v_category.name));

    if found then
      update public.events
      set category_id = v_existing
      where category_id = v_category.id;
      delete from public.event_categories where id = v_category.id;
    else
      update public.event_categories
      set calendar_id = v_target
      where id = v_category.id;
    end if;
  end loop;

  update public.events
  set calendar_id = v_target
  where calendar_id = any (v_others);

  -- Members and preferences of the removed calendars go with them (RF-55).
  delete from public.calendars where id = any (v_others);

  return v_target;
end;
$$;

create or replace function public.import_calendar(
  p_name text,
  p_color text,
  p_events jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_events is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) not between 1 and 2000 then
    raise exception 'Events must be an array of 1 to 2000 items'
      using errcode = '22023';
  end if;

  insert into public.calendars (owner_id, name, color)
  values (
    (select auth.uid()),
    p_name,
    coalesce(p_color, '#A0C4FF')
  )
  returning id into v_id;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by
  )
  select
    v_id,
    e.title,
    e.description,
    e.location,
    e.starts_at,
    e.ends_at,
    coalesce(e.all_day, false),
    (select auth.uid())
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean
  );

  return v_id;
end;
$$;

update public.calendars
set color = '#A0C4FF'
where lower(color) = '#2563eb';

update public.events
set color = '#A0C4FF'
where lower(color) = '#2563eb';
