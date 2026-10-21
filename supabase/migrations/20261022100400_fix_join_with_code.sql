-- Spec 003, T3 fix: PERFORM resets FOUND, so join_with_code treated a missing
-- or disabled ID as found and tried to insert a member with a null calendar.
-- The previous migration is already applied, so the fix goes in a new one.

-- Limits (D5): a person is blocked when their last 5 failures fit in 15
-- minutes and the latest is under 15 minutes old; an ID, with 20 failures.
create or replace function public.join_with_code(p_code text, p_pin text)
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
  v_found boolean;
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

  -- PERFORM below resets FOUND, so keep it.
  v_found := found;
  if not v_found then
    -- Same bcrypt work as a real check, so timing does not reveal the ID (D13).
    perform extensions.crypt(v_pin, extensions.gen_salt('bf'));
  end if;

  if not v_found
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
