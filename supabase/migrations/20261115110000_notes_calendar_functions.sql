-- Spec 028, T1: merging calendars moves their shared notes and the copies of
-- a calendar without owner carry them (RF-14, plan D10). Both functions keep
-- their body as last defined (merge_calendars in sync_readonly, spec 007;
-- copy_calendar_for_owner in comments_copy_loss, spec 014) plus the notes.

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

  if exists (
    select 1 from unnest(v_sources) as s where public.is_synced_calendar(s)
  ) then
    raise exception 'Synced calendars cannot be merged'
      using errcode = '22023';
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

  -- The notes shared through the removed calendars move too (spec 028 RF-14).
  update public.notes
  set calendar_id = v_target
  where calendar_id = any (v_others);

  -- Members and preferences of the removed calendars go with them (RF-55).
  delete from public.calendars where id = any (v_others);

  return v_target;
end;
$$;

create or replace function public.copy_calendar_for_owner(p_calendar_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy uuid;
begin
  insert into public.calendars (owner_id, name, description, color)
  select p_user_id, c.name, c.description, c.color
  from public.calendars c
  where c.id = p_calendar_id
  returning id into v_copy;

  if v_copy is null then
    raise exception 'Calendar not found' using errcode = 'P0002';
  end if;

  insert into public.event_categories (calendar_id, name)
  select v_copy, ec.name
  from public.event_categories ec
  where ec.calendar_id = p_calendar_id;

  -- apply_orphan_decisions copies several times in one transaction.
  drop table if exists pg_temp.copied_events;
  create temporary table pg_temp.copied_events on commit drop as
  select e.id as source_id, gen_random_uuid() as copy_id
  from public.events e
  where e.calendar_id = p_calendar_id;

  -- Series before their exceptions: the trigger of each exception looks for
  -- its series among the rows already inserted.
  insert into public.events (
    id, calendar_id, title, description, location, starts_at, ends_at,
    all_day, color, category_id, created_by,
    recurrence, recurrence_tz, recurrence_until, exdates, series_id, original_start
  )
  select
    m.copy_id, v_copy, e.title, e.description, e.location, e.starts_at, e.ends_at,
    e.all_day, e.color, nc.id, e.created_by,
    e.recurrence, e.recurrence_tz, e.recurrence_until, e.exdates, ms.copy_id, e.original_start
  from pg_temp.copied_events m
  join public.events e on e.id = m.source_id
  left join pg_temp.copied_events ms on ms.source_id = e.series_id
  left join public.event_categories oc on oc.id = e.category_id
  left join public.event_categories nc
    on nc.calendar_id = v_copy
    and lower(btrim(nc.name)) = lower(btrim(oc.name))
  order by e.series_id nulls first;

  insert into public.event_images (
    event_id, object_id, uploaded_by, status, bytes, width, height, created_at
  )
  select m.copy_id, i.object_id, i.uploaded_by, 'ready', i.bytes, i.width, i.height, i.created_at
  from pg_temp.copied_events m
  join public.event_images i on i.event_id = m.source_id
  where i.status = 'ready';

  -- Comments keep their author, dates and edit mark (RF-27).
  insert into public.event_comments (
    event_id, author_id, client_id, body, created_at, edited_at
  )
  select m.copy_id, c.author_id, gen_random_uuid(), c.body, c.created_at, c.edited_at
  from pg_temp.copied_events m
  join public.event_comments c on c.event_id = m.source_id;

  -- The notes shared through the calendar, with their items; the new owner
  -- of the copy is their author (spec 028 RF-14).
  drop table if exists pg_temp.copied_notes;
  create temporary table pg_temp.copied_notes on commit drop as
  select n.id as source_id, gen_random_uuid() as copy_id
  from public.notes n
  where n.calendar_id = p_calendar_id;

  insert into public.notes (
    id, owner_id, calendar_id, kind, title, body, color, pinned, archived,
    due_date, created_at
  )
  select m.copy_id, p_user_id, v_copy, n.kind, n.title, n.body, n.color,
    n.pinned, n.archived, n.due_date, n.created_at
  from pg_temp.copied_notes m
  join public.notes n on n.id = m.source_id;

  insert into public.note_items (note_id, text, done, position, created_at)
  select m.copy_id, i.text, i.done, i.position, i.created_at
  from pg_temp.copied_notes m
  join public.note_items i on i.note_id = m.source_id;

  return v_copy;
end;
$$;
