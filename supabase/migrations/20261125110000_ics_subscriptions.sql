-- Spec 044, T4: an imported calendar kept updated from its .ics link (RF-5 to
-- RF-13; plan "Modelo de datos"). The link lives in Vault (plan D3); the engine
-- reads and writes through functions protected with cron_secret, like the sync
-- of spec 007, so the app never needs service_role (P4).

create table public.ics_subscriptions (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  secret_id uuid not null,
  state text not null default 'active' check (state in ('active', 'paused')),
  -- The identities that came from the link: a refresh only removes these, never
  -- what another import or a person put in the calendar (RF-7, RF-9).
  feed_ids text[] not null default '{}',
  last_read_at timestamptz,
  last_summary jsonb,
  consecutive_failures integer not null default 0,
  last_error text,
  attempted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ics_subscriptions enable row level security;
revoke all on table public.ics_subscriptions from anon, authenticated;
-- Members see that the calendar is updated from a link, never the link (RF-11).
grant select (calendar_id, created_by, state, last_read_at, last_summary, last_error, created_at)
  on public.ics_subscriptions to authenticated;
create policy "ics_subscriptions: members read"
  on public.ics_subscriptions for select to authenticated
  using (public.is_calendar_member(calendar_id));

create function public.ics_subscriptions_delete_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;

create trigger ics_subscriptions_delete_secret
  after delete on public.ics_subscriptions
  for each row execute function public.ics_subscriptions_delete_secret();

-- A calendar left without an owner loses its subscription (RF-13); deleting
-- or merging it away drops it by the cascade.
create function public.ics_subscriptions_orphaned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ics_subscriptions where calendar_id = new.id;
  return new;
end;
$$;

create trigger ics_subscriptions_orphaned
  after update of orphaned_at on public.calendars
  for each row
  when (new.orphaned_at is not null and old.orphaned_at is null)
  execute function public.ics_subscriptions_orphaned();

-- Whoever made it leaves or becomes a Lector: it pauses (RF-13).
create function public.ics_subscriptions_member_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.role = 'viewer' then
    update public.ics_subscriptions
    set state = 'paused'
    where calendar_id = old.calendar_id and created_by = old.user_id;
  end if;
  return null;
end;
$$;

create trigger ics_subscriptions_member_changed
  after delete or update of role on public.calendar_members
  for each row execute function public.ics_subscriptions_member_changed();

-- Notices of a failing link keep their reason (RF-10).
alter table public.account_notices add column detail text;
alter table public.account_notices drop constraint account_notices_kind_check;
alter table public.account_notices add constraint account_notices_kind_check
  check (kind in ('orphaned', 'kept_copy', 'deleted_calendar', 'sync_revoked', 'sync_failing', 'ics_failing'));

-- Owner or Editor of a normal calendar; replaces the previous subscription
-- (one per calendar, RF-5). p_ids are the identities just imported from it.
create function public.create_ics_subscription(p_calendar_id uuid, p_url text, p_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner'
    and public.calendar_role_for(p_calendar_id) is distinct from 'editor' then
    raise exception 'Calendar not writable' using errcode = 'CF404';
  end if;
  if public.is_synced_calendar(p_calendar_id) then
    raise exception 'A calendar brought from an account has its own sync'
      using errcode = '22023';
  end if;
  if p_url is null or p_url !~ '^https://' or length(p_url) > 2000 then
    raise exception 'Invalid link' using errcode = '22023';
  end if;

  delete from public.ics_subscriptions where calendar_id = p_calendar_id;
  insert into public.ics_subscriptions (
    calendar_id, created_by, secret_id, feed_ids, last_read_at, attempted_at
  )
  values (
    p_calendar_id,
    (select auth.uid()),
    vault.create_secret(p_url),
    coalesce(p_ids, '{}'),
    -- After the events just imported, so the first refresh may update them.
    clock_timestamp(),
    now()
  );
end;
$$;

-- "Dejar de actualizar": the events stay (RF-6).
create function public.stop_ics_subscription(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner'
    and public.calendar_role_for(p_calendar_id) is distinct from 'editor' then
    raise exception 'Calendar not writable' using errcode = 'CF404';
  end if;
  delete from public.ics_subscriptions where calendar_id = p_calendar_id;
end;
$$;

-- Due every 6 hours, in batches (RF-7, RNF-1). Claiming marks the attempt, so
-- two runs never take the same one.
create function public.ics_claim_due(p_secret text, p_limit integer default 4)
returns table (calendar_id uuid, time_zone text, last_read_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  return query
  with due as (
    select s.calendar_id
    from public.ics_subscriptions s
    where s.state = 'active'
      and (s.attempted_at is null or s.attempted_at < now() - interval '6 hours')
    order by s.attempted_at nulls first
    limit p_limit
    for update skip locked
  )
  update public.ics_subscriptions s
  set attempted_at = now()
  from due
  where s.calendar_id = due.calendar_id
  returning
    s.calendar_id,
    coalesce((select p.time_zone from public.profiles p where p.id = s.created_by), 'Europe/Madrid'),
    s.last_read_at;
end;
$$;

-- "Actualizar ahora" or "Reintentar" (RF-6, RF-10): Owner or Editor with a
-- session, every 5 minutes at most; a paused one becomes active again.
create function public.ics_claim_one(p_secret text, p_calendar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.ics_subscriptions;
begin
  perform public.sync_check_secret(p_secret);
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner'
    and public.calendar_role_for(p_calendar_id) is distinct from 'editor' then
    raise exception 'Calendar not writable' using errcode = 'CF404';
  end if;
  select * into v_sub from public.ics_subscriptions where calendar_id = p_calendar_id for update;
  if not found then
    raise exception 'No subscription' using errcode = 'CF404';
  end if;
  if v_sub.attempted_at > now() - interval '5 minutes' then
    return jsonb_build_object('status', 'too_soon');
  end if;
  update public.ics_subscriptions
  set attempted_at = now(), state = 'active'
  where calendar_id = p_calendar_id;
  return jsonb_build_object(
    'status', 'ok',
    'calendar_id', p_calendar_id,
    'time_zone', coalesce((select p.time_zone from public.profiles p where p.id = v_sub.created_by), 'Europe/Madrid'),
    'last_read_at', v_sub.last_read_at
  );
end;
$$;

create function public.ics_get_url(p_secret text, p_calendar_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  return (
    select ds.decrypted_secret
    from public.ics_subscriptions s
    join vault.decrypted_secrets ds on ds.id = s.secret_id
    where s.calendar_id = p_calendar_id
  );
end;
$$;

-- Reconciles the events read from the link inside [p_from, p_to) (RF-7):
-- adds the new ones, changes what changed and removes what the link no longer
-- has, only among the identities that came from it. Rows changed in CaFam at
-- or after p_read_at are left alone (RF-8, the rule of spec 009); color,
-- category, images and comments are never written.
create function public.ics_apply_events(
  p_secret text,
  p_calendar_id uuid,
  p_events jsonb,
  p_read_at timestamptz,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.ics_subscriptions;
  v_added integer;
  v_changed integer;
  v_removed integer;
  v_summary jsonb;
begin
  perform public.sync_check_secret(p_secret);
  if p_events is null or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) > 2000 then
    raise exception 'Events must be an array of at most 2000 items' using errcode = '22023';
  end if;
  select * into v_sub from public.ics_subscriptions where calendar_id = p_calendar_id for update;
  if not found then
    raise exception 'No subscription' using errcode = 'CF404';
  end if;

  create temp table incoming on commit drop as
  select *
  from jsonb_to_recordset(p_events) as e (
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    external_id text
  );

  update public.events e
  set title = i.title,
      description = i.description,
      location = i.location,
      starts_at = i.starts_at,
      ends_at = i.ends_at,
      all_day = coalesce(i.all_day, false)
  from pg_temp.incoming i
  where e.calendar_id = p_calendar_id
    and e.external_id = i.external_id
    and (p_read_at is null or e.updated_at < p_read_at)
    and (e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day)
      is distinct from (i.title, i.description, i.location, i.starts_at, i.ends_at, coalesce(i.all_day, false));
  get diagnostics v_changed = row_count;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at, all_day,
    created_by, external_id
  )
  select p_calendar_id, i.title, i.description, i.location, i.starts_at,
    i.ends_at, coalesce(i.all_day, false), v_sub.created_by, i.external_id
  from pg_temp.incoming i
  on conflict (calendar_id, external_id) where external_id is not null
  do nothing;
  get diagnostics v_added = row_count;

  delete from public.events e
  where e.calendar_id = p_calendar_id
    and e.external_id = any (v_sub.feed_ids)
    and e.starts_at < p_to
    and e.ends_at > p_from
    and (p_read_at is null or e.updated_at < p_read_at)
    and not exists (select 1 from pg_temp.incoming i where i.external_id = e.external_id);
  get diagnostics v_removed = row_count;

  if (select count(*) from public.events
      where calendar_id = p_calendar_id and external_id is not null) > 10000 then
    raise exception 'imported' using errcode = 'CF429';
  end if;

  v_summary := jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
  update public.ics_subscriptions s
  set feed_ids = array(
        select e.external_id
        from public.events e
        where e.calendar_id = p_calendar_id
          and (e.external_id = any (v_sub.feed_ids)
            or e.external_id in (select i.external_id from pg_temp.incoming i))
      ),
      last_read_at = clock_timestamp(),
      last_summary = v_summary,
      consecutive_failures = 0,
      last_error = null
  where s.calendar_id = p_calendar_id;
  return v_summary;
end;
$$;

-- A failed read (RF-10): the third in a row notifies whoever made it, and a
-- link that is gone pauses then.
create function public.ics_fail(p_secret text, p_calendar_id uuid, p_kind text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.ics_subscriptions;
begin
  perform public.sync_check_secret(p_secret);
  if p_kind not in ('transient', 'gone') then
    raise exception 'Unknown failure' using errcode = '22023';
  end if;
  update public.ics_subscriptions
  set consecutive_failures = consecutive_failures + 1,
      last_error = left(p_message, 300),
      state = case
        when p_kind = 'gone' and consecutive_failures + 1 >= 3 then 'paused'
        else state
      end
  where calendar_id = p_calendar_id
  returning * into v_sub;
  if found and v_sub.consecutive_failures = 3 and v_sub.created_by is not null then
    insert into public.account_notices (user_id, kind, calendar_name, detail)
    select v_sub.created_by, 'ics_failing', c.name, left(p_message, 300)
    from public.calendars c
    where c.id = p_calendar_id;
  end if;
end;
$$;

-- Wakes the app only with something due (RNF-1), like sync_trigger.
create function public.ics_trigger(p_dry_run boolean default false)
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
  if not exists (
    select 1 from public.ics_subscriptions
    where state = 'active'
      and (attempted_at is null or attempted_at < now() - interval '6 hours')
  ) then
    return null;
  end if;

  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'cron_secret';
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'sync_app_url';
  if v_secret is null or v_url is null then
    return null;
  end if;

  v_request := jsonb_build_object(
    'url', rtrim(v_url, '/') || '/api/ics/refresh',
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
create function public.ics_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text from cron.job j where j.jobname like 'ics-%';
$$;

select cron.schedule('ics-refresh-due', '*/15 * * * *', $$select public.ics_trigger()$$);

revoke execute on function
  public.create_ics_subscription(uuid, text, text[]),
  public.stop_ics_subscription(uuid),
  public.ics_claim_due(text, integer),
  public.ics_claim_one(text, uuid),
  public.ics_get_url(text, uuid),
  public.ics_apply_events(text, uuid, jsonb, timestamptz, timestamptz, timestamptz),
  public.ics_fail(text, uuid, text, text),
  public.ics_trigger(boolean),
  public.ics_scheduled_jobs(),
  public.ics_subscriptions_delete_secret(),
  public.ics_subscriptions_orphaned(),
  public.ics_subscriptions_member_changed()
from public, anon, authenticated;

grant execute on function
  public.create_ics_subscription(uuid, text, text[]),
  public.stop_ics_subscription(uuid),
  public.ics_claim_one(text, uuid)
to authenticated;
-- Protected by the secret, like the sync functions (spec 007).
grant execute on function
  public.ics_claim_due(text, integer),
  public.ics_get_url(text, uuid),
  public.ics_apply_events(text, uuid, jsonb, timestamptz, timestamptz, timestamptz),
  public.ics_fail(text, uuid, text, text)
to anon, authenticated;
grant execute on function public.ics_scheduled_jobs() to service_role;
