-- Spec 012, T3: only objects claimed by the purge can be removed (plan D7).
--
-- Postgres only deletes rows that a SELECT policy shows, so removing queued
-- objects with the publishable key needs them readable too. To keep that
-- window short, the purge (T5) claims queued objects with the cron secret and
-- removes them at once: only claimed objects of deleted images, behind an
-- unguessable path, are readable and removable for 5 minutes, and only by anon
-- (the purge has no session).

alter table public.image_purge_queue add column claimed_at timestamptz;

create or replace function public.image_purge_pending(p_name text)
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
      and claimed_at > now() - interval '5 minutes'
  );
$$;

revoke execute on function public.image_purge_pending(text) from authenticated;

drop policy "event_images_remove_queued" on storage.objects;

create policy "event_images_see_claimed" on storage.objects
  for select to anon
  using (bucket_id = 'event-images' and public.image_purge_pending(name));

create policy "event_images_remove_claimed" on storage.objects
  for delete to anon
  using (bucket_id = 'event-images' and public.image_purge_pending(name));
