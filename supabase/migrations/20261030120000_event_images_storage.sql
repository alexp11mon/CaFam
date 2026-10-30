-- Spec 012, T3: the private bucket of event images and its policies (plan
-- "Bucket event-images", D5, D6, D7; RF-25, RF-26, RF-30).
--
-- Paths are <object_id>/full.jpg and <object_id>/thumb.jpg. Permissions never
-- come from the path: they come from the event_images row and the calendar of
-- its event, checked by the database on every request (P3).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', false, 4194304, array['image/jpeg']);

-- The object id of a valid image path, or null.
create function public.image_object_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(full|thumb)\.jpg$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- A ready image of an event in one of the caller's calendars (RF-25, RF-26).
create function public.can_read_event_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_images i
    join public.events e on e.id = i.event_id
    where i.object_id = public.image_object_id(p_name)
      and i.status = 'ready'
      and public.is_calendar_member(e.calendar_id)
  );
$$;

-- Only to an own reservation of less than an hour (plan D4).
create function public.image_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_images
    where object_id = public.image_object_id(p_name)
      and id = object_id
      and uploaded_by = (select auth.uid())
      and status = 'pending'
      and created_at > now() - interval '1 hour'
  );
$$;

-- Removing what is already queued for removal gives nothing away (plan D7).
create function public.image_purge_pending(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.image_purge_queue
    where object_id = public.image_object_id(p_name)
  );
$$;

revoke execute on function
  public.can_read_event_image(text),
  public.image_upload_allowed(text),
  public.image_purge_pending(text)
  from public;
grant execute on function public.can_read_event_image(text) to authenticated;
grant execute on function public.image_upload_allowed(text) to authenticated;
grant execute on function public.image_purge_pending(text) to anon, authenticated;

create policy "event_images_read_members" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-images' and public.can_read_event_image(name));

create policy "event_images_upload_reserved" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and public.image_upload_allowed(name));

create policy "event_images_remove_queued" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'event-images' and public.image_purge_pending(name));
