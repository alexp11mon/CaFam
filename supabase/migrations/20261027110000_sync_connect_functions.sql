-- Spec 007, T3: the user's functions to connect an account, choose calendars and
-- disconnect (plan "Contratos", D6, D12; RF-6 to RF-8, RF-10, RF-11, RF-14,
-- RF-27 to RF-29, RF-32, RF-45). CF429 = over a limit, CF404 = not valid for you.

create function public.connect_account(
  p_provider text,
  p_subject text,
  p_email text,
  p_refresh_token text
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

  -- Same account again: new token, active again, failures forgotten (RF-6, RF-32).
  if v_id is not null then
    update public.calendar_connections
    set status = 'active', account_email = p_email
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

    return jsonb_build_object('id', v_id, 'existed', true);
  end if;

  if (select count(*) from public.calendar_connections where owner_id = v_uid) >= 5 then
    raise exception 'Too many connected accounts' using errcode = 'CF429';
  end if;

  insert into public.calendar_connections (owner_id, provider, account_subject, account_email)
  values (v_uid, p_provider, p_subject, p_email)
  returning id into v_id;

  insert into public.calendar_connection_secrets (connection_id, vault_secret_id)
  values (v_id, vault.create_secret(p_refresh_token));

  return jsonb_build_object('id', v_id, 'existed', false);
end;
$$;

create function public.select_synced_calendars(
  p_connection_id uuid,
  p_calendars jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_provider text;
  v_item record;
  v_calendar uuid;
  v_created jsonb := '[]'::jsonb;
begin
  select provider into v_provider
  from public.calendar_connections
  where id = p_connection_id and owner_id = v_uid
  for update;

  if v_provider is null then
    raise exception 'Invalid connection' using errcode = 'CF404';
  end if;

  -- Only items not yet synced, without repeating one in the same call.
  create temporary table pg_temp.new_items on commit drop as
  select distinct on (i.external_id) i.external_id, i.name, i.color
  from jsonb_to_recordset(p_calendars) as i(external_id text, name text, color text)
  where i.external_id is not null
    and not exists (
      select 1 from public.synced_calendars s
      where s.connection_id = p_connection_id and s.external_id = i.external_id
    );

  if (select count(*) from public.synced_calendars where connection_id = p_connection_id)
     + (select count(*) from pg_temp.new_items) > 20 then
    raise exception 'Too many synced calendars' using errcode = 'CF429';
  end if;

  -- Name and color are copied only now; later syncs never overwrite them (D16).
  for v_item in select * from pg_temp.new_items loop
    insert into public.calendars (owner_id, name, color)
    values (
      v_uid,
      coalesce(nullif(left(trim(v_item.name), 50), ''), 'Calendario'),
      coalesce(v_item.color, '#A0C4FF')
    )
    returning id into v_calendar;

    insert into public.synced_calendars (calendar_id, connection_id, provider, external_id)
    values (v_calendar, p_connection_id, v_provider, v_item.external_id);

    v_created := v_created || jsonb_build_object(
      'calendar_id', v_calendar, 'external_id', v_item.external_id
    );
  end loop;

  return v_created;
end;
$$;

create function public.detach_synced_calendars(
  p_connection_id uuid,
  p_calendar_ids uuid[],
  p_delete boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if not exists (
    select 1 from public.calendar_connections
    where id = p_connection_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Invalid connection' using errcode = 'CF404';
  end if;

  -- Only calendars of this connection; anything else is ignored.
  select coalesce(array_agg(calendar_id), '{}') into v_ids
  from public.synced_calendars
  where connection_id = p_connection_id
    and calendar_id = any (p_calendar_ids);

  if p_delete then
    -- Events, members and preferences go in cascade (RF-29).
    delete from public.calendars where id = any (v_ids);
  else
    -- A normal, editable calendar again (RF-28, RF-45).
    update public.events set external_id = null where calendar_id = any (v_ids);
    delete from public.synced_calendars where calendar_id = any (v_ids);
  end if;
end;
$$;

create function public.disconnect_account(
  p_connection_id uuid,
  p_delete boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.detach_synced_calendars(
    p_connection_id,
    array(select calendar_id from public.synced_calendars where connection_id = p_connection_id),
    p_delete
  );
  -- The secret row cascades and its trigger removes the token from Vault (RF-30).
  delete from public.calendar_connections where id = p_connection_id;
end;
$$;

-- Test helper: checks a Vault secret without returning it; service role only.
create function public.vault_secret_matches(p_id uuid, p_value text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where id = p_id and decrypted_secret = p_value
  );
$$;

revoke execute on function
  public.connect_account(text, text, text, text),
  public.select_synced_calendars(uuid, jsonb),
  public.detach_synced_calendars(uuid, uuid[], boolean),
  public.disconnect_account(uuid, boolean),
  public.vault_secret_matches(uuid, text)
from public, anon;

grant execute on function
  public.connect_account(text, text, text, text),
  public.select_synced_calendars(uuid, jsonb),
  public.detach_synced_calendars(uuid, uuid[], boolean),
  public.disconnect_account(uuid, boolean)
to authenticated;

revoke execute on function public.vault_secret_matches(uuid, text) from authenticated;
grant execute on function public.vault_secret_matches(uuid, text) to service_role;
