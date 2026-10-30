-- Spec 012, T4: the copy of an ownerless calendar keeps the images of its
-- events (plan D6; RF-31).
--
-- Same function as spec 006 (T6), plus the ready images. The new event ids are
-- generated up front so each copy can be matched to its source event. The
-- copied rows share the object of the original: no bytes are duplicated, and
-- the object is only removed once no row uses it (queue_image_purge).

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

  create temporary table pg_temp.copied_events on commit drop as
  select e.id as source_id, gen_random_uuid() as copy_id
  from public.events e
  where e.calendar_id = p_calendar_id;

  insert into public.events (
    id, calendar_id, title, description, location, starts_at, ends_at,
    all_day, color, category_id, created_by
  )
  select
    m.copy_id, v_copy, e.title, e.description, e.location, e.starts_at, e.ends_at,
    e.all_day, e.color, nc.id, e.created_by
  from pg_temp.copied_events m
  join public.events e on e.id = m.source_id
  left join public.event_categories oc on oc.id = e.category_id
  left join public.event_categories nc
    on nc.calendar_id = v_copy
    and lower(btrim(nc.name)) = lower(btrim(oc.name));

  insert into public.event_images (
    event_id, object_id, uploaded_by, status, bytes, width, height, created_at
  )
  select m.copy_id, i.object_id, i.uploaded_by, 'ready', i.bytes, i.width, i.height, i.created_at
  from pg_temp.copied_events m
  join public.event_images i on i.event_id = m.source_id
  where i.status = 'ready';

  return v_copy;
end;
$$;
