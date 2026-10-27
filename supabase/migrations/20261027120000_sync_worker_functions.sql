-- Spec 007, T4: the sync functions and the hourly run (plan "Contratos", D2 to
-- D7, D15; RF-13, RF-22 to RF-25, RF-31, RF-33, RF-34).
--
-- The engine runs in the app without a session and without the service role
-- key (P4), so these functions take p_secret and compare it with cron_secret in
-- Vault (plan D4, R2). A wrong or missing secret raises 42501.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.sync_check_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (
    select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'cron_secret'
  ) then
    raise exception 'Invalid sync secret' using errcode = '42501';
  end if;
end;
$$;

-- Due: active calendars of active connections tried more than 5 hours ago, not
-- running now (a run that died 10 minutes ago no longer counts). Hourly runs
-- keep every calendar under ~6 hours (plan D3, RF-22).
create function public.sync_due_calendars()
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
    and (s.last_attempt_at is null or s.last_attempt_at < now() - interval '5 hours')
    and (s.sync_started_at is null or s.sync_started_at < now() - interval '10 minutes');
$$;

create function public.sync_claim_due(p_secret text, p_limit integer default 50)
returns table (calendar_id uuid, connection_id uuid, provider text, external_id text)
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
      order by d.last_attempt_at nulls first
      limit p_limit
    )
    returning s.calendar_id, s.connection_id, s.provider, s.external_id
  )
  select c.calendar_id, c.connection_id, c.provider, c.external_id from claimed c;
end;
$$;

