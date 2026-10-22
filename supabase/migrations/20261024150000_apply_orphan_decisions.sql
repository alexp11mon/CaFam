-- Spec 006, T7: settle the calendars without owner (plan "Contratos", D3, D4;
-- RF-26 to RF-29).
--
-- A calendar is settled when every member has decided, or 15 days have passed
-- since its owner left (RF-26). Then, by the members who keep it (RF-27, RF-28, RF-29):
--   0 keepers: the calendar is deleted and its remaining members are told;
--   1 keeper:  that member becomes the owner, no copy;
--   n keepers: each one gets a full copy (copy_calendar_for_owner) and the
--              original is deleted.
-- Undecided members do not keep it. The row lock stops a decision from being
-- recorded while its calendar is being settled.
--
-- Run daily by pg_cron as postgres (T8). The mail rows are queued here and sent
-- by send_pending_emails (T8).

create function public.apply_orphan_decisions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cal record;
  v_keepers uuid[];
  v_keeper uuid;
  v_email text;
begin
  for v_cal in
    select c.id, c.name
    from public.calendars c
    where c.owner_id is null
      and (
        not exists (
          select 1
          from public.calendar_members m
          where m.calendar_id = c.id
            and not exists (
              select 1
              from public.calendar_orphan_decisions d
              where d.calendar_id = m.calendar_id
                and d.user_id = m.user_id
            )
        )
        or c.orphaned_at <= now() - interval '15 days'
      )
    for update of c
  loop
    -- Keepers are those who chose to keep and are still members.
    select coalesce(array_agg(d.user_id order by d.decided_at, d.user_id), '{}')
    into v_keepers
    from public.calendar_orphan_decisions d
    join public.calendar_members m
      on m.calendar_id = d.calendar_id and m.user_id = d.user_id
    where d.calendar_id = v_cal.id
      and d.keep;

    if cardinality(v_keepers) = 0 then
      insert into public.account_notices (user_id, kind, calendar_name)
      select m.user_id, 'deleted_calendar', v_cal.name
      from public.calendar_members m
      where m.calendar_id = v_cal.id;

      delete from public.calendars where id = v_cal.id;

    elsif cardinality(v_keepers) = 1 then
      perform set_config('app.account_transfer', 'on', true);
      update public.calendars
      set owner_id = v_keepers[1], orphaned_at = null
      where id = v_cal.id;
      perform set_config('app.account_transfer', 'off', true);

      update public.calendar_members
      set role = 'owner'
      where calendar_id = v_cal.id
        and user_id = v_keepers[1];

    else
      foreach v_keeper in array v_keepers loop
        perform public.copy_calendar_for_owner(v_cal.id, v_keeper);

        insert into public.account_notices (user_id, kind, calendar_name)
        values (v_keeper, 'kept_copy', v_cal.name);

        select u.email into v_email
        from auth.users u
        where u.id = v_keeper;

        insert into public.email_outbox (to_email, subject, body)
        values (
          v_email,
          'Tienes tu copia del calendario',
          format(
            'El calendario «%s» ya es tuyo: tienes una copia completa en Mis calendarios. El original se ha eliminado.',
            v_cal.name
          )
        );
      end loop;

      delete from public.calendars where id = v_cal.id;
    end if;

    delete from public.calendar_orphan_decisions where calendar_id = v_cal.id;
  end loop;
end;
$$;

-- Only the scheduled job (postgres) and the test service role call it.
revoke execute on function public.apply_orphan_decisions() from public, anon, authenticated;
grant execute on function public.apply_orphan_decisions() to service_role;
