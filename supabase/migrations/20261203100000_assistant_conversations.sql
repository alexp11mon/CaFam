-- Spec 052 RF-9 to RF-12 (plan "Modelo de datos", D3): Venito's
-- conversations, kept only when the user turns it on. Only their author sees
-- them (P3); at most 50 per user, and none older than 90 days.

alter table public.profiles
  add column save_chats boolean not null default false;

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  -- The messages as the chat keeps them, without images (RF-11).
  messages jsonb not null
    check (
      jsonb_typeof(messages) = 'array'
      and octet_length(messages::text) <= 200 * 1024
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_conversations_user_idx
  on public.assistant_conversations (user_id, updated_at desc);

alter table public.assistant_conversations enable row level security;

create policy "assistant_conversations_select_own"
  on public.assistant_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "assistant_conversations_insert_own"
  on public.assistant_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "assistant_conversations_update_own"
  on public.assistant_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "assistant_conversations_delete_own"
  on public.assistant_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.assistant_conversations from anon;

-- updated_at moves with each answer saved.
create or replace function public.assistant_conversations_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger assistant_conversations_touch
  before update on public.assistant_conversations
  for each row execute function public.assistant_conversations_touch();

-- RF-10: the 51st conversation pushes out the oldest one.
create or replace function public.assistant_conversations_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.assistant_conversations
  where id in (
    select c.id
    from public.assistant_conversations c
    where c.user_id = new.user_id
    order by c.updated_at desc, c.created_at desc
    offset 50
  );
  return null;
end;
$$;

revoke execute on function public.assistant_conversations_cap() from public, anon, authenticated;

create trigger assistant_conversations_cap
  after insert on public.assistant_conversations
  for each row execute function public.assistant_conversations_cap();

-- RF-10: none older than 90 days, every night.
create or replace function public.assistant_conversations_purge()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.assistant_conversations
    where updated_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.assistant_conversations_purge() from public, anon, authenticated;

select cron.schedule(
  'assistant-conversations-purge',
  '45 4 * * *',
  $$select public.assistant_conversations_purge()$$
);
