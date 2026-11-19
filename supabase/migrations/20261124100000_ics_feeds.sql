-- Spec 043, T3: secret .ics subscription link of a calendar (RF-7..RF-11,
-- RNF-3; plan "Modelo de datos", D2, D3).
--
-- The token (32 random bytes, base64url, 43 characters) is stored only as
-- SHA-256, like the invites (spec 003 D2). One link per calendar, only the
-- owner manages it. The public route reads through ics_feed, which is the
-- only way to the events without a session.

create table public.calendar_feeds (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  hits integer not null default 0,
  hits_window timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

revoke all on public.calendar_feeds from anon, authenticated;
-- The owner sees whether there is a link, never its hash (RF-8).
grant select (calendar_id, created_at) on public.calendar_feeds to authenticated;

create policy "calendar_feeds_select_owner" on public.calendar_feeds
  for select to authenticated
  using (public.calendar_role_for(calendar_id) = 'owner');

-- A calendar left without an owner stops publishing (RF-11). Deleting or
-- merging it removes the link by the cascade.
create function public.calendar_feeds_orphaned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.calendar_feeds where calendar_id = new.id;
  return new;
end;
$$;

create trigger calendar_feeds_orphaned
  after update of orphaned_at on public.calendars
  for each row
  when (new.orphaned_at is not null and old.orphaned_at is null)
  execute function public.calendar_feeds_orphaned();

create function public.create_ics_feed(p_calendar_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can publish a calendar' using errcode = 'CF404';
  end if;

  v_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  -- A new link replaces the old one (RF-8).
  insert into public.calendar_feeds (calendar_id, token_hash, created_by)
  values (p_calendar_id, sha256(convert_to(v_token, 'UTF8')), (select auth.uid()))
  on conflict (calendar_id) do update
    set token_hash = excluded.token_hash,
        created_by = excluded.created_by,
        created_at = now(),
        hits = 0,
        hits_window = now();

  return v_token;
end;
$$;

create function public.disable_ics_feed(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can stop publishing' using errcode = 'CF404';
  end if;
  delete from public.calendar_feeds where calendar_id = p_calendar_id;
end;
$$;

-- The events of the calendar of a token: from 6 months ago with no end, and
-- the series still alive (RF-9, plan D3). 60 calls per hour (RNF-3).
create function public.ics_feed(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feed public.calendar_feeds;
  v_name text;
  v_since timestamptz := now() - interval '6 months';
  v_rows jsonb;
begin
  select f.*
  into v_feed
  from public.calendar_feeds f
  where f.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
  for update;

  select c.name
  into v_name
  from public.calendars c
  where c.id = v_feed.calendar_id and c.owner_id is not null;

  if v_feed.calendar_id is null or v_name is null then
    raise exception 'Feed not found' using errcode = 'CF404';
  end if;

  if v_feed.hits_window < now() - interval '1 hour' then
    update public.calendar_feeds
    set hits = 1, hits_window = now()
    where calendar_id = v_feed.calendar_id;
  elsif v_feed.hits >= 60 then
    raise exception 'Too many requests' using errcode = 'CF429';
  else
    update public.calendar_feeds
    set hits = hits + 1
    where calendar_id = v_feed.calendar_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at, e.id), '[]'::jsonb)
  into v_rows
  from (
    select ev.id, ev.title, ev.description, ev.location, ev.starts_at,
      ev.ends_at, ev.all_day, ev.recurrence, ev.recurrence_tz, ev.exdates,
      ev.series_id, ev.original_start, ev.created_at, ev.updated_at
    from public.events ev
    where ev.calendar_id = v_feed.calendar_id
      and (
        (ev.recurrence is null and ev.ends_at >= v_since)
        or (
          ev.recurrence is not null
          and (ev.recurrence_until is null or ev.recurrence_until >= v_since)
        )
      )
  ) e;

  return jsonb_build_object('name', v_name, 'rows', v_rows);
end;
$$;

revoke all on function public.create_ics_feed(uuid) from public, anon;
revoke all on function public.disable_ics_feed(uuid) from public, anon;
revoke all on function public.ics_feed(text) from public;
grant execute on function public.create_ics_feed(uuid) to authenticated;
grant execute on function public.disable_ics_feed(uuid) to authenticated;
grant execute on function public.ics_feed(text) to anon, authenticated;
