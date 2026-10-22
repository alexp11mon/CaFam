-- Spec 006, T4: deleting an account (plan D1, D2; RF-18 to RF-21, RF-23, RF-20).
--
-- Runs as the caller's session, but as the function owner so it can delete
-- auth.users (D1: no service key in the app). The order matters:
--   1. shared calendars lose their owner first, with a transaction flag that
--      the owner trigger accepts (D2), so the cascade below cannot delete them;
--   2. the other members get an in-app notice and a queued email;
--   3. deleting auth.users cascades to the profile, memberships, preferences
--      and the calendars that had no other member. Events keep their rows and
--      lose their author (created_by is set to null), shown as "Cuenta borrada".

create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_calendar record;
  v_member record;
  v_member_email text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select p.display_name into v_name
  from public.profiles p
  where p.id = v_uid;

  for v_calendar in
    select c.id, c.name
    from public.calendars c
    where c.owner_id = v_uid
      and exists (
        select 1
        from public.calendar_members m
        where m.calendar_id = c.id
          and m.user_id <> v_uid
      )
    for update of c
  loop
    perform set_config('app.account_transfer', 'on', true);
    update public.calendars
    set owner_id = null, orphaned_at = now()
    where id = v_calendar.id;
    perform set_config('app.account_transfer', 'off', true);

    for v_member in
      select m.user_id
      from public.calendar_members m
      where m.calendar_id = v_calendar.id
        and m.user_id <> v_uid
    loop
      select u.email into v_member_email
      from auth.users u
      where u.id = v_member.user_id;

      insert into public.account_notices (user_id, kind, person_name, calendar_name)
      values (v_member.user_id, 'orphaned', coalesce(v_name, ''), v_calendar.name);

      insert into public.email_outbox (to_email, subject, body)
      values (
        v_member_email,
        'Un calendario compartido se queda sin propietario',
        format(
          '%s ha eliminado su cuenta de CalenderFam. El calendario «%s» se queda sin propietario: tienes 15 días para conservarlo o salir de él. Entra en CalenderFam, en Mis calendarios.',
          coalesce(nullif(v_name, ''), 'Una persona'),
          v_calendar.name
        )
      );
    end loop;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
