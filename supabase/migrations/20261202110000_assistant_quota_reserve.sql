-- Spec 051, T2: the daily quota of the assistant without races (RF-4, RF-5;
-- plan D2). A slot is reserved before calling the model, atomically; only
-- answered questions count (015 D9), and a reservation nobody confirms frees
-- itself after 2 minutes.

alter table public.assistant_questions
  add column state text not null default 'answered'
    check (state in ('reserved', 'answered')),
  add column expires_at timestamptz;

-- Only through the functions below from now on.
drop policy "assistant_questions: insert own" on public.assistant_questions;
revoke insert on public.assistant_questions from authenticated;

/**
 * Reserves one question of today (in the caller's zone). Returns its id and
 * how many are left after it; CF429 when the 30 are used or reserved.
 */
create function public.assistant_reserve()
returns table (id bigint, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_zone text;
  v_since timestamptz;
  v_used integer;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'Sign in' using errcode = '42501';
  end if;
  -- One reservation at a time per user: the count and the insert are one step.
  perform pg_advisory_xact_lock(hashtextextended('assistant_quota:' || v_user::text, 0));

  select coalesce(p.time_zone, 'Europe/Madrid') into v_zone
  from public.profiles p where p.id = v_user;
  v_since := date_trunc('day', now() at time zone coalesce(v_zone, 'Europe/Madrid'))
    at time zone coalesce(v_zone, 'Europe/Madrid');

  select count(*) into v_used
  from public.assistant_questions q
  where q.user_id = v_user
    and q.asked_at >= v_since
    and (q.state = 'answered' or q.expires_at > clock_timestamp());

  if v_used >= 30 then
    raise exception 'Daily quota used' using errcode = 'CF429';
  end if;

  insert into public.assistant_questions (user_id, state, expires_at)
  values (v_user, 'reserved', clock_timestamp() + interval '2 minutes')
  returning assistant_questions.id into v_id;

  return query select v_id, 30 - v_used - 1;
end;
$$;

/** The answer went out: the reservation counts for good. */
create function public.assistant_answered(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.assistant_questions
  set state = 'answered', expires_at = null
  where id = p_id and user_id = auth.uid() and state = 'reserved';
$$;

/** The answer failed or was cancelled: the slot is free again. */
create function public.assistant_release(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.assistant_questions
  where id = p_id and user_id = auth.uid() and state = 'reserved';
$$;

revoke execute on function public.assistant_reserve() from public, anon;
revoke execute on function public.assistant_answered(bigint) from public, anon;
revoke execute on function public.assistant_release(bigint) from public, anon;
grant execute on function public.assistant_reserve() to authenticated;
grant execute on function public.assistant_answered(bigint) to authenticated;
grant execute on function public.assistant_release(bigint) to authenticated;

-- Expired reservations go with the daily purge (they no longer count anyway).
create or replace function public.assistant_purge_questions()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.assistant_questions
  where asked_at < now() - interval '2 days'
     or (state = 'reserved' and expires_at < now());
$$;
