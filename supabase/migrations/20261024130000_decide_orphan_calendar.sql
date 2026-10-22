-- Spec 006, T5: a member of a calendar without owner keeps it or leaves it
-- (plan "Contratos"; RF-24, RF-25).
--
-- Keeping only records the decision: the owner is assigned when the deadline
-- closes (T7). Leaving removes the membership right away. CF404 means "not valid
-- for you" (one message for every reason, as in spec 003 D13).

create function public.decide_orphan_calendar(p_calendar_id uuid, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_found uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Locked, so the deadline job (T7) cannot apply a decision while it is recorded.
  select c.id into v_found
  from public.calendars c
  where c.id = p_calendar_id
    and c.owner_id is null
    and exists (
      select 1
      from public.calendar_members m
      where m.calendar_id = c.id
        and m.user_id = v_uid
    )
  for update of c;

  if v_found is null then
    raise exception 'Invalid calendar' using errcode = 'CF404';
  end if;

  insert into public.calendar_orphan_decisions (calendar_id, user_id, keep, decided_at)
  values (p_calendar_id, v_uid, p_keep, now())
  on conflict (calendar_id, user_id)
  do update set keep = excluded.keep, decided_at = excluded.decided_at;

  if not p_keep then
    delete from public.calendar_members
    where calendar_id = p_calendar_id
      and user_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.decide_orphan_calendar(uuid, boolean) from public, anon;
grant execute on function public.decide_orphan_calendar(uuid, boolean) to authenticated;
