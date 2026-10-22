-- Spec 006, T6: a full copy of a calendar for one of its members (plan D9;
-- RF-28, RF-20).
--
-- One statement per table inside the caller's transaction, so a failure leaves
-- no copy behind. The copy takes its owner from p_user_id and gets an owner
-- membership from the existing trigger. Invitations and access codes are not
-- copied (RF-28). Authorship is kept as it is, so events of deleted accounts
-- stay with created_by null (shown as "Cuenta borrada").
--
-- Categories are matched by name: the name is unique per calendar ignoring case
-- and surrounding spaces (spec 002), so the match is exact.

create function public.copy_calendar_for_owner(p_calendar_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy uuid;
begin
  insert into public.calendars (owner_id, name, description, color)
  select p_user_id, c.name, c.description, c.color
  from public.calendars c
  where c.id = p_calendar_id
  returning id into v_copy;

  if v_copy is null then
    raise exception 'Calendar not found' using errcode = 'P0002';
  end if;

  insert into public.event_categories (calendar_id, name)
  select v_copy, ec.name
  from public.event_categories ec
  where ec.calendar_id = p_calendar_id;

  insert into public.events (
    calendar_id, title, description, location, starts_at, ends_at,
    all_day, color, category_id, created_by
  )
  select
    v_copy, e.title, e.description, e.location, e.starts_at, e.ends_at,
    e.all_day, e.color, nc.id, e.created_by
  from public.events e
  left join public.event_categories oc on oc.id = e.category_id
  left join public.event_categories nc
    on nc.calendar_id = v_copy
    and lower(btrim(nc.name)) = lower(btrim(oc.name))
  where e.calendar_id = p_calendar_id;

  return v_copy;
end;
$$;

-- Only the scheduled job (postgres) and the test service role call it.
revoke execute on function public.copy_calendar_for_owner(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.copy_calendar_for_owner(uuid, uuid) to service_role;
