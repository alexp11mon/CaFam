-- Spec 040, T3: Web Push subscriptions, personal reminders and social notices.
--
-- The send job (/api/push/run) uses the publishable key and the cron secret,
-- like the sync functions (plan, "Sin service_role"). Series are expanded in
-- TypeScript (plan D4): push_due_reminders returns their rows as they are.

-- Subscriptions ----------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text not null default 'Navegador' check (char_length(device) <= 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- The same browser can be subscribed by another account before: the endpoint
-- moves to the caller (RF-1). Nobody inserts directly.
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(nullif(p_device, ''), 'Navegador'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text)
  to authenticated;

-- Preferences (RF-6, RF-14) ------------------------------------------------------

alter table public.profiles
  add column reminder_minutes integer default 10
    check (reminder_minutes in (0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080)),
  -- Minutes before 9:00 of the event day: 1440 = the day before at 9:00.
  add column reminder_all_day_minutes integer default 1440
    check (reminder_all_day_minutes in (0, 1440, 10080)),
  add column notify jsonb not null
    default '{"joined": true, "access": true, "comments": true, "changes": false}'::jsonb;

-- Reminders (RF-5 to RF-8) --------------------------------------------------------

create table public.event_reminders (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  minutes integer[] not null check (
    cardinality(minutes) between 1 and 3
    and minutes <@ array[0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index event_reminders_event_idx on public.event_reminders (event_id);

create trigger event_reminders_updated_at
  before update on public.event_reminders
  for each row execute function public.set_updated_at();

alter table public.event_reminders enable row level security;

-- Any member, Lectores included, on an event they can see (RF-7): the events
-- RLS of the subquery decides.
create policy "event_reminders: read own" on public.event_reminders
  for select to authenticated using (user_id = auth.uid());
create policy "event_reminders: insert own" on public.event_reminders
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id)
  );
create policy "event_reminders: update own" on public.event_reminders
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id)
  );
create policy "event_reminders: delete own" on public.event_reminders
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.event_reminders from anon, authenticated;
grant select, delete on public.event_reminders to authenticated;
grant insert (event_id, minutes), update (minutes) on public.event_reminders to authenticated;

-- Leaving a calendar drops the reminders of its events (RF-7).
create function public.event_reminders_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.event_reminders r
  using public.events e
  where r.user_id = old.user_id
    and r.event_id = e.id
    and e.calendar_id = old.calendar_id;
  return old;
end;
$$;

create trigger event_reminders_member_left
  after delete on public.calendar_members
  for each row execute function public.event_reminders_member_left();

-- The default reminder of the creator is stored with the event (plan D2), so
-- changing the default does not change the events already created. Imports of
-- past events and the sync (no session) get none.
create function public.event_reminders_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
begin
  if auth.uid() is null or new.series_id is not null then
    return new;
  end if;
  if new.recurrence is null and new.ends_at < now() then
    return new;
  end if;
  select case when new.all_day then p.reminder_all_day_minutes else p.reminder_minutes end
  into v_minutes
  from public.profiles p
  where p.id = auth.uid();
  if v_minutes is not null then
    insert into public.event_reminders (user_id, event_id, minutes)
    values (auth.uid(), new.id, array[v_minutes])
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger event_reminders_default
  after insert on public.events
  for each row execute function public.event_reminders_default();

revoke execute on function
  public.event_reminders_member_left(),
  public.event_reminders_default()
from public, anon, authenticated;

-- Deliveries: one per person, event, occurrence and minutes (RF-10) ------------

create table public.push_deliveries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null,
  occurrence_start timestamptz not null,
  minutes integer not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, event_id, occurrence_start, minutes)
);

alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

-- Social notices (RF-13 to RF-16) -------------------------------------------------

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('joined', 'access', 'comment', 'changed', 'deleted')),
  payload jsonb not null,
  collapse_key text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index push_outbox_pending_idx on public.push_outbox (created_at) where claimed_at is null;
