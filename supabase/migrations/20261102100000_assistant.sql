-- Spec 015, T2: chat assistant (plan "Modelo de datos", D6, D7, D9).

-- RF-20, RF-21: consent to let other people's assistant see my free/busy times.
-- Protected by the existing profiles policies (only the owner reads and
-- updates); visible_people() and calendar_members_with_names do not expose it.
alter table public.profiles
  add column share_availability boolean not null default false;

-- RF-27, D9: one row per answered question, to count the daily quota. No text
-- is stored (RF-6: no conversation history).
create table public.assistant_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  asked_at timestamptz not null default now()
);

create index assistant_questions_user_asked on public.assistant_questions (user_id, asked_at);

alter table public.assistant_questions enable row level security;

create policy "assistant_questions: read own"
  on public.assistant_questions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_questions: insert own"
  on public.assistant_questions for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Only user_id can be written, so asked_at is always the server's now(); no
-- update or delete, so the quota cannot be reset.
revoke all on public.assistant_questions from anon, authenticated;
grant select on public.assistant_questions to authenticated;
grant insert (user_id) on public.assistant_questions to authenticated;

create function public.assistant_purge_questions()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.assistant_questions where asked_at < now() - interval '2 days';
$$;

revoke execute on function public.assistant_purge_questions() from public, anon, authenticated;

select cron.schedule(
  'assistant-purge-questions',
  '30 4 * * *',
  $$select public.assistant_purge_questions()$$
);

-- Test helper, like trash_scheduled_jobs.
create function public.assistant_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text from cron.job j
  where j.jobname = 'assistant-purge-questions';
$$;

revoke execute on function public.assistant_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.assistant_scheduled_jobs() to service_role;

-- RF-15: the caller and everyone who shares at least one calendar with them,
-- with any role. Names and consent only: no email or time zone.
create function public.assistant_people()
returns table (user_id uuid, display_name text, shares_availability boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.share_availability
  from public.profiles p
  where p.id = auth.uid()
     or exists (
       select 1
       from public.calendar_members mine
       join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
       where mine.user_id = auth.uid() and theirs.user_id = p.id
     );
$$;

revoke execute on function public.assistant_people() from public, anon;
grant execute on function public.assistant_people() to authenticated;

-- RF-19, RF-20, RF-23, D6, D7: busy times of the people who consented and
-- share a calendar with the caller, from every calendar they are a member of.
-- Times and recurrence fields only, never title, place, description, calendar
-- or color; TypeScript expands the series (expandRows), as SQL cannot.
create function public.assistant_busy(p_person_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  person_id uuid,
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  recurrence text,
  recurrence_tz text,
  exdates timestamptz[],
  series_id uuid,
  original_start timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- RF-24: 31 days, plus a margin for the time zones.
  if p_to <= p_from or p_to - p_from > interval '32 days' then
    raise exception 'assistant_busy: period too long' using errcode = '22023';
  end if;

  return query
  with people as (
    select p.id
    from public.profiles p
    where p.id = any (p_person_ids)
      and p.share_availability
      and exists (
        select 1
        from public.calendar_members mine
        join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
        where mine.user_id = auth.uid() and theirs.user_id = p.id
      )
  )
  select distinct m.user_id, e.id, e.starts_at, e.ends_at, e.all_day, e.recurrence,
         e.recurrence_tz, e.exdates, e.series_id, e.original_start
  from people
  join public.calendar_members m on m.user_id = people.id
  join public.events e on e.calendar_id = m.calendar_id
  where e.starts_at < p_to
    and (
      -- Single events and exceptions overlapping the period (as getEventsInRange).
      (e.recurrence is null and e.ends_at >= p_from)
      -- Series that may have occurrences in it.
      or (e.recurrence is not null and (e.recurrence_until is null or e.recurrence_until >= p_from))
      -- Exceptions whose original occurrence could fall in it, wherever they moved.
      or (e.series_id is not null and e.original_start >= p_from - interval '32 days')
    );
end;
$$;

revoke execute on function public.assistant_busy(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.assistant_busy(uuid[], timestamptz, timestamptz) to authenticated;
