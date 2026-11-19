-- Spec 046, T1 and T2: the trash keeps every deletion made in CaFam for 30
-- days, per calendar, for its owner and editors (plan D1, D2; RF-1 to RF-10).
--
-- event_trash (spec 017) kept the last copy of each user for a minute. Now:
-- one row per deletion with what the list needs (kind, title, start), whole
-- series too, and expires_at. restore_event no longer asks for whoever
-- deleted nor the first minute, but keeps the check of spec 023.

alter table public.event_trash
  add column kind text not null default 'event'
    check (kind in ('event', 'occurrence', 'series')),
  add column title text not null default '',
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column all_day boolean not null default false,
  -- A series: its exceptions as they were (rows of events).
  add column exceptions jsonb not null default '[]',
  -- A series: how many occurrences it had, when it ends (RF-2).
  add column occurrences integer,
  add column expires_at timestamptz not null default now() + interval '30 days';

-- The copy outlives its author's account: the others can still restore it.
alter table public.event_trash
  alter column deleted_by drop not null,
  drop constraint event_trash_deleted_by_fkey,
  add constraint event_trash_deleted_by_fkey
    foreign key (deleted_by) references public.profiles (id) on delete set null;

-- Rows of spec 017 (an hour at most) keep their short life.
update public.event_trash set expires_at = created_at + interval '1 hour';

create index event_trash_expires_at_idx on public.event_trash (expires_at);

-- Every copy is kept now (RF-1): the delete of the previous one is gone.
create or replace function public.snapshot_event(
  p_event_id uuid,
  p_original_start timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_series public.events;
  v_calendar uuid;
  v_id uuid;
begin
  if p_original_start is null then
    select * into v_event from public.events where id = p_event_id;
    v_calendar := v_event.calendar_id;
  else
    -- p_event_id is the series; its exception of that date, if any.
    select * into v_series
    from public.events
    where id = p_event_id and recurrence is not null;
    v_calendar := v_series.calendar_id;
    select * into v_event
    from public.events
    where series_id = p_event_id and original_start = p_original_start;
  end if;

  if v_calendar is null
    or coalesce(public.calendar_role_for(v_calendar)::text, '') not in ('owner', 'editor')
  then
    raise exception 'Event not found' using errcode = 'CF404';
  end if;

  insert into public.event_trash (
    calendar_id, kind, title, starts_at, ends_at, all_day,
    event, series_id, original_start, images, comments
  )
  values (
    v_calendar,
    case when p_original_start is null then 'event' else 'occurrence' end,
    coalesce(v_event.title, v_series.title),
    coalesce(v_event.starts_at, p_original_start),
    coalesce(
      v_event.ends_at,
      p_original_start + (v_series.ends_at - v_series.starts_at)
    ),
    coalesce(v_event.all_day, v_series.all_day),
    case when v_event.id is null then null else to_jsonb(v_event) end,
    case when p_original_start is null then null else p_event_id end,
    p_original_start,
    coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at)
      from public.event_images i
      where i.event_id = v_event.id and i.status = 'ready'
    ), '[]'),
    coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.event_comments c
      where c.event_id = v_event.id
    ), '[]')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- A whole series, or "este y los siguientes" (p_from), before it is deleted
