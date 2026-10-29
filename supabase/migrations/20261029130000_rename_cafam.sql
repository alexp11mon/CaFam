-- Spec 010, T1: the account mail names the app CaFam (RF-7, RF-8; plan D1).
-- Literal copies of the latest delete_own_account (spec 006, T4) and
-- send_pending_emails (spec 006, T23); only the app name changes.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_calendar record;
  v_member record;
  v_member_email text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select p.display_name into v_name
  from public.profiles p
  where p.id = v_uid;

  for v_calendar in
    select c.id, c.name
    from public.calendars c
    where c.owner_id = v_uid
      and exists (
        select 1
        from public.calendar_members m
        where m.calendar_id = c.id
          and m.user_id <> v_uid
      )
    for update of c
  loop
    perform set_config('app.account_transfer', 'on', true);
    update public.calendars
    set owner_id = null, orphaned_at = now()
    where id = v_calendar.id;
    perform set_config('app.account_transfer', 'off', true);

    for v_member in
      select m.user_id
      from public.calendar_members m
      where m.calendar_id = v_calendar.id
        and m.user_id <> v_uid
    loop
      select u.email into v_member_email
      from auth.users u
      where u.id = v_member.user_id;

      insert into public.account_notices (user_id, kind, person_name, calendar_name)
      values (v_member.user_id, 'orphaned', coalesce(v_name, ''), v_calendar.name);

      insert into public.email_outbox (to_email, subject, body)
      values (
        v_member_email,
        'Un calendario compartido se queda sin propietario',
        format(
          '%s ha eliminado su cuenta de CaFam. El calendario «%s» se queda sin propietario: tienes 15 días para conservarlo o salir de él. Entra en CaFam, en Mis calendarios.',
          coalesce(nullif(v_name, ''), 'Una persona'),
          v_calendar.name
        )
      );
    end loop;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.send_pending_emails(
  p_dry_run boolean default false,
  p_limit integer default 50
)
returns setof bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_sender text;
  v_row record;
begin
  if not p_dry_run then
    select ds.decrypted_secret into v_key
    from vault.decrypted_secrets ds
    where ds.name = 'brevo_api_key';

    select ds.decrypted_secret into v_sender
    from vault.decrypted_secrets ds
    where ds.name = 'brevo_sender_email';

    if v_key is null or v_sender is null then
      raise exception 'Brevo is not configured in Vault' using errcode = 'P0001';
    end if;

    -- Requests answered with 2xx are sent; the others are retried later.
    update public.email_outbox o
    set sent_at = now()
    from net._http_response r
    where o.request_id = r.id
      and o.sent_at is null
      and coalesce(r.status_code, 0) between 200 and 299;

    update public.email_outbox o
    set request_id = null
    from net._http_response r
    where o.request_id = r.id
      and o.sent_at is null
      and coalesce(r.status_code, 0) not between 200 and 299;
  end if;

  for v_row in
    select o.id, o.to_email, o.subject, o.body
    from public.email_outbox o
    where o.sent_at is null
      and o.request_id is null
      and o.attempts < 5
      and o.to_email not ilike '%.test'
    order by o.created_at, o.id
    limit p_limit
  loop
    if not p_dry_run then
      update public.email_outbox
      set attempts = attempts + 1,
          request_id = net.http_post(
            url := 'https://api.brevo.com/v3/smtp/email',
            headers := jsonb_build_object(
              'api-key', v_key,
              'accept', 'application/json',
              'content-type', 'application/json'
            ),
            body := jsonb_build_object(
              'sender', jsonb_build_object('name', 'CaFam', 'email', v_sender),
              'to', jsonb_build_array(jsonb_build_object('email', v_row.to_email)),
              'subject', v_row.subject,
              'textContent', v_row.body
            )
          )
      where id = v_row.id;
    end if;

    return next v_row.id;
  end loop;

  return;
end;
$$;

revoke execute on function public.send_pending_emails(boolean, integer)
  from public, anon, authenticated;
grant execute on function public.send_pending_emails(boolean, integer) to service_role;
