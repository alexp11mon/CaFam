-- Spec 007, T2: synced calendars are read-only and cannot be merged (plan D11;
-- RF-20, RF-44). The database decides (P3), not the interface.

create function public.is_synced_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.synced_calendars where calendar_id = p_calendar_id
  );
$$;

revoke execute on function public.is_synced_calendar(uuid) from public, anon;
grant execute on function public.is_synced_calendar(uuid) to authenticated;

-- Nobody writes events of a synced calendar; the with check also stops moving
-- an event into one (RF-20). The sync functions are security definer.
drop policy "events_insert_editor" on public.events;
drop policy "events_update_editor" on public.events;
drop policy "events_delete_editor" on public.events;

create policy "events_insert_editor" on public.events
  for insert to authenticated
  with check (
    public.calendar_role_for(calendar_id) in ('owner', 'editor')
    and not public.is_synced_calendar(calendar_id)
  );

create policy "events_update_editor" on public.events
  for update to authenticated
  using (
    public.calendar_role_for(calendar_id) in ('owner', 'editor')
    and not public.is_synced_calendar(calendar_id)
  )
  with check (
    public.calendar_role_for(calendar_id) in ('owner', 'editor')
    and not public.is_synced_calendar(calendar_id)
  );

create policy "events_delete_editor" on public.events
  for delete to authenticated
  using (
    public.calendar_role_for(calendar_id) in ('owner', 'editor')
    and not public.is_synced_calendar(calendar_id)
  );

-- merge_calendars (last defined in remove_old_blue) refuses synced calendars
-- (RF-44): RLS would hide their events from the move and the delete would then
-- lose them. The target is always one of the sources. create or replace keeps
-- the existing grants.
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

  -- Members and preferences of the removed calendars go with them (RF-55).
  delete from public.calendars where id = any (v_others);

  return v_target;
end;
$$;