create index push_outbox_collapse_idx on public.push_outbox (user_id, collapse_key, created_at);

alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- Queues a notice for p_user unless it is their own action, the sync (no
-- session, plan D6), they have no device (RF-16) or the kind is off (RF-14).
-- The same actor on the same event within 2 minutes gives one notice (RF-15).
create function public.push_enqueue(
  p_user uuid,
  p_kind text,
  p_payload jsonb,
  p_collapse text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting text := case p_kind
    when 'comment' then 'comments'
    when 'changed' then 'changes'
    when 'deleted' then 'changes'
    else p_kind
  end;
  v_recent record;
begin
  if p_user is null or auth.uid() is null or p_user = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.push_subscriptions s where s.user_id = p_user) then
    return;
  end if;
  if not coalesce(
    (select (p.notify ->> v_setting)::boolean from public.profiles p where p.id = p_user),
    false
  ) then
    return;
  end if;

  if p_collapse is not null then
    select o.id, o.claimed_at into v_recent
    from public.push_outbox o
    where o.user_id = p_user
      and o.collapse_key = p_collapse
      and o.created_at > now() - interval '2 minutes'
    order by o.created_at desc
    limit 1;
    if found then
      if v_recent.claimed_at is null then
        update public.push_outbox set payload = p_payload where id = v_recent.id;
      end if;
      return;
    end if;
  end if;

  insert into public.push_outbox (user_id, kind, payload, collapse_key)
  values (p_user, p_kind, p_payload, p_collapse);
end;
$$;

create function public.push_display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.display_name from public.profiles p where p.id = p_user), 'Alguien');
$$;

-- Joined a calendar of yours; access given or role changed.
create function public.push_members_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar record;
begin
  select c.id, c.name, c.owner_id into v_calendar
  from public.calendars c where c.id = new.calendar_id;
  if not found or new.role = 'owner' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() = new.user_id then
      perform public.push_enqueue(
        v_calendar.owner_id,
        'joined',
        jsonb_build_object(
          'kind', 'joined',
          'actor', public.push_display_name(new.user_id),
          'calendar', v_calendar.name,
          'calendarId', v_calendar.id
        )
      );
    else
      perform public.push_enqueue(
        new.user_id,
        'access',
        jsonb_build_object(
          'kind', 'access',
          'actor', public.push_display_name(auth.uid()),
          'calendar', v_calendar.name,
          'calendarId', v_calendar.id,
          'role', new.role
        )
      );
    end if;
  elsif new.role is distinct from old.role then
    perform public.push_enqueue(
      new.user_id,
      'access',
      jsonb_build_object(
        'kind', 'access',
        'actor', public.push_display_name(auth.uid()),
        'calendar', v_calendar.name,
        'calendarId', v_calendar.id,
        'role', new.role
      )
    );
  end if;
  return new;
end;
$$;

create trigger push_members_notify
  after insert or update of role on public.calendar_members
  for each row execute function public.push_members_notify();

-- A comment on an event you created or commented on.
create function public.push_comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_user uuid;
  v_payload jsonb;
begin
  select e.id, e.title, e.created_by into v_event
  from public.events e where e.id = new.event_id;
  if not found then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'kind', 'comment',
    'actor', public.push_display_name(new.author_id),
    'title', v_event.title,
    'eventId', v_event.id,
    'body', left(new.body, 300)
  );

  for v_user in
    select v_event.created_by
    union
    select c.author_id from public.event_comments c
    where c.event_id = new.event_id and c.id <> new.id and c.author_id is not null
  loop
    perform public.push_enqueue(v_user, 'comment', v_payload);
  end loop;
  return new;
end;
$$;

create trigger push_comments_notify
  after insert on public.event_comments
  for each row execute function public.push_comments_notify();

