-- Spec 048, T1: due dates per item, fractional order, notes of an event and
-- "Tareas con fecha" in the calendar (RF-1, RF-5, RF-6, RF-8, RF-9, RF-11;
-- plan D1 to D4).

-- Due date and optional time of each item (RF-1).
alter table public.note_items
  add column due_date date,
  add column due_time time,
  add constraint note_items_time_needs_date check (due_time is null or due_date is not null);

-- Fractional order: moving an item writes one row (plan D1). The cast keeps
-- the order of the rows that exist.
alter table public.note_items
  alter column position type double precision using position::double precision;

grant insert (due_date, due_time) on public.note_items to authenticated;
grant update (due_date, due_time) on public.note_items to authenticated;

-- A note linked to one event or repetition (RF-9, plan D2); deleting the
-- event unlinks it, never deletes it (RF-11).
alter table public.notes
  add column event_id uuid references public.events (id) on delete set null;

create index notes_event_idx on public.notes (event_id) where event_id is not null;

grant insert (event_id) on public.notes to authenticated;
grant update (event_id) on public.notes to authenticated;

-- "Tareas con fecha" in the calendar filters, for every device (plan D3).
alter table public.profiles
  add column show_tasks boolean not null default false;

-- The event of a note: one its author can read and, for a shared note, of
-- the same calendar (RF-9). Checked when the link changes, so merging
-- calendars (events first, notes after) is not stopped by it.
create function public.notes_event_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar uuid;
begin
  if new.event_id is null
     or (tg_op = 'UPDATE' and new.event_id is not distinct from old.event_id) then
    return new;
  end if;

  select e.calendar_id into v_calendar
  from public.events e
  where e.id = new.event_id;

  if v_calendar is null
     or (auth.uid() is not null and not public.is_calendar_member(v_calendar)) then
    raise exception 'event' using errcode = 'CF404';
  end if;
  if new.calendar_id is not null and new.calendar_id <> v_calendar then
    raise exception 'A shared note links to an event of its calendar'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.notes_event_rules() from public, anon, authenticated;

create trigger notes_event_rules
  before insert or update on public.notes
  for each row execute function public.notes_event_rules();

-- Pending tasks with a due date in [p_from, p_to] that the user can see:
-- their personal notes and the shared ones of their visible calendars
-- (RF-6, RF-8). Invoker: RLS of notes and note_items decides.
create function public.calendar_tasks(p_from date, p_to date)
returns table (
  note_id uuid,
  item_id uuid,
  text text,
  note_title text,
  note_kind text,
  calendar_id uuid,
  due_date date,
  due_time time
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_notes as (
    select n.*
    from public.notes n
    where not n.archived
      and (
        n.calendar_id is null
        or not exists (
          select 1 from public.calendar_preferences p
          where p.user_id = (select auth.uid())
            and p.calendar_id = n.calendar_id
            and not p.visible
        )
      )
  )
  select n.id, null::uuid, n.title, n.title, n.kind, n.calendar_id, n.due_date, null::time
  from visible_notes n
  where n.due_date between p_from and p_to
  union all
  select n.id, i.id, i.text, n.title, n.kind, n.calendar_id, i.due_date, i.due_time
  from visible_notes n
  join public.note_items i on i.note_id = n.id
  where not i.done
    and i.due_date between p_from and p_to
  order by 7, 8 nulls first, 3
  limit 500;
$$;

revoke execute on function public.calendar_tasks(date, date) from public, anon;
grant execute on function public.calendar_tasks(date, date) to authenticated;
