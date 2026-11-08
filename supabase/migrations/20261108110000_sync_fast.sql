-- Spec 020, T8: Google changes in minutes and iCloud every 15 minutes (plan
-- "Modelo de datos", D7 to D12; RF-19 to RF-30).

-- What the engine needs to skip a read and to know a notice arrived (D9, D7).
-- Members already read synced_calendars: none of these is secret.
alter table public.synced_calendars
  add column remote_version text,
  add column full_read_at timestamptz,
  add column push_pending_at timestamptz;

-- RF-20, D10: one Google notification channel per synced calendar. The token
-- is kept as SHA-256 only; no client reads or writes this table (P4).
create table public.sync_channels (
  calendar_id uuid primary key references public.synced_calendars (calendar_id) on delete cascade,
  connection_id uuid not null,
  channel_id text not null unique,
  resource_id text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.sync_channels enable row level security;
revoke all on public.sync_channels from anon, authenticated;

-- RF-22, D11: channels to stop in Google. No foreign key to the connection: a
-- disconnect deletes it in the same statement that queues its channels; the
-- claim drops the stops of connections that no longer exist.
create table public.sync_channel_stops (
  channel_id text primary key,
  resource_id text not null,
  connection_id uuid not null,
  queued_at timestamptz not null default now()
);

alter table public.sync_channel_stops enable row level security;
revoke all on public.sync_channel_stops from anon, authenticated;

create function public.queue_channel_stop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_channel_stops (channel_id, resource_id, connection_id)
  values (old.channel_id, old.resource_id, old.connection_id)
  on conflict (channel_id) do nothing;
  return old;
end;
$$;

-- Not calling stop, deleting the calendar or the account, disconnecting or
-- replacing the channel: every way a channel goes ends here.
create trigger sync_channels_queue_stop
  after delete on public.sync_channels
  for each row execute function public.queue_channel_stop();

-- Due (D7, RF-23, RF-24, RF-26): a notice whose last attempt was over a minute
-- ago, or no attempt in 15 minutes; never one running (10 minutes, as before).
create or replace function public.sync_due_calendars()
returns setof public.synced_calendars
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.synced_calendars s
  join public.calendar_connections c on c.id = s.connection_id
  where s.state = 'active'
    and c.status = 'active'
    and (s.sync_started_at is null or s.sync_started_at < now() - interval '10 minutes')
    and (
      s.last_attempt_at is null
      or s.last_attempt_at < now() - interval '15 minutes'
      -- A failing calendar waits the 15 minutes, notice or not.
      or (
        s.push_pending_at is not null
        and s.consecutive_failures = 0
        and s.last_attempt_at < now() - interval '1 minute'
      )
    );
$$;

-- Same claim, plus what decides whether to read everything (D9) and whether
-- the channel needs renewing (D8).
drop function public.sync_claim_due(text, integer);

create function public.sync_claim_due(p_secret text, p_limit integer default 50)
returns table (
  calendar_id uuid,
  connection_id uuid,
  provider text,
  external_id text,
  remote_version text,
  full_read_at timestamptz,
  push_pending_at timestamptz,
  channel_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.sync_check_secret(p_secret);

  return query
  with claimed as (
    update public.synced_calendars s
    set last_attempt_at = now(), sync_started_at = now()
    where s.calendar_id in (
      select d.calendar_id
      from public.sync_due_calendars() d
      -- Notices first, then the longest waiting.
      order by d.push_pending_at nulls last, d.last_attempt_at nulls first
      limit p_limit
    )
    returning s.calendar_id, s.connection_id, s.provider, s.external_id,
              s.remote_version, s.full_read_at, s.push_pending_at
  )
  select c.calendar_id, c.connection_id, c.provider, c.external_id,
         c.remote_version, c.full_read_at, c.push_pending_at, ch.expires_at
  from claimed c
  left join public.sync_channels ch on ch.calendar_id = c.calendar_id;
end;
$$;

-- RF-19, RF-21, D10: a Google notice. Only a known channel with its token marks
-- the calendar; anything else does nothing, and nothing tells the two apart.
-- The first notice of a channel ('sync') carries no change.
create function public.sync_push(p_secret text, p_channel_id text, p_token text, p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  if p_channel_id is null or p_token is null or p_state is not distinct from 'sync' then
    return;
  end if;

  update public.synced_calendars s
  set push_pending_at = now()
  from public.sync_channels ch
  where ch.channel_id = p_channel_id
    and ch.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.calendar_id = ch.calendar_id;
end;
$$;

-- RF-20: the channel Google accepted; replacing one queues the old for stop.
create function public.sync_store_channel(
  p_secret text,
  p_calendar_id uuid,
  p_channel_id text,
  p_resource_id text,
  p_token text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection uuid;
begin
  perform public.sync_check_secret(p_secret);
  select connection_id into v_connection
  from public.synced_calendars where calendar_id = p_calendar_id;
  if v_connection is null then
    raise exception 'Invalid calendar' using errcode = 'CF404';
  end if;

  delete from public.sync_channels where calendar_id = p_calendar_id;
  insert into public.sync_channels (calendar_id, connection_id, channel_id, resource_id, token_hash, expires_at)
  values (
    p_calendar_id,
    v_connection,
    p_channel_id,
    p_resource_id,
    encode(extensions.digest(p_token, 'sha256'), 'hex'),
    p_expires_at
  );
end;
$$;

-- D9, D12, RF-27, RF-30: after checking the version. A full read was already
-- recorded by sync_apply_events; a check without changes is a correct update
-- too. A notice that arrived after this attempt was claimed stays pending.
create function public.sync_mark_checked(
  p_secret text,
  p_calendar_id uuid,
  p_version text,
  p_full boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection uuid;
begin
  perform public.sync_check_secret(p_secret);

  update public.synced_calendars
  set remote_version = coalesce(p_version, remote_version),
      full_read_at = case when p_full then now() else full_read_at end,
      push_pending_at = case
        when push_pending_at <= last_attempt_at then null
        else push_pending_at
      end,
      last_synced_at = case when p_full then last_synced_at else now() end,
      sync_started_at = null,
      consecutive_failures = case when p_full then consecutive_failures else 0 end,
      last_error = case when p_full then last_error else null end
  where calendar_id = p_calendar_id
  returning connection_id into v_connection;

  if v_connection is not null and not p_full then
    update public.calendar_connections set last_synced_at = now() where id = v_connection;
  end if;
end;
$$;

-- RF-22: channels to stop, with the connection whose token stops them.
create function public.sync_claim_stops(p_secret text, p_limit integer default 20)
returns table (channel_id text, resource_id text, connection_id uuid, provider text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.sync_check_secret(p_secret);
  -- A gone or broken connection cannot stop anything; its channels expire.
  delete from public.sync_channel_stops st
  where not exists (
    select 1 from public.calendar_connections c
    where c.id = st.connection_id and c.status = 'active'
  );

  return query
  select st.channel_id, st.resource_id, st.connection_id, c.provider
  from public.sync_channel_stops st
  join public.calendar_connections c on c.id = st.connection_id
  order by st.queued_at
  limit p_limit;
end;
$$;

create function public.sync_done_stop(p_secret text, p_channel_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);
  delete from public.sync_channel_stops where channel_id = p_channel_id;
end;
$$;

-- Also wakes the app for queued stops (D11).
create or replace function public.sync_trigger(p_dry_run boolean default false)
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
  if not exists (select 1 from public.sync_due_calendars())
     and not exists (
       select 1 from public.sync_channel_stops st
       join public.calendar_connections c on c.id = st.connection_id and c.status = 'active'
     ) then
    return null;
  end if;

  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'cron_secret';
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'sync_app_url';
  if v_secret is null or v_url is null then
    return null;
  end if;

  v_request := jsonb_build_object(
    'url', rtrim(v_url, '/') || '/api/sync/run',
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

-- D8: a new token means new channels; the old ones are queued for stop and,
-- if the old token no longer works, simply expire.
create or replace function public.connect_account(
  p_provider text,
  p_subject text,
  p_email text,
  p_refresh_token text,
  p_can_write boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_secret uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select c.id, s.vault_secret_id
  into v_id, v_secret
  from public.calendar_connections c
  left join public.calendar_connection_secrets s on s.connection_id = c.id
  where c.owner_id = v_uid
    and c.provider = p_provider
    and c.account_subject = p_subject
  for update of c;

  if v_id is not null then
    update public.calendar_connections
    set status = 'active', account_email = p_email, can_write = coalesce(p_can_write, false)
    where id = v_id;

    if v_secret is null then
      insert into public.calendar_connection_secrets (connection_id, vault_secret_id)
      values (v_id, vault.create_secret(p_refresh_token));
    else
      perform vault.update_secret(v_secret, p_refresh_token);
    end if;

    update public.synced_calendars
    set consecutive_failures = 0
    where connection_id = v_id;

    delete from public.sync_channels where connection_id = v_id;

    return jsonb_build_object('id', v_id, 'existed', true);
  end if;

  if (select count(*) from public.calendar_connections where owner_id = v_uid) >= 5 then
    raise exception 'Too many connected accounts' using errcode = 'CF429';
  end if;

  insert into public.calendar_connections (owner_id, provider, account_subject, account_email, can_write)
  values (v_uid, p_provider, p_subject, p_email, coalesce(p_can_write, false))
  returning id into v_id;

  insert into public.calendar_connection_secrets (connection_id, vault_secret_id)
  values (v_id, vault.create_secret(p_refresh_token));

  return jsonb_build_object('id', v_id, 'existed', false);
end;
$$;

-- RF-19: every minute; sync_trigger only calls the app when there is work.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'sync-run-due'),
  schedule := '* * * * *'
);

revoke execute on function
  public.queue_channel_stop(),
  public.sync_claim_due(text, integer),
  public.sync_push(text, text, text, text),
  public.sync_store_channel(text, uuid, text, text, text, timestamptz),
  public.sync_mark_checked(text, uuid, text, boolean),
  public.sync_claim_stops(text, integer),
  public.sync_done_stop(text, text)
from public, anon, authenticated;

-- The engine and the notice route call these with the publishable key and the
-- secret (spec 007 plan D4).
grant execute on function
  public.sync_claim_due(text, integer),
  public.sync_push(text, text, text, text),
  public.sync_store_channel(text, uuid, text, text, text, timestamptz),
  public.sync_mark_checked(text, uuid, text, boolean),
  public.sync_claim_stops(text, integer),
  public.sync_done_stop(text, text)
to anon, authenticated, service_role;