-- Somebody changed, moved or deleted an event you created.
create function public.push_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or old.created_by is null or old.created_by = auth.uid() then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if (new.title, new.starts_at, new.ends_at, new.all_day, new.location, new.description,
        new.calendar_id, new.recurrence, new.exdates)
      is not distinct from
       (old.title, old.starts_at, old.ends_at, old.all_day, old.location, old.description,
        old.calendar_id, old.recurrence, old.exdates)
    then
      return null;
    end if;
    perform public.push_enqueue(
      old.created_by,
      'changed',
      jsonb_build_object(
        'kind', 'changed',
        'actor', public.push_display_name(auth.uid()),
        'title', new.title,
        'eventId', new.id
      ),
      'changed:' || auth.uid() || ':' || new.id
    );
  else
    -- Not when the whole calendar or series goes (cascades).
    if not exists (select 1 from public.calendars c where c.id = old.calendar_id)
      or (old.series_id is not null
        and not exists (select 1 from public.events s where s.id = old.series_id))
    then
      return null;
    end if;
    perform public.push_enqueue(
      old.created_by,
      'deleted',
      jsonb_build_object(
        'kind', 'deleted',
        'actor', public.push_display_name(auth.uid()),
        'title', old.title,
        'eventId', old.id
      )
    );
  end if;
  return null;
end;
$$;

create trigger push_events_notify
  after update or delete on public.events
  for each row execute function public.push_events_notify();

revoke execute on function
  public.push_enqueue(uuid, text, jsonb, text),
  public.push_display_name(uuid),
  public.push_members_notify(),
  public.push_comments_notify(),
  public.push_events_notify()
from public, anon, authenticated;

-- The send job (opened by the cron secret) -----------------------------------------

-- Events with reminders whose time can fall in [p_from, p_to]: single rows and
-- exceptions near the window, and the series that are still running, with the
-- original start of their exceptions (they warn as their own rows, RF-8). An
-- exception without its own reminders uses those of its series.
create function public.push_due_reminders(p_secret text, p_from timestamptz, p_to timestamptz)
returns table (
  user_id uuid,
  event_id uuid,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  recurrence text,
  recurrence_tz text,
  exdates timestamptz[],
  series_id uuid,
  exceptions timestamptz[],
  minutes integer[],
  time_zone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  return query
  with candidates as (
    select e.*
    from public.events e
    where (
        e.recurrence is null
        and e.starts_at >= p_from - interval '1 day'
        and e.starts_at <= p_to + interval '9 days'
      ) or (
        e.recurrence is not null
        and e.starts_at <= p_to + interval '9 days'
        and (e.recurrence_until is null or e.recurrence_until >= p_from - interval '1 day')
      )
  )
  select
    r.user_id,
    e.id,
    e.title,
    e.location,
    e.starts_at,
    e.ends_at,
    e.all_day,
    e.recurrence,
    e.recurrence_tz,
    coalesce(e.exdates, '{}'),
    e.series_id,
    case when e.recurrence is null then '{}'::timestamptz[] else coalesce(
      (select array_agg(x.original_start) from public.events x where x.series_id = e.id),
      '{}'
    ) end,
    r.minutes,
    p.time_zone
  from candidates e
  join public.event_reminders r
    on r.event_id = e.id
    or (
      e.series_id is not null
      and r.event_id = e.series_id
      and not exists (
        select 1 from public.event_reminders o
        where o.user_id = r.user_id and o.event_id = e.id
      )
    )
  join public.profiles p on p.id = r.user_id
  where exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id);
end;
$$;