-- or truncated: the series row, its exceptions, their images and comments
-- (RF-2). Restoring puts the series back as it was.
create function public.snapshot_series(
  p_series_id uuid,
  p_from timestamptz default null,
  p_occurrences integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.events;
  v_id uuid;
begin
  select * into v_series
  from public.events
  where id = p_series_id and recurrence is not null;
  if v_series.id is null
    or coalesce(public.calendar_role_for(v_series.calendar_id)::text, '') not in ('owner', 'editor')
  then
    raise exception 'Event not found' using errcode = 'CF404';
  end if;

  insert into public.event_trash (
    calendar_id, kind, title, starts_at, ends_at, all_day, event,
    original_start, exceptions, occurrences, images, comments
  )
  values (
    v_series.calendar_id,
    'series',
    v_series.title,
    coalesce(p_from, v_series.starts_at),
    coalesce(p_from, v_series.starts_at) + (v_series.ends_at - v_series.starts_at),
    v_series.all_day,
    to_jsonb(v_series),
    p_from,
    coalesce((
      select jsonb_agg(to_jsonb(e) order by e.original_start)
      from public.events e
      where e.series_id = p_series_id
    ), '[]'),
    p_occurrences,
    coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at)
      from public.event_images i
      join public.events e on e.id = i.event_id
      where e.series_id = p_series_id and i.status = 'ready'
    ), '[]'),
    coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.event_comments c
      join public.events e on e.id = c.event_id
      where e.series_id = p_series_id
    ), '[]')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Any owner or editor restores within the 30 days (RF-4, RF-5, RF-14); the
-- target of a synced calendar must be of the copy's calendar (spec 023 RF-1).
create or replace function public.restore_event(
  p_trash_id uuid,
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trash public.event_trash;
  v_event public.events;
  v_series uuid;
  v_id uuid;
begin
  select * into v_trash
  from public.event_trash
  where id = p_trash_id and expires_at > now();
  if v_trash.id is null
    or coalesce(public.calendar_role_for(v_trash.calendar_id)::text, '') not in ('owner', 'editor')
  then
    raise exception 'Nothing to restore' using errcode = 'CF404';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.calendar_id = v_trash.calendar_id
  ) then
    raise exception 'Nothing to restore' using errcode = 'CF404';
  end if;

  if v_trash.kind = 'series' then
    v_event := jsonb_populate_record(null::public.events, v_trash.event);
    -- "Este y los siguientes" left the series truncated: it goes back whole.
    -- Its images and comments are in the copy, so nothing is lost.
    delete from public.events where id = v_event.id;
    insert into public.events select v_event.*;
    insert into public.events
    select (jsonb_populate_record(null::public.events, e)).*
    from jsonb_array_elements(v_trash.exceptions) e;
    insert into public.event_images
    select (jsonb_populate_record(null::public.event_images, i)).*
    from jsonb_array_elements(v_trash.images) i;
    insert into public.event_comments
    select (jsonb_populate_record(null::public.event_comments, c)).*
    from jsonb_array_elements(v_trash.comments) c;
    delete from public.image_purge_queue q
    where q.object_id in (
      select (i ->> 'object_id')::uuid from jsonb_array_elements(v_trash.images) i
    );
    delete from public.event_trash where id = v_trash.id;
    return v_event.id;
  end if;

  if v_trash.event is not null then
    v_event := jsonb_populate_record(null::public.events, v_trash.event);
  end if;

  -- An occurrence of a series that is gone cannot come back (RF-5).
  v_series := coalesce(v_trash.series_id, v_event.series_id);
  if v_series is not null and not exists (
    select 1 from public.events where id = v_series
  ) then
    raise exception 'Series not found' using errcode = 'CF410';
  end if;

  if v_trash.event is not null then
    if p_event_id is null then
      -- A synced calendar gets the event back through the provider first.
      if public.is_synced_calendar(v_trash.calendar_id) then
        raise exception 'Synced calendar' using errcode = '22023';
      end if;
      insert into public.events select v_event.*;
      v_id := v_event.id;
    else
      update public.events set created_by = v_event.created_by where id = p_event_id;
      v_id := p_event_id;
    end if;

    insert into public.event_images
    select (jsonb_populate_record(null::public.event_images, i || jsonb_build_object('event_id', v_id))).*
    from jsonb_array_elements(v_trash.images) i;

    delete from public.image_purge_queue q
    where q.object_id in (
      select (i ->> 'object_id')::uuid from jsonb_array_elements(v_trash.images) i
    );

    insert into public.event_comments
    select (jsonb_populate_record(null::public.event_comments, c || jsonb_build_object('event_id', v_id))).*
    from jsonb_array_elements(v_trash.comments) c;
  end if;

  -- An occurrence: deleting it added its date to the series' exdates.
  if v_series is not null then
    update public.events
    set exdates = array_remove(exdates, coalesce(v_trash.original_start, v_event.original_start))
    where id = v_series;
    v_id := coalesce(v_id, v_series);
  end if;

  delete from public.event_trash where id = v_trash.id;
  return v_id;
