-- Spec 051, T1: the author of an event is set by the server (RF-1 to RF-3).
--
-- Only direct writes of the client (PostgREST runs them as `authenticated`)
-- are touched. SECURITY DEFINER functions run as their owner, so copies,
-- merges, imports, sync, materialize and restore keep the authors they choose
-- without any flag (simpler than the `app.keep_author` mark of plan D1, same
-- effect).
create function public.events_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger events_author
  before insert or update on public.events
  for each row execute function public.events_author();

-- Turning another's event with images or comments into a series (spec 023
-- RF-12): the new series row is made by the client, then attached; this gives
-- it the author of the original, its first occurrence. CF404 if the event is
-- not the first occurrence of a series the caller may edit.
create function public.convert_keep_author(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found
     or v_event.series_id is null
     or v_event.original_start is distinct from v_event.starts_at
     or public.calendar_role_for(v_event.calendar_id) not in ('owner', 'editor')
  then
    raise exception 'No such event' using errcode = 'CF404';
  end if;

  update public.events
  set created_by = v_event.created_by
  where id = v_event.series_id
    and calendar_id = v_event.calendar_id
    and recurrence is not null;
end;
$$;

revoke execute on function public.convert_keep_author(uuid) from public, anon;
grant execute on function public.convert_keep_author(uuid) to authenticated;