-- Marks reminders as sent and returns only the new ones: two runs at once
-- never send one twice (RF-10).
create function public.push_mark_sent(p_secret text, p_keys jsonb)
returns table (user_id uuid, event_id uuid, occurrence_start timestamptz, minutes integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  return query
  insert into public.push_deliveries as d (user_id, event_id, occurrence_start, minutes)
  select k.user_id, k.event_id, k.occurrence_start, k.minutes
  from jsonb_to_recordset(p_keys)
    as k (user_id uuid, event_id uuid, occurrence_start timestamptz, minutes integer)
  on conflict do nothing
  returning d.user_id, d.event_id, d.occurrence_start, d.minutes;
end;
$$;

create function public.push_claim_notifications(p_secret text, p_limit integer default 200)
returns table (id uuid, user_id uuid, kind text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  return query
  update public.push_outbox o
  set claimed_at = now()
  where o.id in (
    select c.id from public.push_outbox c
    where c.claimed_at is null
    order by c.created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning o.id, o.user_id, o.kind, o.payload;
end;
$$;

create function public.push_subscriptions_for(p_secret text, p_user_ids uuid[])
returns table (id uuid, user_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  return query
  select s.id, s.user_id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id = any (p_user_ids);
end;
$$;

-- 404/410 from the push service: the subscription is gone (RF-2).
create function public.push_drop_subscription(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  delete from public.push_subscriptions where id = any (p_ids);
end;
$$;

create function public.push_touch_subscription(p_secret text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  update public.push_subscriptions set last_used_at = now() where id = any (p_ids);
end;
$$;

-- Wakes the app only with something to send (RNF-2): queued notices, a single
-- reminder due in the next 2 minutes, or a running series with reminders
-- (shortcut: series are not expanded in SQL, plan D4; their owners call the
-- route each minute, which is free).
create function public.push_trigger(p_dry_run boolean default false)
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
  if not exists (select 1 from public.push_outbox where claimed_at is null)
    and not exists (
      select 1
      from public.event_reminders r
      join public.events e on e.id = r.event_id
      join public.profiles p on p.id = r.user_id
      cross join lateral unnest(r.minutes) m
      where exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
        and (
          (e.recurrence is null and (
            case when e.all_day
              then ((e.starts_at at time zone 'UTC')::date + time '09:00') at time zone p.time_zone
              else e.starts_at
            end - make_interval(mins => m)
          ) between now() - interval '15 minutes' and now() + interval '2 minutes')
          or (e.recurrence is not null
            and (e.recurrence_until is null or e.recurrence_until >= now()))
        )
    )
    and not exists (
      select 1
      from public.events x
      join public.event_reminders r on r.event_id = x.series_id
      where x.series_id is not null
        and x.starts_at between now() - interval '1 day' and now() + interval '9 days'
        and exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
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
    'url', rtrim(v_url, '/') || '/api/push/run',
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

create function public.push_purge()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_deliveries where sent_at < now() - interval '8 days';
  delete from public.push_outbox
  where (claimed_at is not null and claimed_at < now() - interval '1 day')
     or created_at < now() - interval '2 days';
$$;

-- Test helper, like images_scheduled_jobs.
create function public.push_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text from cron.job j where j.jobname like 'push-%';
$$;

select cron.schedule('push-run', '* * * * *', $$select public.push_trigger()$$);
select cron.schedule('push-purge', '45 4 * * *', $$select public.push_purge()$$);

revoke execute on function
  public.push_due_reminders(text, timestamptz, timestamptz),
  public.push_mark_sent(text, jsonb),
  public.push_claim_notifications(text, integer),
  public.push_subscriptions_for(text, uuid[]),
  public.push_drop_subscription(text, uuid[]),
  public.push_touch_subscription(text, uuid[]),
  public.push_trigger(boolean),
  public.push_purge(),
  public.push_scheduled_jobs()
from public, anon, authenticated;

grant execute on function
  public.push_due_reminders(text, timestamptz, timestamptz),
  public.push_mark_sent(text, jsonb),
  public.push_claim_notifications(text, integer),
  public.push_subscriptions_for(text, uuid[]),
  public.push_drop_subscription(text, uuid[]),
  public.push_touch_subscription(text, uuid[])
to anon, authenticated, service_role;

grant execute on function
  public.push_trigger(boolean),
  public.push_purge(),
  public.push_scheduled_jobs()
to service_role;
