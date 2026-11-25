-- Spec 049, T1: resend limit for the signup link, voluntary transfer of a
-- calendar and purge of accounts never confirmed (RF-1, RF-6 to RF-11; plan
-- "Módulos", D3, D4).

-- Resending the signup link (RF-1) ------------------------------------------------
-- Same table as the recovery links (spec 006, D6): one count per address,
-- because both spend the same daily Brevo mail. At most one a minute and three
-- every 15 minutes. Only the SHA-256 of the address is stored.
create function public.request_signup_resend(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea;
  v_minute integer;
  v_recent integer;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'The address is required' using errcode = '22023';
  end if;

  v_hash := extensions.digest(lower(btrim(p_email)), 'sha256');

  select count(*) filter (where created_at > now() - interval '1 minute'),
         count(*)
  into v_minute, v_recent
  from public.auth_email_requests
  where email_hash = v_hash
    and created_at > now() - interval '15 minutes';

  if v_minute > 0 or v_recent >= 3 then
    return false;
  end if;

  insert into public.auth_email_requests (email_hash) values (v_hash);
  return true;
end;
$$;

revoke execute on function public.request_signup_resend(text) from public;
grant execute on function public.request_signup_resend(text) to anon, authenticated;

-- Transfer of a calendar (RF-7 to RF-11) -------------------------------------------

alter table public.account_notices drop constraint account_notices_kind_check;
alter table public.account_notices add constraint account_notices_kind_check
  check (kind in ('orphaned', 'kept_copy', 'deleted_calendar', 'sync_revoked',
                  'sync_failing', 'ics_failing', 'transferred'));

-- Only the owner, to another member, never a calendar brought from Google or
-- iCloud (its connection is the owner's, RF-9). The old owner stays as Editor;
-- the ways in that the old owner made are revoked (RF-10); groups and
-- preferences are per person and do not change (RF-11).
create function public.transfer_calendar(p_calendar_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_from text;
  v_email text;
begin
  select c.name into v_name
  from public.calendars c
  where c.id = p_calendar_id and c.owner_id = v_uid
  for update;
  if not found then
    raise exception 'Calendar not found' using errcode = 'CF404';
  end if;

  if exists (select 1 from public.synced_calendars s where s.calendar_id = p_calendar_id) then
    raise exception 'A synced calendar cannot be transferred' using errcode = 'CF409';
  end if;

  if p_new_owner is null or p_new_owner = v_uid or not exists (
    select 1 from public.calendar_members m
    where m.calendar_id = p_calendar_id and m.user_id = p_new_owner
  ) then
    raise exception 'The new owner must be a member' using errcode = '22023';
  end if;

  perform set_config('app.account_transfer', 'on', true);
  update public.calendars set owner_id = p_new_owner where id = p_calendar_id;
  perform set_config('app.account_transfer', 'off', true);

  -- The old owner first: one owner per calendar at any time.
  update public.calendar_members set role = 'editor'
  where calendar_id = p_calendar_id and user_id = v_uid;
  update public.calendar_members set role = 'owner'
  where calendar_id = p_calendar_id and user_id = p_new_owner;

  update public.calendar_invites set revoked_at = now()
  where calendar_id = p_calendar_id and revoked_at is null;
  delete from public.calendar_access_codes where calendar_id = p_calendar_id;
  delete from public.calendar_feeds where calendar_id = p_calendar_id;
  delete from public.ics_subscriptions where calendar_id = p_calendar_id;

  select p.display_name into v_from from public.profiles p where p.id = v_uid;
  insert into public.account_notices (user_id, kind, person_name, calendar_name)
  values (p_new_owner, 'transferred', coalesce(v_from, ''), v_name);

  select u.email into v_email from auth.users u where u.id = p_new_owner;
  if v_email is not null then
    insert into public.email_outbox (to_email, subject, body)
    values (
      v_email,
      format('Ahora eres el propietario de «%s»', v_name),
      format(
        '%s te ha traspasado el calendario «%s» en CaFam. Ahora eres su propietario: puedes editarlo, compartirlo y decidir quién entra.',
        coalesce(nullif(v_from, ''), 'Su propietario'),
        v_name
      )
    );
  end if;
end;
$$;

revoke execute on function public.transfer_calendar(uuid, uuid) from public;
grant execute on function public.transfer_calendar(uuid, uuid) to authenticated;

-- Accounts never confirmed (RF-6, D4) -----------------------------------------------
-- They could never sign in, so they have nothing to keep; a calendar shared
-- with someone else (impossible without signing in) is left alone anyway.
create function public.account_purge_unconfirmed(p_older_than interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - p_older_than
      and not exists (
        select 1
        from public.calendars c
        join public.calendar_members m on m.calendar_id = c.id
        where c.owner_id = u.id and m.user_id <> u.id
      )
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

revoke execute on function public.account_purge_unconfirmed(interval) from public, anon, authenticated;

select cron.schedule(
  'account-purge-unconfirmed',
  '30 4 * * *',
  $$select public.account_purge_unconfirmed()$$
);
