-- Spec 003, T1: the only way to see other members names (plan D7; RF-24,
-- RF-36, RF-37). Returns name and role, never email or time zone, and only for
-- calendars where the caller is a member.

create function public.calendar_members_with_names(p_calendar_ids uuid[])
returns table (
  calendar_id uuid,
  user_id uuid,
  display_name text,
  role public.calendar_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.calendar_id, m.user_id, p.display_name, m.role
  from public.calendar_members m
  join public.profiles p on p.id = m.user_id
  where m.calendar_id = any (p_calendar_ids)
    and public.is_calendar_member(m.calendar_id)
  order by m.calendar_id, m.created_at;
$$;

revoke execute on function public.calendar_members_with_names(uuid[])
from public, anon;
grant execute on function public.calendar_members_with_names(uuid[])
to authenticated;
