-- Spec 028, T1: notes (to-do lists and text notes), personal by default or
-- shared through a calendar with its roles (plan "Modelo de datos", D1 to D4;
-- RF-13, RF-14). Permissions live here, in RLS, never in the app (P3).

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  -- The author. Null once they left the calendar of a shared note or deleted
  -- their account: a shared note belongs to its calendar (plan D2).
  owner_id uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Null = personal; else shared with the members of this calendar.
  calendar_id uuid references public.calendars (id) on delete cascade,
  kind text not null default 'list' check (kind in ('list', 'text')),
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) <= 10000),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  pinned boolean not null default false,
  archived boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_owned_or_shared check (owner_id is not null or calendar_id is not null)
);

create table public.note_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- The list of notes (pinned first, newest change first) and a note's items.
create index notes_owner_list_idx on public.notes (owner_id, archived, pinned, updated_at desc);
create index notes_calendar_idx on public.notes (calendar_id) where calendar_id is not null;
create index note_items_note_idx on public.note_items (note_id, position);

alter table public.notes enable row level security;
alter table public.note_items enable row level security;

-- Clients never write the author, the dates nor done_at.
revoke all on public.notes from anon, authenticated;
grant select, delete on public.notes to authenticated;
grant insert (id, calendar_id, kind, title, body, color, pinned, archived, due_date)
  on public.notes to authenticated;
grant update (calendar_id, title, body, color, pinned, archived, due_date)
  on public.notes to authenticated;

revoke all on public.note_items from anon, authenticated;
grant select, delete on public.note_items to authenticated;
grant insert (id, note_id, text, done, position) on public.note_items to authenticated;
grant update (text, done, position) on public.note_items to authenticated;

-- A personal note: its author. A shared one: the members of its calendar read,
-- owner and editors write.
create function public.can_read_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id
      and (
        (n.calendar_id is null and n.owner_id = (select auth.uid()))
        or (n.calendar_id is not null and public.is_calendar_member(n.calendar_id))
      )
  );
$$;

create function public.can_write_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id
      and (
        (n.calendar_id is null and n.owner_id = (select auth.uid()))
        or (
          n.calendar_id is not null
          and public.calendar_role_for(n.calendar_id) in ('owner', 'editor')
        )
      )
  );
$$;

revoke execute on function public.can_read_note(uuid) from public, anon;
revoke execute on function public.can_write_note(uuid) from public, anon;
grant execute on function public.can_read_note(uuid) to authenticated;
grant execute on function public.can_write_note(uuid) to authenticated;

create policy "notes_select_author_or_members" on public.notes
  for select to authenticated
  using (
    (calendar_id is null and owner_id = (select auth.uid()))
    or (calendar_id is not null and public.is_calendar_member(calendar_id))
  );

create policy "notes_insert_own" on public.notes
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      calendar_id is null
      or public.calendar_role_for(calendar_id) in ('owner', 'editor')
    )
  );

create policy "notes_update_writers" on public.notes
  for update to authenticated
  using (
    (calendar_id is null and owner_id = (select auth.uid()))
    or (calendar_id is not null and public.calendar_role_for(calendar_id) in ('owner', 'editor'))
  )
  with check (
    (calendar_id is null and owner_id = (select auth.uid()))
    or (calendar_id is not null and public.calendar_role_for(calendar_id) in ('owner', 'editor'))
  );

-- A shared note: the calendar's owner, or its author while still an editor.
create policy "notes_delete_author_or_owner" on public.notes
  for delete to authenticated
  using (
    (calendar_id is null and owner_id = (select auth.uid()))
    or (
      calendar_id is not null
      and (
        public.calendar_role_for(calendar_id) = 'owner'
        or (
          owner_id = (select auth.uid())
          and public.calendar_role_for(calendar_id) = 'editor'
        )
      )
    )
  );

create policy "note_items_select" on public.note_items
  for select to authenticated
  using (public.can_read_note(note_id));

create policy "note_items_insert" on public.note_items
  for insert to authenticated
  with check (public.can_write_note(note_id));

create policy "note_items_update" on public.note_items
  for update to authenticated
  using (public.can_write_note(note_id))
  with check (public.can_write_note(note_id));

