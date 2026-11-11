-- Spec 023, T1: restore_event trusted p_event_id. Same function as in
-- event_undo, plus the check that the target belongs to the copy's calendar.

create or replace function public.restore_event(
  p_trash_id uuid,
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trash public.event_trash;
  v_event public.events;
  v_id uuid;
begin
  select * into v_trash
  from public.event_trash
  where id = p_trash_id
    and deleted_by = auth.uid()
    -- "Deshacer" lasts 10 s; a minute leaves room for slow requests (RF-26).
    and created_at > now() - interval '1 minute';
  if v_trash.id is null
    or coalesce(public.calendar_role_for(v_trash.calendar_id)::text, '') not in ('owner', 'editor')
  then
    raise exception 'Nothing to restore' using errcode = 'CF404';
  end if;

  -- The event created again in the provider must be one of the calendar the
  -- copy came from: otherwise anyone could hang their comments and images on
  -- somebody else's event (spec 023 RF-1).
  if p_event_id is not null and not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.calendar_id = v_trash.calendar_id
  ) then
    raise exception 'Nothing to restore' using errcode = 'CF404';
  end if;

  if v_trash.event is not null then
    v_event := jsonb_populate_record(null::public.events, v_trash.event);
    if p_event_id is null then
      -- A synced calendar gets the event back through Google first (RF-3).
      if public.is_synced_calendar(v_trash.calendar_id) then
        raise exception 'Synced calendar' using errcode = '22023';
      end if;
      insert into public.events select v_event.*;
      v_id := v_event.id;
    else
      -- Created again in Google and committed by sync_commit_event: keep its
      -- author (RF-28).
      update public.events set created_by = v_event.created_by where id = p_event_id;
      v_id := p_event_id;
    end if;

    insert into public.event_images
    select (jsonb_populate_record(null::public.event_images, i || jsonb_build_object('event_id', v_id))).*
    from jsonb_array_elements(v_trash.images) i;

    -- The deleted rows queued their objects; they are used again (plan D7).
    delete from public.image_purge_queue q
    where q.object_id in (
      select (i ->> 'object_id')::uuid from jsonb_array_elements(v_trash.images) i
    );

    insert into public.event_comments
    select (jsonb_populate_record(null::public.event_comments, c || jsonb_build_object('event_id', v_id))).*
    from jsonb_array_elements(v_trash.comments) c;
  end if;

  -- An occurrence: deleting it added its date to the series' exdates.
  if v_trash.series_id is not null or v_event.series_id is not null then
    update public.events
    set exdates = array_remove(exdates, coalesce(v_trash.original_start, v_event.original_start))
    where id = coalesce(v_trash.series_id, v_event.series_id);
    if not found then
      raise exception 'Series not found' using errcode = 'CF404';
    end if;
    v_id := coalesce(v_id, v_trash.series_id);
  end if;

  delete from public.event_trash where id = v_trash.id;
  return v_id;
end;
$$;