create function public.sync_claim_connection(
  p_secret text,
  p_connection_id uuid,
  p_manual boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.calendar_connections;
  v_calendars jsonb;
begin
  perform public.sync_check_secret(p_secret);

  select * into v_connection
  from public.calendar_connections
  where id = p_connection_id
  for update;

  if v_connection.id is null then
    raise exception 'Invalid connection' using errcode = 'CF404';
  end if;

  if v_connection.status <> 'active' then
    return jsonb_build_object('status', 'needs_reauth');
  end if;

  -- RF-24: no new request to the provider within 5 minutes of the last update.
  if p_manual and v_connection.last_synced_at > now() - interval '5 minutes' then
    return jsonb_build_object(
      'status', 'too_soon',
      'next_at', v_connection.last_synced_at + interval '5 minutes'
    );
  end if;

  with claimed as (
    update public.synced_calendars s
    set last_attempt_at = now(), sync_started_at = now()
    where s.connection_id = p_connection_id
      and s.state = 'active'
      and (s.sync_started_at is null or s.sync_started_at < now() - interval '10 minutes')
    returning s.calendar_id, s.connection_id, s.provider, s.external_id
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into v_calendars from claimed;

  return jsonb_build_object('status', 'ok', 'calendars', v_calendars);
end;
$$;

create function public.sync_get_token(p_secret text, p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_check_secret(p_secret);

  return (
    select ds.decrypted_secret
    from public.calendar_connection_secrets s
    join vault.decrypted_secrets ds on ds.id = s.vault_secret_id
    where s.connection_id = p_connection_id
  );
end;
$$;

-- Microsoft rotates the refresh token on every use: store it before going on (R3).
create function public.sync_store_token(p_secret text, p_connection_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  perform public.sync_check_secret(p_secret);

  select vault_secret_id into v_secret
  from public.calendar_connection_secrets
  where connection_id = p_connection_id;

  if v_secret is null then
    raise exception 'Invalid connection' using errcode = 'CF404';
  end if;

  perform vault.update_secret(v_secret, p_token);
end;
$$;

-- Reconciles the whole window by external_id (plan D7): inserts the new events,
-- changes only those that differ and removes the ones that no longer arrive.
create function public.sync_apply_events(
  p_secret text,
  p_calendar_id uuid,
  p_events jsonb,
  p_skipped integer default 0,
  p_omitted integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection uuid;
  v_owner uuid;
  v_added integer;
  v_changed integer;
  v_removed integer;
  v_summary jsonb;
begin
  perform public.sync_check_secret(p_secret);

  -- Locking the row serializes a manual and an automatic run of one calendar.
  select s.connection_id, c.owner_id into v_connection, v_owner
  from public.synced_calendars s
  join public.calendars c on c.id = s.calendar_id
  where s.calendar_id = p_calendar_id
  for update of s;

  if v_connection is null then
    raise exception 'Invalid synced calendar' using errcode = 'CF404';
  end if;

  create temporary table pg_temp.incoming on commit drop as
  select distinct on (i.external_id) i.*
  from jsonb_to_recordset(p_events) as i(
    external_id text,
    title text,
    description text,
    location text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean
  )
  where i.external_id is not null;

  delete from public.events e
  where e.calendar_id = p_calendar_id
    and (e.external_id is null
      or not exists (select 1 from pg_temp.incoming i where i.external_id = e.external_id));
  get diagnostics v_removed = row_count;

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
    and (e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day)
      is distinct from (i.title, i.description, i.location, i.starts_at, i.ends_at, coalesce(i.all_day, false));
  get diagnostics v_changed = row_count;

  insert into public.events (
    calendar_id, external_id, title, description, location, starts_at, ends_at, all_day, created_by
  )
  select p_calendar_id, i.external_id, i.title, i.description, i.location,
         i.starts_at, i.ends_at, coalesce(i.all_day, false), v_owner
  from pg_temp.incoming i
  where not exists (
    select 1 from public.events e
    where e.calendar_id = p_calendar_id and e.external_id = i.external_id
  );
  get diagnostics v_added = row_count;

  v_summary := jsonb_build_object(
    'added', v_added,
    'changed', v_changed,
    'removed', v_removed,
    'skipped', coalesce(p_skipped, 0),
    'omitted', coalesce(p_omitted, 0)
  );

  update public.synced_calendars
  set last_synced_at = now(),
      sync_started_at = null,
      consecutive_failures = 0,
      last_error = null,
      last_summary = v_summary
  where calendar_id = p_calendar_id;

  update public.calendar_connections set last_synced_at = now() where id = v_connection;

  return v_summary;
end;
$$;

-- A failed update keeps the data (RF-33). transient counts towards the notice
-- at the third failure in a row (RF-34); revoked stops the whole account (RF-31);
-- missing stops the calendar until the user decides (RF-13).
create function public.sync_fail(p_secret text, p_calendar_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.synced_calendars;
  v_connection public.calendar_connections;
  v_name text;
begin
  perform public.sync_check_secret(p_secret);

  if p_kind not in ('transient', 'revoked', 'missing') then
    raise exception 'Invalid failure kind' using errcode = '22023';
  end if;

  update public.synced_calendars
  set sync_started_at = null,
      last_error = p_kind,
      consecutive_failures = consecutive_failures + (p_kind = 'transient')::integer,
      state = case when p_kind = 'missing' then 'missing' else state end
  where calendar_id = p_calendar_id
  returning * into v_row;

  if v_row.calendar_id is null then
    raise exception 'Invalid synced calendar' using errcode = 'CF404';
  end if;

  select * into v_connection from public.calendar_connections where id = v_row.connection_id;

  if p_kind = 'transient' and v_row.consecutive_failures = 3 then
    select name into v_name from public.calendars where id = p_calendar_id;
    insert into public.account_notices (user_id, kind, calendar_name)
    values (v_connection.owner_id, 'sync_failing', v_name);
  elsif p_kind = 'revoked' and v_connection.status = 'active' then
    update public.calendar_connections set status = 'needs_reauth' where id = v_connection.id;
    insert into public.account_notices (user_id, kind, calendar_name)
    values (v_connection.owner_id, 'sync_revoked', v_connection.account_email);
  end if;
end;
$$;

-- Called by pg_cron every hour: wakes the app up only when something is due and
-- both Vault secrets exist (plan D2). The dry run returns the request instead of
-- sending it (tests).
create function public.sync_trigger(p_dry_run boolean default false)
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
  if not exists (select 1 from public.sync_due_calendars()) then
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

-- Test helper: lists the sync jobs for the service role only.
create function public.sync_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text from cron.job j where j.jobname like 'sync-%';
$$;

select cron.schedule('sync-run-due', '0 * * * *', $$select public.sync_trigger()$$);

revoke execute on function
  public.sync_check_secret(text),
  public.sync_due_calendars(),
  public.sync_claim_due(text, integer),
  public.sync_claim_connection(text, uuid, boolean),
  public.sync_get_token(text, uuid),
  public.sync_store_token(text, uuid, text),
  public.sync_apply_events(text, uuid, jsonb, integer, integer),
  public.sync_fail(text, uuid, text),
  public.sync_trigger(boolean),
  public.sync_scheduled_jobs()
from public, anon, authenticated;

-- The engine calls these with the publishable key and the secret (plan D4).
grant execute on function
  public.sync_claim_due(text, integer),
  public.sync_claim_connection(text, uuid, boolean),
  public.sync_get_token(text, uuid),
  public.sync_store_token(text, uuid, text),
  public.sync_apply_events(text, uuid, jsonb, integer, integer),
  public.sync_fail(text, uuid, text)
to anon, authenticated, service_role;

grant execute on function public.sync_trigger(boolean), public.sync_scheduled_jobs()
  to service_role;