end;
$$;

-- The saved row, for restoring in Google or iCloud first (spec 017 T4).
create or replace function public.trash_row(p_trash_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select t.event
  from public.event_trash t
  where t.id = p_trash_id
    and t.expires_at > now()
    and coalesce(public.calendar_role_for(t.calendar_id)::text, '') in ('owner', 'editor');
$$;

-- The trash of every calendar where the caller is owner or editor (RF-3,
-- RF-4, RF-10), without the saved rows (plan D2).
create function public.trash_list()
returns table (
  id uuid,
  calendar_id uuid,
  kind text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  series_id uuid,
  original_start timestamptz,
  occurrences integer,
  images integer,
  comments integer,
  deleted_by uuid,
  deleted_by_name text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.calendar_id, t.kind, t.title, t.starts_at, t.ends_at, t.all_day,
    t.series_id, t.original_start, t.occurrences,
    jsonb_array_length(t.images), jsonb_array_length(t.comments),
    t.deleted_by, p.display_name, t.created_at, t.expires_at
  from public.event_trash t
  join public.calendar_members m
    on m.calendar_id = t.calendar_id
   and m.user_id = auth.uid()
   and m.role in ('owner', 'editor')
  left join public.profiles p on p.id = t.deleted_by
  where t.expires_at > now()
  order by t.created_at desc
  limit 500;
$$;

-- "Borrar para siempre": an owner or editor (RF-6). The objects of its images
-- are already queued; with the copy gone, the purge takes them (RF-9).
create function public.trash_purge(p_trash_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar uuid;
begin
  select calendar_id into v_calendar from public.event_trash where id = p_trash_id;
  if v_calendar is null
    or coalesce(public.calendar_role_for(v_calendar)::text, '') not in ('owner', 'editor')
  then
    raise exception 'Nothing to purge' using errcode = 'CF404';
  end if;
  delete from public.event_trash where id = p_trash_id;
end;
$$;

-- "Vaciar la papelera" of a calendar: only its owner (RF-6).
create function public.trash_empty(p_calendar_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(public.calendar_role_for(p_calendar_id)::text, '') <> 'owner' then
    raise exception 'Not the owner' using errcode = 'CF404';
  end if;
  delete from public.event_trash where calendar_id = p_calendar_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.snapshot_series(uuid, timestamptz, integer),
  public.trash_list(),
  public.trash_purge(uuid),
  public.trash_empty(uuid)
from public, anon;
grant execute on function
  public.snapshot_series(uuid, timestamptz, integer),
  public.trash_list(),
  public.trash_purge(uuid),
  public.trash_empty(uuid)
to authenticated;

-- The daily cleanup now takes the copies past their 30 days (RF-7).
create or replace function public.trash_purge()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.event_trash where expires_at <= now();
$$;

-- Objects of images in a live copy are never claimed (RF-9): they wait in the
-- queue until the copy is restored (and leaves it) or goes.
create or replace function public.images_claim_purge(
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
      and (
        (p_object_ids is null and c.queued_at < now() - interval '2 minutes')
        or c.object_id = any (p_object_ids)
      )
      and not exists (
        select 1
        from public.event_trash t, jsonb_array_elements(t.images) i
        where t.expires_at > now()
          and (i ->> 'object_id')::uuid = c.object_id
      )
    order by c.queued_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning q.object_id;
end;
$$;