create policy "note_items_delete" on public.note_items
  for delete to authenticated
  using (public.can_write_note(note_id));

-- What a note may be and how many (RF-13). CF429 carries which limit it was.
create function public.notes_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  new.title := btrim(new.title);

  if tg_op = 'INSERT' then
    if new.owner_id is not null
       and (select count(*) from public.notes n where n.owner_id = new.owner_id) >= 500 then
      raise exception 'notes' using errcode = 'CF429';
    end if;
    return new;
  end if;

  if new.kind is distinct from old.kind then
    raise exception 'The kind of a note cannot change' using errcode = '22023';
  end if;

  -- Only the author links a note to a calendar or makes it personal; the
  -- owner of both calendars may move it too (merging them). The policies
  -- already checked that the caller can write where it lands.
  if new.calendar_id is distinct from old.calendar_id
     and v_uid is not null
     and old.owner_id is distinct from v_uid
     and not (
       old.calendar_id is not null
       and new.calendar_id is not null
       and public.calendar_role_for(old.calendar_id) = 'owner'
       and public.calendar_role_for(new.calendar_id) = 'owner'
     ) then
    raise exception 'Only the author can move a note' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.notes_rules() from public, anon, authenticated;

create trigger notes_rules
  before insert or update on public.notes
  for each row execute function public.notes_rules();

create function public.note_items_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.text := btrim(new.text);

  if tg_op = 'INSERT' then
    if (select n.kind from public.notes n where n.id = new.note_id) is distinct from 'list' then
      raise exception 'Only a list has items' using errcode = '22023';
    end if;
    if (select count(*) from public.note_items i where i.note_id = new.note_id) >= 200 then
      raise exception 'items' using errcode = 'CF429';
    end if;
    new.done_at := case when new.done then now() end;
    return new;
  end if;

  if new.note_id is distinct from old.note_id then
    raise exception 'An item cannot change of note' using errcode = '22023';
  end if;
  if new.done is distinct from old.done then
    new.done_at := case when new.done then now() end;
  end if;
  return new;
end;
$$;

revoke execute on function public.note_items_rules() from public, anon, authenticated;

create trigger note_items_rules
  before insert or update on public.note_items
  for each row execute function public.note_items_rules();

-- A change in its items is a change in the note: it goes up in the list and
-- its readers are told (through the trigger below).
create function public.note_items_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes
  set updated_at = now()
  where id = coalesce(new.note_id, old.note_id);
  return null;
end;
$$;

revoke execute on function public.note_items_touch() from public, anon, authenticated;

create trigger note_items_touch
  after insert or update or delete on public.note_items
  for each row execute function public.note_items_touch();

-- Tells the members of the note's calendar and its author that something
-- changed, through the private topic of spec 019 (RF-12, plan D11). The
-- message carries no data of the note.
create function public.live_notes_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.live_notify(new.calendar_id, new.owner_id);
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and (
       old.calendar_id is distinct from new.calendar_id
       or old.owner_id is distinct from new.owner_id
     )) then
    perform public.live_notify(old.calendar_id, old.owner_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.live_notes_changed() from public, anon, authenticated;

create trigger live_notes_changed
  after insert or update or delete on public.notes
  for each row execute function public.live_notes_changed();

-- Who leaves a calendar, or is expelled, leaves there the notes they wrote,
-- as with events, and stops being their author (RF-14, plan D2).
create function public.notes_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes
  set owner_id = null
  where calendar_id = old.calendar_id
    and owner_id = old.user_id;
  return null;
end;
$$;

revoke execute on function public.notes_member_left() from public, anon, authenticated;

create trigger notes_member_left
  after delete on public.calendar_members
  for each row execute function public.notes_member_left();

-- Deleting an account deletes its personal notes; the shared ones stay in
-- their calendar without author (on delete set null). Before the profile
-- goes, or the personal ones would break notes_owned_or_shared (plan R2).
create function public.notes_profile_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notes
  where owner_id = old.id
    and calendar_id is null;
  return old;
end;
$$;

revoke execute on function public.notes_profile_deleted() from public, anon, authenticated;

create trigger notes_profile_deleted
  before delete on public.profiles
  for each row execute function public.notes_profile_deleted();
