-- Spec 003, T3: ID and PIN functions (plan "Funciones SQL", D1, D3..D5, D13,
-- D16, D17; RF-14, RF-15, RF-17..RF-23, RF-29).
--
-- The PIN is stored with bcrypt (D3). join_with_code returns a status instead
-- of raising, so a failed attempt is not rolled back with the transaction and
-- the limits keep working (D4).

-- 8 characters from a 31-character alphabet (no I, L, O, 0, 1; D16). Taking
-- each random byte modulo 31 has a negligible bias for a public identifier.
create function public.generate_access_code_id()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_id text := '';
  i integer;
begin
  for i in 0..7 loop
    v_id := v_id || substr(v_alphabet, get_byte(v_bytes, i) % 31 + 1, 1);
  end loop;
  return v_id;
end;
$$;

create function public.set_access_code(
  p_calendar_id uuid,
  p_role public.calendar_role,
  p_pin text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can manage the access code'
      using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'The code can only grant editor or viewer'
      using errcode = '22023';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6,10}$' then
    raise exception 'The PIN must have 6 to 10 digits' using errcode = '22023';
  end if;

  -- The ID stays when the PIN changes or the code is enabled again (RF-17).
  update public.calendar_access_codes
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      role = p_role,
      enabled = true
  where calendar_id = p_calendar_id
  returning public_code into v_code;

  if found then
    return v_code;
  end if;

  loop
    v_code := public.generate_access_code_id();
    begin
      insert into public.calendar_access_codes (
        calendar_id, public_code, pin_hash, role
      )
      values (
        p_calendar_id,
        v_code,
        extensions.crypt(p_pin, extensions.gen_salt('bf')),
        p_role
      );
      return v_code;
    exception when unique_violation then
      -- Another calendar has this ID: draw a new one.
      if exists (
        select 1 from public.calendar_access_codes
        where calendar_id = p_calendar_id
      ) then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create function public.disable_access_code(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can manage the access code'
      using errcode = '42501';
  end if;

  update public.calendar_access_codes
  set enabled = false
  where calendar_id = p_calendar_id;
end;
$$;

-- Limits (D5): a person is blocked when their last 5 failures fit in 15
-- minutes and the latest is under 15 minutes old; an ID, with 20 failures.
create function public.join_with_code(p_code text, p_pin text)
returns table (status text, calendar_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_code text := left(upper(btrim(coalesce(p_code, ''))), 32);
  v_pin text := btrim(coalesce(p_pin, ''));
  v_row public.calendar_access_codes;
  v_count integer;
  v_last timestamptz;
  v_first timestamptz;
begin
  -- Housekeeping instead of a cron (D17).
  delete from public.join_attempts
  where created_at < now() - interval '1 day';

  select count(*), max(created_at), min(created_at)
  into v_count, v_last, v_first
  from (
    select created_at
    from public.join_attempts
    where user_id = v_user
    order by created_at desc
    limit 5
  ) recent;
  if v_count = 5
    and v_last > now() - interval '15 minutes'
    and v_last - v_first <= interval '15 minutes' then
    return query select 'limited'::text, null::uuid;
    return;
  end if;

  select count(*), max(created_at), min(created_at)
  into v_count, v_last, v_first
  from (
    select created_at
    from public.join_attempts
    where code = v_code
    order by created_at desc
    limit 20
  ) recent;
  if v_count = 20
    and v_last > now() - interval '15 minutes'
    and v_last - v_first <= interval '15 minutes' then
    return query select 'limited'::text, null::uuid;
    return;
  end if;

  select *
  into v_row
  from public.calendar_access_codes
  where public_code = v_code and enabled;

  if not found then
    -- Same bcrypt work as a real check, so timing does not reveal the ID (D13).
    perform extensions.crypt(v_pin, extensions.gen_salt('bf'));
  end if;

  if not found
    or v_pin !~ '^[0-9]{6,10}$'
    or extensions.crypt(v_pin, v_row.pin_hash) <> v_row.pin_hash then
    insert into public.join_attempts (user_id, code) values (v_user, v_code);
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1
    from public.calendar_members m
    where m.calendar_id = v_row.calendar_id and m.user_id = v_user
  ) then
    return query select 'member'::text, v_row.calendar_id;
    return;
  end if;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (v_row.calendar_id, v_user, v_row.role)
  on conflict do nothing;

  return query select 'ok'::text, v_row.calendar_id;
end;
$$;

revoke execute on function
  public.generate_access_code_id(),
  public.set_access_code(uuid, public.calendar_role, text),
  public.disable_access_code(uuid),
  public.join_with_code(text, text)
from public, anon, authenticated;

grant execute on function
  public.set_access_code(uuid, public.calendar_role, text),
  public.disable_access_code(uuid),
  public.join_with_code(text, text)
to authenticated;
