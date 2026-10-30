-- Spec 013, T1: reserve_event_images (last in reserve_images_order) refuses
-- series; images go to the row of one occurrence (RF-24, plan D7).

create or replace function public.reserve_event_images(p_event_id uuid, p_images jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_calendar uuid;
  v_series boolean;
  v_wanted int;
  v_free int;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_image jsonb;
begin
  if jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Invalid images' using errcode = '22023';
  end if;
  v_wanted := jsonb_array_length(p_images);
  if v_wanted not between 1 and 10 then
    raise exception 'Invalid images' using errcode = '22023';
  end if;
  -- Full image (<= 2048 px) plus thumbnail, each object up to 4 MB.
  if exists (
    select 1 from jsonb_to_recordset(p_images) as i(bytes int, width int, height int)
    where i.bytes is null or i.bytes not between 1 and 8388608
       or i.width is null or i.width not between 1 and 2048
       or i.height is null or i.height not between 1 and 2048
  ) then
    raise exception 'Invalid images' using errcode = '22023';
  end if;

  -- Locking the event serializes reservations of the same event, so two people
  -- at once never pass 10 (spec, casos límite).
  select calendar_id, recurrence is not null into v_calendar, v_series
  from public.events
  where id = p_event_id
  for update;
  if v_calendar is null or not public.is_calendar_member(v_calendar) then
    raise exception 'Invalid event' using errcode = 'CF404';
  end if;
  -- Images belong to one occurrence, never to the whole series (spec 013 RF-24,
  -- plan D7): the app first turns the occurrence into its own row.
  if v_series then
    raise exception 'Series' using errcode = '22023';
  end if;

  select 10 - count(*) into v_free
  from public.event_images
  where event_id = p_event_id
    and (status = 'ready' or created_at > now() - interval '1 hour');
  if v_free <= 0 then
    raise exception 'event' using errcode = 'CF429';
  end if;
  v_wanted := least(v_wanted, v_free);

  -- Copies of ownerless calendars share the object: count it once (plan D6).
  if (
    select count(distinct object_id)
    from public.event_images
    where uploaded_by = v_uid
      and (status = 'ready' or created_at > now() - interval '1 hour')
  ) + v_wanted > 300 then
    raise exception 'user' using errcode = 'CF429';
  end if;

  if (
    select coalesce(sum(bytes), 0)
    from (
      select max(bytes) as bytes
      from public.event_images
      where status = 'ready' or created_at > now() - interval '1 hour'
      group by object_id
    ) objects
  ) + (select coalesce(sum(bytes), 0) from public.image_purge_queue)
    + (
      select sum((value ->> 'bytes')::bigint)
      from jsonb_array_elements(p_images) with ordinality as i(value, n)
      where n <= v_wanted
    ) > public.images_total_limit() then
    raise exception 'total' using errcode = 'CF429';
  end if;

  for v_image in
    select value from jsonb_array_elements(p_images) with ordinality as i(value, n)
    where n <= v_wanted
    order by n
  loop
    v_id := gen_random_uuid();
    -- clock_timestamp, not now(): one per row, so the gallery keeps the order
    -- in which the images were chosen (RF-9).
    insert into public.event_images (
      id, event_id, object_id, uploaded_by, status, bytes, width, height, created_at
    )
    values (
      v_id, p_event_id, v_id, v_uid, 'pending',
      (v_image ->> 'bytes')::int, (v_image ->> 'width')::int, (v_image ->> 'height')::int,
      clock_timestamp()
    );
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$$;
