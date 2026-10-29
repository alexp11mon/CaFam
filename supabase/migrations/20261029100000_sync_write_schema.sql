-- Spec 009, T2: who can write in a synced calendar (plan "Modelo de datos", D2,
-- D10, D11, D13; RF-2, RF-4, RF-5, RF-8, RF-29).
--
-- Accounts of spec 007 keep can_write = false and stay read-only until they
-- connect again (RF-2). The permission of the account over each calendar in
-- Google comes from accessRole (D10).

alter table public.calendar_connections
  add column can_write boolean not null default false;

alter table public.synced_calendars
  add column google_access text check (google_access in ('owner', 'writer', 'reader'));

-- The one rule for the screens and the write functions (D11).
create function public.can_write_synced(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.synced_calendars s
    join public.calendar_connections c on c.id = s.connection_id
    where s.calendar_id = p_calendar_id
      and s.state = 'active'
      and s.google_access in ('owner', 'writer')
      and c.status = 'active'
      and c.can_write
  );
$$;

-- PostgREST computed field: members read it without reading the connection,
-- whose email only the owner sees (RF-26 of spec 007).
create function public.can_write(public.synced_calendars)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write_synced($1.calendar_id);
$$;

revoke execute on function public.can_write_synced(uuid) from public, anon;
revoke execute on function public.can_write(public.synced_calendars) from public, anon;
grant execute on function public.can_write_synced(uuid) to authenticated;
grant execute on function public.can_write(public.synced_calendars) to authenticated;

-- The name of a synced calendar changes only together with Google, inside
-- sync_update_calendar (D13, like app.account_transfer in spec 006).
create function public.prevent_synced_rename()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
    and public.is_synced_calendar(old.id)
    and coalesce(current_setting('app.sync_write', true), '') <> 'on' then
    raise exception 'A synced calendar is renamed in Google first'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger calendars_prevent_synced_rename
  before update of name on public.calendars
  for each row execute function public.prevent_synced_rename();

-- connect_account gains p_can_write (RF-4, RF-5): same account again keeps its
-- calendars and takes the new permission.
drop function public.connect_account(text, text, text, text);

create function public.connect_account(
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

revoke execute on function public.connect_account(text, text, text, text, boolean) from public, anon;
grant execute on function public.connect_account(text, text, text, text, boolean) to authenticated;

-- Same contract as spec 007; each item may now carry its accessRole (RF-8).
create or replace function public.select_synced_calendars(
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

  create temporary table pg_temp.new_items on commit drop as
  select distinct on (i.external_id) i.external_id, i.name, i.color,
    case when i.access in ('owner', 'writer', 'reader') then i.access end as access
  from jsonb_to_recordset(p_calendars) as i(external_id text, name text, color text, access text)
  where i.external_id is not null
    and not exists (
      select 1 from public.synced_calendars s
      where s.connection_id = p_connection_id and s.external_id = i.external_id
    );

  if (select count(*) from public.synced_calendars where connection_id = p_connection_id)
     + (select count(*) from pg_temp.new_items) > 20 then
    raise exception 'Too many synced calendars' using errcode = 'CF429';
  end if;

  -- Name and color are copied only now; later syncs never overwrite them (D16 of 007).
  for v_item in select * from pg_temp.new_items loop
    insert into public.calendars (owner_id, name, color)
    values (
      v_uid,
      coalesce(nullif(left(trim(v_item.name), 50), ''), 'Calendario'),
      coalesce(v_item.color, '#A0C4FF')
    )
    returning id into v_calendar;

    insert into public.synced_calendars (calendar_id, connection_id, provider, external_id, google_access)
    values (v_calendar, p_connection_id, v_provider, v_item.external_id, v_item.access);

    v_created := v_created || jsonb_build_object(
      'calendar_id', v_calendar, 'external_id', v_item.external_id
    );
  end loop;

  return v_created;
end;
$$;
