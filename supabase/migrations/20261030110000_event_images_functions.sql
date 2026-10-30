-- Spec 012, T2: reserve and confirm images with the limits applied atomically
-- (plan "Contratos", D4, D8; RF-2, RF-4, RF-8, RF-20, RF-22, RF-23).
--
-- CF404 = event or image not valid for you; CF429 = over a limit, with the
-- message 'event' (10 per event), 'user' (300 per user) or 'total' (space).
-- A pending reservation older than 1 hour no longer counts: the hourly purge
-- removes it (T5).

-- 800 MB of the 1 GB of the free plan (plan D8).
create function public.images_total_limit()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 838860800::bigint;
$$;

create function public.reserve_event_images(p_event_id uuid, p_images jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_calendar uuid;
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
  select calendar_id into v_calendar
  from public.events
  where id = p_event_id
  for update;
  if v_calendar is null or not public.is_calendar_member(v_calendar) then
    raise exception 'Invalid event' using errcode = 'CF404';
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
    insert into public.event_images (
      id, event_id, object_id, uploaded_by, status, bytes, width, height
    )
    values (
      v_id, p_event_id, v_id, v_uid, 'pending',
      (v_image ->> 'bytes')::int, (v_image ->> 'width')::int, (v_image ->> 'height')::int
    );
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$$;

-- Marks an own reservation as ready once both objects are in Storage, with
-- their real size.
create function public.confirm_event_image(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_object uuid;
  v_count int;
  v_bytes bigint;
begin
  select object_id into v_object
  from public.event_images
  where id = p_id
    and uploaded_by = (select auth.uid())
    and status = 'pending'
  for update;
  if v_object is null then
    raise exception 'Invalid image' using errcode = 'CF404';
  end if;

  select count(*), coalesce(sum((metadata ->> 'size')::bigint), 0)
  into v_count, v_bytes
  from storage.objects
  where bucket_id = 'event-images'
    and name in (v_object || '/full.jpg', v_object || '/thumb.jpg');
  if v_count < 2 then
    raise exception 'Missing objects' using errcode = 'P0002';
  end if;

  update public.event_images
  set status = 'ready', bytes = greatest(v_bytes, 1)
  where id = p_id;
end;
$$;

revoke execute on function
  public.reserve_event_images(uuid, jsonb),
  public.confirm_event_image(uuid)
  from public, anon;
grant execute on function
  public.reserve_event_images(uuid, jsonb),
  public.confirm_event_image(uuid)
  to authenticated;
