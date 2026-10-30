-- Spec 012, T1: images of the events and the queue of objects to remove from
-- Storage (plan "Modelo de datos", D6, D7; RF-4, RF-15 to RF-17, RF-19, RF-29,
-- RF-30).
--
-- An image belongs to an event, never to a storage path: its permissions come
-- from the event's calendar, so moving or merging calendars needs no change in
-- Storage (plan D6). Copies of ownerless calendars (spec 006) share object_id.
-- Rows are only created by the reserve/confirm functions (T2).

create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  object_id uuid not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  bytes integer not null check (bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now()
);

create index event_images_event_id_idx on public.event_images (event_id, created_at);
create index event_images_object_id_idx on public.event_images (object_id);
create index event_images_uploaded_by_idx on public.event_images (uploaded_by);

-- Objects waiting to be removed from Storage by the hourly job (plan D7).
-- No client reads or writes it, like email_outbox.
create table public.image_purge_queue (
  object_id uuid primary key,
  bytes integer not null,
  attempts smallint not null default 0,
  queued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.event_images enable row level security;
alter table public.image_purge_queue enable row level security;

revoke insert, update on public.event_images from anon, authenticated;
revoke all on public.image_purge_queue from anon, authenticated;

-- Members read ready images; a pending one only who reserved it (RF-4, RF-25).
-- The events subquery is itself limited to the caller's calendars.
create policy "event_images_select_members" on public.event_images
  for select to authenticated
  using (
    case status
      when 'ready' then exists (
        select 1 from public.events e
        where e.id = event_images.event_id
          and public.is_calendar_member(e.calendar_id)
      )
      else uploaded_by = (select auth.uid())
    end
  );

-- The uploader, the owner and editors delete (RF-15). Ownerless calendars keep
-- their editors, so they can still delete (spec 006).
create policy "event_images_delete_author_or_editor" on public.event_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_images.event_id
        and (
          event_images.uploaded_by = (select auth.uid())
          or public.calendar_role_for(e.calendar_id) in ('owner', 'editor')
        )
    )
  );

-- Every way a row disappears (by hand, with its event, calendar or account, or
-- from the sync) queues its object once no other row uses it (RF-16, RF-17).
create function public.queue_image_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.event_images where object_id = old.object_id
  ) then
    insert into public.image_purge_queue (object_id, bytes)
    values (old.object_id, old.bytes)
    on conflict (object_id) do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function public.queue_image_purge() from public, anon, authenticated;

create trigger event_images_queue_purge
  after delete on public.event_images
  for each row execute function public.queue_image_purge();
