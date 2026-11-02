-- Spec 019, T2: tell each member of a calendar that something changed, so their
-- open calendar reads again with RLS (plan "Modelo de datos", D2 to D5;
-- RF-40, RF-42, RF-45, RF-47). The message carries only who made the change.

-- Sends 'changed' to every member of a calendar (and to p_extra_user, who may
-- have just left it), once per calendar and user per transaction (D4). Never
-- blocks the write that fired it (plan R1).
create function public.live_notify(p_calendar_id uuid, p_extra_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object('actor', auth.uid());
  v_member uuid;
begin
  if p_calendar_id is not null
     and coalesce(current_setting('cafam_live.c' || replace(p_calendar_id::text, '-', ''), true), '') = '' then
    perform set_config('cafam_live.c' || replace(p_calendar_id::text, '-', ''), '1', true);
    for v_member in
      select m.user_id from public.calendar_members m where m.calendar_id = p_calendar_id
    loop
      perform set_config('cafam_live.u' || replace(v_member::text, '-', ''), '1', true);
      perform realtime.send(v_payload, 'changed', 'user:' || v_member::text, true);
    end loop;
  end if;

  if p_extra_user is not null
     and coalesce(current_setting('cafam_live.u' || replace(p_extra_user::text, '-', ''), true), '') = '' then
    perform set_config('cafam_live.u' || replace(p_extra_user::text, '-', ''), '1', true);
    perform realtime.send(v_payload, 'changed', 'user:' || p_extra_user::text, true);
  end if;
exception when others then
  -- A Realtime failure only delays the update until the tab comes back (R1).
  raise warning 'live_notify: %', sqlerrm;
end;
$$;

revoke execute on function public.live_notify(uuid, uuid) from public, anon, authenticated;

create function public.live_events_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.live_notify(new.calendar_id);
  end if;
  -- A moved event (move, merge) tells the members of its old calendar too.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.calendar_id is distinct from new.calendar_id) then
    perform public.live_notify(old.calendar_id);
  end if;
  return null;
end;
$$;

create function public.live_calendars_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.live_notify(old.id);
  return null;
end;
$$;

-- RF-45: who leaves or is expelled hears it too, though no longer a member.
create function public.live_members_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.live_notify(old.calendar_id, old.user_id);
  else
    perform public.live_notify(new.calendar_id, new.user_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.live_events_changed() from public, anon, authenticated;
revoke execute on function public.live_calendars_changed() from public, anon, authenticated;
revoke execute on function public.live_members_changed() from public, anon, authenticated;

create trigger live_events_changed
  after insert or update or delete on public.events
  for each row execute function public.live_events_changed();

create trigger live_calendars_changed
  after update or delete on public.calendars
  for each row execute function public.live_calendars_changed();

create trigger live_members_changed
  after insert or update or delete on public.calendar_members
  for each row execute function public.live_members_changed();

-- D3, RF-47: a user can only listen to their own topic.
create policy "live: own topic"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
