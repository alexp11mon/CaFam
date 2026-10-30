-- Spec 012, T5: the hourly purge of Storage, opened by the cron secret like the
-- sync functions (plan D7; RF-16 to RF-18).
--
-- images_claim_purge first drops reservations older than an hour (the trigger
-- queues their objects) and queues folders of the bucket that no row uses (an
-- upload that ended right when its event was deleted), then claims queued
-- objects: claimed_at opens them to the publishable key for 5 minutes
-- (image_purge_pending). After 5 attempts an object is no longer claimed.

create function public.images_claim_purge(
  p_secret text,
  p_limit integer default 100,
  p_object_ids uuid[] default null,
  p_orphan_age interval default interval '1 hour'
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  delete from public.event_images
  where status = 'pending'
    and created_at < now() - interval '1 hour';

  insert into public.image_purge_queue (object_id, bytes)
  select public.image_object_id(o.name), sum(coalesce((o.metadata ->> 'size')::bigint, 1))::int
  from storage.objects o
  where o.bucket_id = 'event-images'
    and o.created_at < now() - p_orphan_age
    and public.image_object_id(o.name) is not null
    and not exists (
      select 1 from public.event_images i
      where i.object_id = public.image_object_id(o.name)
    )
  group by public.image_object_id(o.name)
  on conflict (object_id) do nothing;

  return query
  update public.image_purge_queue q
  set claimed_at = now(), attempts = q.attempts + 1
  where q.object_id in (
    select c.object_id
    from public.image_purge_queue c
    where c.attempts < 5
      and (c.claimed_at is null or c.claimed_at < now() - interval '5 minutes')
      and (p_object_ids is null or c.object_id = any (p_object_ids))
    order by c.queued_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning q.object_id;
end;
$$;

create function public.images_done_purge(p_secret text, p_object_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  delete from public.image_purge_queue where object_id = any (p_object_ids);
end;
$$;

-- Wakes the app only when there is something to remove (like sync_trigger).
create function public.images_purge_trigger(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
  v_request jsonb;
begin
  if not exists (select 1 from public.image_purge_queue where attempts < 5)
    and not exists (
      select 1 from public.event_images
      where status = 'pending' and created_at < now() - interval '1 hour'
    )
  then
    return null;
  end if;

  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'cron_secret';
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'sync_app_url';
  if v_secret is null or v_url is null then
    return null;
  end if;

  v_request := jsonb_build_object(
    'url', rtrim(v_url, '/') || '/api/images/purge',
    'headers', jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'content-type', 'application/json'
    ),
    'timeout_milliseconds', 60000
  );

  if not p_dry_run then
    perform net.http_post(
      url := v_request ->> 'url',
      headers := v_request -> 'headers',
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  end if;

  return v_request;
end;
$$;

-- Test helper, like sync_scheduled_jobs.
create function public.images_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text from cron.job j where j.jobname like 'images-%';
$$;

select cron.schedule('images-purge', '15 * * * *', $$select public.images_purge_trigger()$$);

revoke execute on function
  public.images_claim_purge(text, integer, uuid[], interval),
  public.images_done_purge(text, uuid[]),
  public.images_purge_trigger(boolean),
  public.images_scheduled_jobs()
from public, anon, authenticated;

-- The purge route and the delete actions call these with the publishable key
-- and the secret (plan D7).
grant execute on function
  public.images_claim_purge(text, integer, uuid[], interval),
  public.images_done_purge(text, uuid[])
to anon, authenticated, service_role;

grant execute on function public.images_purge_trigger(boolean), public.images_scheduled_jobs()
  to service_role;
